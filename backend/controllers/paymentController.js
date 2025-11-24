// Corrected manualPayment with wallet deduction and row locking
const db = require('../config/database');
let notifier;
try { notifier = require('../utils/notifications'); } catch (err) { notifier = null; }

/**
 * POST /api/payment/pay
 * Perform manual payment:
 * - Accepts driver_code (preferred) or driver_id (drivers.id)
 * - Resolves drivers.id and drivers.driver_code
 * - Validates passenger has enough balance
 * - In a single transaction: LOCK passenger user row, INSERT payment, UPDATE passenger balance
 * - Create notification for driver.user_id
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

    // Resolve driver row
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

    // Get route fare
    const qRoute = `SELECT id, name, fare FROM routes WHERE id = $1 LIMIT 1`;
    const routeRes = await db.query(qRoute, [route_id]);
    if (routeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    const route = routeRes.rows[0];
    const fare = parseFloat(route.fare || 0);

    // Get passenger name for notification
    const pRes = await db.query(`SELECT name FROM users WHERE id = $1 LIMIT 1`, [passengerUserId]);
    const passengerName = pRes.rows.length ? pRes.rows[0].name : 'Pasajero';

    try {
      // Start transaction
      await db.query('BEGIN');

      // Lock passenger user row to avoid race conditions on balance
      const lockRes = await db.query('SELECT id, balance FROM users WHERE id = $1 FOR UPDATE', [passengerUserId]);
      if (lockRes.rows.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Usuario pasajero no encontrado' });
      }
      const currentBalance = parseFloat(lockRes.rows[0].balance || 0);

      if (currentBalance < fare) {
        await db.query('ROLLBACK');
        return res.status(402).json({ error: 'Saldo insuficiente' });
      }

      // Insert payment (store driver_id as drivers.id and driver_code as from drivers table)
      const insertQ = `
        INSERT INTO payments (passenger_id, driver_id, driver_code, amount, route_id, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;
      const insertRes = await db.query(insertQ, [passengerUserId, driverRowId, resolvedDriverCode, fare, route_id]);
      const newPayment = insertRes.rows[0];

      // Deduct from passenger balance
      const updateUserQ = `
        UPDATE users
        SET balance = balance - $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, balance
      `;
      const updatedUserRes = await db.query(updateUserQ, [fare, passengerUserId]);
      const updatedUser = updatedUserRes.rows[0];

      await db.query('COMMIT');

      // Create notification for driver (driverUserId) if available
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

          // Emit in-memory event if notifier exists
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

      console.log('manualPayment: pago creado ->', newPayment, 'updatedUser balance ->', updatedUser);
      return res.json({ success: true, message: 'Pago realizado correctamente', payment: newPayment, new_balance: updatedUser.balance });
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