// backend/controllers/reportsController.js
// Reportes relacionados con trips (balance diario por driver_code)

const db = require('../config/database');

/**
 * GET /admin/reports/driver-daily-balances?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Devuelve balance por día agrupado por driver_code.
 *
 * Lógica:
 * - Usa t.driver_code si existe.
 * - Si no existe, intenta u.driver_code (en tabla users).
 * - Si tampoco existe, usa t.driver_id como fallback (cast a texto).
 *
 * Parámetros:
 * - from (obligatorio) YYYY-MM-DD
 * - to   (obligatorio) YYYY-MM-DD
 */
async function driverDailyBalancesByCode(req, res) {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Parámetros "from" y "to" requeridos (YYYY-MM-DD).' });
    }

    const sql = `
      SELECT
        COALESCE(NULLIF(t.driver_code,''), NULLIF(u.driver_code,''), t.driver_id::text) AS driver_code,
        DATE(t.created_at) AS day,
        COUNT(*) AS trips_count,
        SUM(COALESCE(t.fare,0))::numeric(12,2) AS total_fare,
        SUM(COALESCE(t.tip,0))::numeric(12,2) AS total_tips,
        SUM(COALESCE(t.discount,0))::numeric(12,2) AS total_discounts,
        SUM( (COALESCE(t.fare,0) + COALESCE(t.tip,0) - COALESCE(t.discount,0)) )::numeric(12,2) AS gross_amount,
        SUM( (COALESCE(t.fare,0) - COALESCE(t.commission,0)) + COALESCE(t.tip,0) - COALESCE(t.discount,0) )::numeric(12,2) AS driver_earning
      FROM trips t
      LEFT JOIN users u ON u.id = t.driver_id
      WHERE (t.status = 'completed' OR t.status = 'finished' OR t.status = 'done' OR t.is_completed = true)
        AND t.created_at >= $1::date
        AND t.created_at < ($2::date + INTERVAL '1 day')
      GROUP BY COALESCE(NULLIF(t.driver_code,''), NULLIF(u.driver_code,''), t.driver_id::text), DATE(t.created_at)
      ORDER BY DATE(t.created_at) DESC, driver_code;
    `;

    const { rows } = await db.query(sql, [from, to]);
    return res.json({ data: rows });
  } catch (err) {
    console.error('driverDailyBalancesByCode error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  driverDailyBalancesByCode,
};