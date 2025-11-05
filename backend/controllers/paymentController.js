// backend/controllers/paymentController.js

const db = require('../config/database');

// POST /api/payment/pay
const manualPayment = async (req, res) => {
  try {
    // Log para depuración
    console.log('🔔 manualPayment - req.body:', req.body);
    console.log('🔔 manualPayment - req.user:', req.user && { id: req.user.id, role: req.user.role });

    // ID del pasajero que está pagando (viene del token)
    const passengerUserId = req.user?.id;
    if (!passengerUserId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Aceptamos driver_code (lo que envía el frontend) y route_id
    const { driver_code, route_id } = req.body;

    if (!route_id || !driver_code) {
      return res.status(400).json({ error: 'Parámetros faltantes: route_id y driver_code son requeridos' });
    }

    // 1. Obtener la tarifa de la ruta
    const routeResult = await db.query('SELECT fare FROM routes WHERE id = $1', [route_id]);
    if (routeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    const fare = parseFloat(routeResult.rows[0].fare);

    // 2. Verificar saldo del pasajero
    const passengerResult = await db.query('SELECT balance FROM users WHERE id = $1', [passengerUserId]);
    if (passengerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pasajero no encontrado' });
    }
    const passengerBalance = parseFloat(passengerResult.rows[0].balance || 0);

    if (passengerBalance < fare) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // 3. Verificar que el conductor existe buscando por driver_code
    // Normalizamos el código a string por si viene como número u otro tipo
    const driverCodeNormalized = String(driver_code).trim();
    const driverResult = await db.query('SELECT id, user_id FROM drivers WHERE driver_code = $1', [driverCodeNormalized]);

    if (driverResult.rows.length === 0) {
      // Si el código (101, 102, etc.) no existe
      return res.status(404).json({ error: 'Código de conductor no encontrado' });
    }

    const driver = driverResult.rows[0]; // { id: <drivers.id>, user_id: <users.id> }

    // 4. Realizar la transacción: restar al pasajero, sumar al conductor, insertar registro de pago
    try {
      await db.query('BEGIN');

      // Restar saldo al pasajero
      await db.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [fare, passengerUserId]);

      // Sumar saldo al conductor (users.id relacionado por drivers.user_id)
      await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [fare, driver.user_id]);

      // Insertar registro de pago (si tienes tabla payments)
      await db.query(
        `INSERT INTO payments (passenger_id, driver_id, amount, route_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [passengerUserId, driver.user_id, fare, route_id]
      );

      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      console.error('❌ Error en transacción de pago:', txErr);
      return res.status(500).json({ error: 'Error procesando el pago' });
    }

    return res.json({ success: true, message: 'Pago realizado correctamente' });
  } catch (error) {
    console.error('❌ Error en manualPayment:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { manualPayment };