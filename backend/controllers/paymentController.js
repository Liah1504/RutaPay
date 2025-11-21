// backend/controllers/paymentController.js
// Guarda en payments both driver_id (drivers.id) y driver_code (drivers.driver_code)
// Al crear un pago: resuelve driver_code -> drivers.id; si se recibe driver_id (drivers.id) lo usa.
// Notifica al usuario asociado (drivers.user_id).

const db = require('../config/database');
let notifier;
try { notifier = require('../utils/notifications'); } catch (err) { notifier = null; }

/**
 * POST /api/payment/pay
 * Realiza el pago manual y crea una notificación persistente para el driver.
 *
 * Reglas:
 * - Acepta driver_code (recomendado) o driver_id (drivers.id).
 * - Inserta en payments:
 *     driver_id = drivers.id (fila de drivers)
 *     driver_code = drivers.driver_code (string)
 * - Crea notificación para drivers.user_id (usuario asociado).
 */
const manualPayment = async (req, res) => {
  try {
    console.log('manualPayment - body:', req.body);
    console.log('manualPayment - req.user:', req.user && { id: req.user.id, email: req.user.email });

    const passengerUserId = req.user?.id;
    if (!passengerUserId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { driver_code, driver_id /* optional drivers.id */, route_id } = req.body;
    if (!route_id) {
      return res.status(400).json({ error: 'Parámetros faltantes: route_id es requerido' });
    }

    // Resolver drivers.id (driver_row_id) y driver_code y driverUserId (users.id)
    let driverRowId = null;
    let resolvedDriverCode = null;
    let driverUserId = null;

    if (driver_id) {
      const d = await db.query('SELECT id, user_id, driver_code FROM drivers WHERE id = $1 LIMIT 1', [driver_id]);
      if (d.rows.length === 0) {
        return res.status(404).json({ error: 'Conductor no encontrado por id' });
      }
      driverRowId = d.rows[0].id;
      resolvedDriverCode = d.rows[0].driver_code;
      driverUserId = d.rows[0].user_id;
    } else if (driver_code) {
      const d = await db.query('SELECT id, user_id, driver_code FROM drivers WHERE driver_code = $1 LIMIT 1', [driver_code]);
      if (d.rows.length === 0) {
        console.warn('manualPayment: conductor no encontrado para driver_code=', driver_code);
        return res.status(404).json({ error: 'Conductor no encontrado con ese código' });
      }
      driverRowId = d.rows[0].id;
      resolvedDriverCode = d.rows[0].driver_code;
      driverUserId = d.rows[0].user_id;
    } else {
      return res.status(400).json({ error: 'driver_code o driver_id son requeridos' });
    }

    // 2) Obtener ruta y tarifa
    const qRoute = `SELECT id, name, fare FROM routes WHERE id = $1 LIMIT 1`;
    const routeRes = await db.query(qRoute, [route_id]);
    if (routeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    const route = routeRes.rows[0];
    const fare = parseFloat(route.fare || 0);

    // 3) Nombre pasajero para el mensaje
    const pRes = await db.query(`SELECT name FROM users WHERE id = $1 LIMIT 1`, [passengerUserId]);
    const passengerName = pRes.rows.length ? pRes.rows[0].name : 'Pasajero';

    try {
      // Iniciar transacción para crear payment
      await db.query('BEGIN');

      // INSERT: guardar driver_id = drivers.id y driver_code
      const insertQ = `
        INSERT INTO payments (passenger_id, driver_id, driver_code, amount, route_id, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;
      const insertRes = await db.query(insertQ, [passengerUserId, driverRowId, resolvedDriverCode, fare, route_id]);
      const newPayment = insertRes.rows[0];

      await db.query('COMMIT');

      // Insertar notificación persistente para el driver (usuario) si driverUserId existe
      if (driverUserId) {
        try {
          const title = `Pago recibido • ${route.name}`;
          const body = `${passengerName} pagó ${fare} Bs`;
          const dataObj = {
            type: 'payment',
            payment_id: newPayment.id,
            passenger_id: passengerUserId,
            passenger_name: passengerName,
            route_id,
            route_name: route.name,
            amount: fare,
            driver_code: resolvedDriverCode
          };

          const notifQ = `
            INSERT INTO notifications (user_id, title, body, data, read, created_at)
            VALUES ($1, $2, $3, $4::jsonb, false, NOW())
            RETURNING id, user_id, title, body, data, read, created_at
          `;
          const notifRes = await db.query(notifQ, [driverUserId, title, body, JSON.stringify(dataObj)]);
          const createdNotif = notifRes.rows[0];
          console.log('manualPayment: notificación creada ->', createdNotif);

          // Emitir evento en memoria (si existe notifier)
          try {
            if (notifier && typeof notifier.emit === 'function') {
              notifier.emit('payment', {
                driver_user_id: driverUserId,
                payment: newPayment,
                ...dataObj
              });
            }
          } catch (emitErr) {
            console.warn('manualPayment: error emitiendo evento payment:', emitErr && (emitErr.message || emitErr));
          }
        } catch (notifErr) {
          console.warn('manualPayment: No se pudo insertar notificación en tabla notifications:', notifErr && (notifErr.stack || notifErr.message || notifErr));
        }
      } else {
        console.warn('manualPayment: driverUserId ausente, no se creó notificación para driver_row_id:', driverRowId);
      }

      console.log('manualPayment: pago creado ->', newPayment);
      return res.json({ success: true, message: 'Pago realizado correctamente', payment: newPayment });
    } catch (txErr) {
      await db.query('ROLLBACK');
      console.error('manualPayment: error en transacción', txErr && (txErr.stack || txErr.message || txErr));
      return res.status(500).json({ error: 'Error procesando el pago' });
    }
  } catch (err) {
    console.error('manualPayment: error general', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error procesando el pago' });
  }
};

module.exports = {
  manualPayment
};