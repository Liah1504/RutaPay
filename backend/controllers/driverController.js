// backend/controllers/driversController.js
// CONTROLADOR DE CONDUCTORES (versión para driver_code)
// Busca historial por driver_code o resuelve driver_code desde el usuario autenticado.

const db = require('../config/database');

/**
 * Resuelve driver_code (string) desde query/params o desde req.user (drivers.user_id).
 * Lanza Error con .status cuando aplica.
 */
const resolveDriverCode = async (req) => {
  const driverCodeQuery = req.query?.driver_code || req.params?.driver_code;
  if (driverCodeQuery) {
    const d = await db.query('SELECT driver_code FROM drivers WHERE driver_code = $1 LIMIT 1', [driverCodeQuery]);
    if (d.rows.length === 0) {
      const e = new Error('Conductor no encontrado por driver_code');
      e.status = 404;
      throw e;
    }
    return d.rows[0].driver_code;
  }

  const userId = req.user?.id;
  if (!userId) {
    const e = new Error('Usuario no autenticado');
    e.status = 401;
    throw e;
  }
  const d = await db.query('SELECT driver_code FROM drivers WHERE user_id = $1 LIMIT 1', [userId]);
  if (d.rows.length === 0) {
    const e = new Error('No se encontró conductor para este usuario');
    e.status = 404;
    throw e;
  }
  return d.rows[0].driver_code;
};

/**
 * GET /api/drivers/profile
 * Devuelve información del conductor (fila drivers + datos del usuario).
 */
const getDriverProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const q = `
      SELECT u.id as user_id, u.name, u.email, u.phone, u.balance,
             d.id as driver_row_id, d.driver_code, d.license_number, d.vehicle_type, d.vehicle_plate,
             d.is_available, d.current_location, d.rating, d.total_trips, d.created_at as driver_created_at, d.updated_at as driver_updated_at
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE d.user_id = $1
      LIMIT 1
    `;
    const result = await db.query(q, [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Conductor no encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('getDriverProfile error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

/**
 * GET /api/drivers/payments
 * Busca payments por driver_code (string). También permite paginación limit/offset.
 */
const getDriverPayments = async (req, res) => {
  try {
    const driverCode = await resolveDriverCode(req);

    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit || '500', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

    const q = `
      SELECT p.id, p.amount, p.created_at,
             p.driver_code,
             r.id AS route_id, COALESCE(r.name,'Sin ruta') AS route_name,
             u_pass.id AS passenger_id, COALESCE(u_pass.name,'Pasajero desconocido') AS passenger_name
      FROM payments p
      LEFT JOIN routes r ON p.route_id = r.id
      LEFT JOIN users u_pass ON p.passenger_id = u_pass.id
      WHERE p.driver_code = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await db.query(q, [driverCode, limit, offset]);
    return res.json(result.rows);
  } catch (err) {
    console.error('getDriverPayments error', err && (err.stack || err.message || err));
    const status = err?.status || 500;
    return res.status(status).json({ error: err.message || 'Error obteniendo pagos' });
  }
};

/**
 * GET /api/drivers/payments/summary?date=YYYY-MM-DD
 * Resumen por día usando driver_code para filtrar.
 */
const getDriverPaymentsSummary = async (req, res) => {
  try {
    const driverCode = await resolveDriverCode(req);

    const date = req.query.date || new Date().toISOString().slice(0, 10);
    console.log('getDriverPaymentsSummary -> driverCode:', driverCode, 'date:', date);

    const qTotals = `
      SELECT r.id AS route_id, r.name AS route_name, COALESCE(SUM(p.amount), 0)::numeric(10,2) AS total
      FROM routes r
      LEFT JOIN payments p
        ON p.route_id = r.id
        AND p.driver_code = $1
        AND p.created_at >= $2::date
        AND p.created_at < ($2::date + INTERVAL '1 day')
      GROUP BY r.id, r.name
      HAVING COALESCE(SUM(p.amount), 0) > 0
      ORDER BY total DESC
    `;
    const totalsRes = await db.query(qTotals, [driverCode, date]);

    const totalRes = await db.query(
      `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total
       FROM payments
       WHERE driver_code = $1
         AND created_at >= $2::date
         AND created_at < ($2::date + INTERVAL '1 day')`,
      [driverCode, date]
    );

    const passengersRes = await db.query(
      `SELECT COUNT(*)::int AS passengers_count, COUNT(DISTINCT passenger_id)::int AS unique_passengers
       FROM payments
       WHERE driver_code = $1
         AND created_at >= $2::date
         AND created_at < ($2::date + INTERVAL '1 day')`,
      [driverCode, date]
    );

    return res.json({
      totals: totalsRes.rows,
      total: parseFloat(totalRes.rows[0].total) || 0,
      passengers_count: passengersRes.rows[0].passengers_count || 0,
      unique_passengers: passengersRes.rows[0].unique_passengers || 0
    });
  } catch (err) {
    console.error('getDriverPaymentsSummary error:', err && (err.stack || err.message || err));
    const status = err?.status || 500;
    return res.status(status).json({ error: err.message || 'Error al obtener resumen de pagos' });
  }
};

/**
 * GET /api/drivers/notifications
 * Lee las notificaciones desde la tabla notifications para el user_id autenticado.
 */
const getDriverNotifications = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '5', 10)));
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