const db = require('../config/database');

console.log('🔀 Cargando driverController (sin updateDriverStatus)');

/**
 * Obtener conductores disponibles (público)
 * GET /api/drivers/available
 */
const getAvailableDrivers = async (req, res) => {
  try {
    const drivers = await db.query(`
      SELECT u.id AS user_id, u.name, u.phone, d.driver_code, d.vehicle_type, d.vehicle_plate, d.is_available
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE d.is_available = true
    `);
    return res.json(drivers.rows);
  } catch (error) {
    console.error('Error obteniendo conductores:', error);
    return res.status(500).json({ error: 'Error al obtener conductores' });
  }
};

/**
 * Obtener perfil del conductor actual
 * GET /api/drivers/profile
 */
const getDriverProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const driver = await db.query(`
      SELECT u.name, u.email, u.phone, u.balance, d.* 
      FROM drivers d 
      JOIN users u ON d.user_id = u.id 
      WHERE d.user_id = $1
    `, [userId]);

    if (driver.rows.length === 0) {
      return res.status(404).json({ error: 'Conductor no encontrado' });
    }

    res.json(driver.rows[0]);
  } catch (error) {
    console.error('Error obteniendo perfil conductor:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

/**
 * Obtener historial de pagos recibidos por el conductor (más recientes primero)
 * GET /api/drivers/payments
 */
const getDriverPayments = async (req, res) => {
  const userId = req.user.id; // users.id del conductor (guardado en payments.driver_id)
  try {
    const q = `
      SELECT p.id, p.amount, p.created_at,
             COALESCE(r.name, 'Sin ruta') AS route_name,
             COALESCE(u.name, 'Pasajero desconocido') AS passenger_name
      FROM payments p
      LEFT JOIN routes r ON p.route_id = r.id
      LEFT JOIN users u ON p.passenger_id = u.id
      WHERE p.driver_id = $1
      ORDER BY p.created_at DESC
      LIMIT 500
    `;
    const result = await db.query(q, [userId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo pagos del conductor:', error);
    return res.status(500).json({ error: 'Error al obtener el historial de pagos' });
  }
};

/**
 * Obtener resumen de ganancias por ruta para una fecha dada (YYYY-MM-DD)
 * GET /api/drivers/payments/summary?date=YYYY-MM-DD
 */
const getDriverPaymentsSummary = async (req, res) => {
  const userId = req.user.id;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  try {
    const q = `
      SELECT r.id AS route_id, r.name AS route_name, COALESCE(SUM(p.amount), 0)::numeric(10,2) AS total
      FROM routes r
      LEFT JOIN payments p
        ON p.route_id = r.id
        AND p.driver_id = $1
        AND p.created_at::date = $2
      GROUP BY r.id, r.name
      HAVING COALESCE(SUM(p.amount), 0) > 0
      ORDER BY total DESC
    `;
    const result = await db.query(q, [userId, date]);

    const totalRes = await db.query(
      'SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total FROM payments WHERE driver_id = $1 AND created_at::date = $2',
      [userId, date]
    );

    return res.json({
      totals: result.rows,
      total: parseFloat(totalRes.rows[0].total) || 0
    });
  } catch (error) {
    console.error('❌ Error obteniendo resumen de pagos por ruta:', error);
    return res.status(500).json({ error: 'Error al obtener resumen de pagos' });
  }
};

module.exports = {
  getAvailableDrivers,
  getDriverProfile,
  getDriverPayments,
  getDriverPaymentsSummary
};