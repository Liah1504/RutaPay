const db = require('../config/database');
const notifier = require('../utils/notifications');

/**
 * POST /api/payment/pay
 * Realiza el pago manual: usa driver_code + route_id, actualiza balances e inserta payment.
 * Emite evento 'payment' en notifier con payload para debugging / futuro SSE/ws.
 */
const manualPayment = async (req, res) => {
  try {
    console.log('manualPayment - body:', req.body);
    console.log('manualPayment - req.user:', req.user && { id: req.user.id, email: req.user.email });

    const passengerUserId = req.user?.id;
    if (!passengerUserId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { driver_code, route_id } = req.body;
    if (!route_id || !driver_code) {
      return res.status(400).json({ error: 'Parámetros faltantes: route_id y driver_code son requeridos' });
    }

    // Obtener tarifa
    const routeResult = await db.query('SELECT fare, name FROM routes WHERE id = $1', [route_id]);
    if (routeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    const fare = parseFloat(routeResult.rows[0].fare || 0);
    const routeName = routeResult.rows[0].name || 'Sin nombre';

    // Verificar pasajero
    const passengerResult = await db.query('SELECT balance, name FROM users WHERE id = $1', [passengerUserId]);
    if (passengerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pasajero no encontrado' });
    }
    const passengerBalance = parseFloat(passengerResult.rows[0].balance || 0);
    const passengerName = passengerResult.rows[0].name || 'Pasajero';

    if (passengerBalance < fare) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // Buscar conductor por driver_code
    const driverCodeNormalized = String(driver_code).trim();
    const driverResult = await db.query('SELECT id, user_id FROM drivers WHERE driver_code = $1', [driverCodeNormalized]);
    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Código de conductor no encontrado' });
    }
    const driver = driverResult.rows[0];

    // Transacción
    try {
      await db.query('BEGIN');

      await db.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [fare, passengerUserId]);
      await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [fare, driver.user_id]);

      const insertRes = await db.query(
        `INSERT INTO payments (passenger_id, driver_id, amount, route_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, passenger_id, driver_id, amount, route_id, created_at`,
        [passengerUserId, driver.user_id, fare, route_id]
      );
      const newPayment = insertRes.rows[0];

      await db.query('COMMIT');

      // Emitir notificación en memoria
      const payload = {
        driver_user_id: driver.user_id,
        passenger_id: passengerUserId,
        passenger_name: passengerName,
        amount: fare,
        route_id,
        route_name: routeName,
        payment_id: newPayment.id,
        created_at: newPayment.created_at
      };
      notifier.emit('payment', payload);

      console.log('manualPayment: pago creado ->', newPayment);
      return res.json({ success: true, message: 'Pago realizado correctamente', payment: newPayment });
    } catch (txErr) {
      await db.query('ROLLBACK');
      console.error('manualPayment: error en transacción', txErr);
      return res.status(500).json({ error: 'Error procesando el pago' });
    }
  } catch (err) {
    console.error('manualPayment: error general', err);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { manualPayment };