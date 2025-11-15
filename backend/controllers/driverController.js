const db = require('../config/database');

/**
 * Helper: resolver driverId
 * - Si se pasa driver_code en query o como parámetro, intenta buscar por driver_code.
 * - Si no, usa el usuario autenticado (req.user.id) para buscar drivers.user_id.
 * - Devuelve driverId (number) o lanza un error con status/message para respuestas HTTP.
 */
const resolveDriverId = async (req) => {
  const driverCode = req.query?.driver_code || req.params?.driver_code;
  if (driverCode) {
    const drvRes = await db.query('SELECT id, user_id FROM drivers WHERE driver_code = $1 LIMIT 1', [driverCode]);
    if (drvRes.rows.length === 0) {
      const err = new Error('No se encontró conductor con driver_code proporcionado');
      err.status = 404;
      throw err;
    }
    return drvRes.rows[0].id;
  }

  const userId = req.user && req.user.id;
  if (!userId) {
    const err = new Error('Usuario no autenticado');
    err.status = 401;
    throw err;
  }

  const drvByUser = await db.query('SELECT id FROM drivers WHERE user_id = $1 LIMIT 1', [userId]);
  if (drvByUser.rows.length === 0) {
    const err = new Error('No se encontró perfil de conductor para este usuario');
    err.status = 404;
    throw err;
  }
  return drvByUser.rows[0].id;
};

/**
 * GET /api/drivers/profile
 */
const getDriverProfile = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const q = `
      SELECT u.id as user_id, u.name, u.email, u.phone, u.balance,
             d.id as driver_id, d.driver_code, d.license_number, d.vehicle_type, d.vehicle_plate,
             d.is_available, d.current_location, d.rating, d.total_trips, d.created_at as driver_created_at, d.updated_at as driver_updated_at
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE d.user_id = $1
    `;
    const result = await db.query(q, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conductor no encontrado' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('getDriverProfile error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

/**
 * GET /api/drivers/payments
 *
 * Ahora resuelve el driverId correctamente (por driver_code o por user_id -> drivers.id)
 * y usa ese driverId para recuperar los pagos.
 */
const getDriverPayments = async (req, res) => {
  try {
    const driverId = await resolveDriverId(req);

    const q = `
      SELECT p.id, p.amount, p.created_at,
             COALESCE(r.name, 'Sin ruta') AS route_name,
             COALESCE(u.name, 'Pasajero desconocido') AS passenger_name,
             p.passenger_id
      FROM payments p
      LEFT JOIN routes r ON p.route_id = r.id
      LEFT JOIN users u ON p.passenger_id = u.id
      WHERE p.driver_id = $1
      ORDER BY p.created_at DESC
      LIMIT 500
    `;
    const result = await db.query(q, [driverId]);
    return res.json(result.rows);
  } catch (err) {
    console.error('getDriverPayments error:', err && (err.stack || err.message || err));
    const status = err && err.status ? err.status : 500;
    return res.status(status).json({ error: err.message || 'Error al obtener el historial de pagos' });
  }
};

/**
 * GET /api/drivers/payments/summary?date=YYYY-MM-DD
 * Usa rango [date, date + 1) para evitar problemas con zonas horarias.
 * Resuelve driverId de forma robusta.
 */
const getDriverPaymentsSummary = async (req, res) => {
  try {
    const driverId = await resolveDriverId(req);

    const date = req.query.date || new Date().toISOString().slice(0, 10);
    console.log('getDriverPaymentsSummary -> driverId:', driverId, 'date:', date);

    const qTotals = `
      SELECT r.id AS route_id, r.name AS route_name, COALESCE(SUM(p.amount), 0)::numeric(10,2) AS total
      FROM routes r
      LEFT JOIN payments p
        ON p.route_id = r.id
        AND p.driver_id = $1
        AND p.created_at >= $2::date
        AND p.created_at < ($2::date + INTERVAL '1 day')
      GROUP BY r.id, r.name
      HAVING COALESCE(SUM(p.amount), 0) > 0
      ORDER BY total DESC
    `;
    const totalsRes = await db.query(qTotals, [driverId, date]);

    const totalRes = await db.query(
      `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total
       FROM payments
       WHERE driver_id = $1
         AND created_at >= $2::date
         AND created_at < ($2::date + INTERVAL '1 day')`,
      [driverId, date]
    );

    const passengersRes = await db.query(
      `SELECT COUNT(*)::int AS passengers_count, COUNT(DISTINCT passenger_id)::int AS unique_passengers
       FROM payments
       WHERE driver_id = $1
         AND created_at >= $2::date
         AND created_at < ($2::date + INTERVAL '1 day')`,
      [driverId, date]
    );

    return res.json({
      totals: totalsRes.rows,
      total: parseFloat(totalRes.rows[0].total) || 0,
      passengers_count: passengersRes.rows[0].passengers_count || 0,
      unique_passengers: passengersRes.rows[0].unique_passengers || 0
    });
  } catch (err) {
    console.error('getDriverPaymentsSummary error:', err && (err.stack || err.message || err));
    const status = err && err.status ? err.status : 500;
    return res.status(status).json({ error: err.message || 'Error al obtener resumen de pagos' });
  }
};

/**
 * GET /api/drivers/notifications
 *
 * Leemos desde la tabla notifications filtrada por user_id.
 */
const getDriverNotifications = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const limit = parseInt(req.query.limit || '5', 10);
    const unreadOnly = String(req.query.unread || 'false').toLowerCase() === 'true';

    const params = [userId, limit];
    let q = `
      SELECT id, title, body, data, read, created_at
      FROM notifications
      WHERE user_id = $1
    `;

    if (unreadOnly) {
      q += ` AND read = false`;
    }

    q += ` ORDER BY created_at DESC LIMIT $2`;

    const result = await db.query(q, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('getDriverNotifications error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
};

module.exports = {
  getDriverProfile,
  getDriverPayments,
  getDriverPaymentsSummary,
  getDriverNotifications
};