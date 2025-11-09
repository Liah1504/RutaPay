const db = require('../config/database');

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
    console.error('getDriverProfile error:', err);
    return res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

/**
 * GET /api/drivers/payments
 */
const getDriverPayments = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

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
    const result = await db.query(q, [userId]);
    return res.json(result.rows);
  } catch (err) {
    console.error('getDriverPayments error:', err);
    return res.status(500).json({ error: 'Error al obtener el historial de pagos' });
  }
};

/**
 * GET /api/drivers/payments/summary?date=YYYY-MM-DD
 * Usa rango [date, date + 1) para evitar problemas con zonas horarias.
 */
const getDriverPaymentsSummary = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const date = req.query.date || new Date().toISOString().slice(0, 10);
    console.log('getDriverPaymentsSummary -> userId:', userId, 'date:', date);

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
    const totalsRes = await db.query(qTotals, [userId, date]);

    const totalRes = await db.query(
      `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total
       FROM payments
       WHERE driver_id = $1
         AND created_at >= $2::date
         AND created_at < ($2::date + INTERVAL '1 day')`,
      [userId, date]
    );

    const passengersRes = await db.query(
      `SELECT COUNT(*)::int AS passengers_count, COUNT(DISTINCT passenger_id)::int AS unique_passengers
       FROM payments
       WHERE driver_id = $1
         AND created_at >= $2::date
         AND created_at < ($2::date + INTERVAL '1 day')`,
      [userId, date]
    );

    return res.json({
      totals: totalsRes.rows,
      total: parseFloat(totalRes.rows[0].total) || 0,
      passengers_count: passengersRes.rows[0].passengers_count || 0,
      unique_passengers: passengersRes.rows[0].unique_passengers || 0
    });
  } catch (err) {
    console.error('getDriverPaymentsSummary error:', err);
    return res.status(500).json({ error: 'Error al obtener resumen de pagos' });
  }
};

/**
 * GET /api/drivers/notifications
 */
const getDriverNotifications = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const limit = parseInt(req.query.limit || '5', 10);
    const q = `
      SELECT p.id, p.amount, p.created_at,
             COALESCE(u.name, 'Pasajero desconocido') AS passenger_name,
             r.name AS route_name
      FROM payments p
      LEFT JOIN users u ON p.passenger_id = u.id
      LEFT JOIN routes r ON p.route_id = r.id
      WHERE p.driver_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2
    `;
    const result = await db.query(q, [userId, limit]);
    return res.json(result.rows);
  } catch (err) {
    console.error('getDriverNotifications error:', err);
    return res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
};

module.exports = {
  getDriverProfile,
  getDriverPayments,
  getDriverPaymentsSummary,
  getDriverNotifications
};