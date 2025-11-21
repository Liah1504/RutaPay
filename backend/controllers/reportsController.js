// backend/controllers/reportsController.js
// Reporte: total de pagos recibidos por día agrupado por driver_code
// Devuelve: driver_name, driver_code, driver_phone, day, total_received

const db = require('../config/database');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS_RANGE = 365; // ajustable

async function driverDailyBalancesByCode(req, res) {
  try {
    const { from, to } = req.query;

    // Validación básica de fechas (YYYY-MM-DD)
    if (!from || !to || !DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
      return res.status(400).json({ error: 'Parámetros "from" y "to" requeridos en formato YYYY-MM-DD.' });
    }

    const fromDate = new Date(from + 'T00:00:00Z');
    const toDate = new Date(to + 'T00:00:00Z');
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'Fechas inválidas.' });
    }
    if (fromDate > toDate) {
      return res.status(400).json({ error: '"from" debe ser anterior o igual a "to".' });
    }

    // Límite de rango (seguridad)
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((toDate - fromDate) / msPerDay) + 1;
    if (days > MAX_DAYS_RANGE) {
      return res.status(400).json({ error: `Rango demasiado grande. Máximo ${MAX_DAYS_RANGE} días.` });
    }

    // Expresión única para driver_code (evita ambigüedad entre p.driver_code y d.driver_code)
    const driverCodeExpr = `COALESCE(NULLIF(COALESCE(d.driver_code, p.driver_code), ''), p.driver_id::text)`;

    // Query: sumar amounts por driver_code y día.
    // Filtros: amount > 0 y excluir driver_code placeholders que empiecen por 'deleted_'
    const sql = `
      SELECT
        ${driverCodeExpr} AS driver_code,
        COALESCE(u.name, 'Desconocido') AS driver_name,
        COALESCE(u.phone, '') AS driver_phone,
        (p.created_at::date) AS day,
        COUNT(*)::int AS payments_count,
        COALESCE(SUM(p.amount),0)::numeric(12,2) AS total_received
      FROM payments p
      LEFT JOIN drivers d ON d.id = p.driver_id
      LEFT JOIN users u ON u.id = COALESCE(d.user_id, p.driver_id)
      WHERE p.created_at >= $1::date
        AND p.created_at < ($2::date + INTERVAL '1 day')
        AND COALESCE(p.amount, 0) > 0
        AND NOT (COALESCE(p.driver_code,'') LIKE 'deleted_%')
      GROUP BY ${driverCodeExpr}, (p.created_at::date), u.name, u.phone
      ORDER BY (p.created_at::date) DESC, driver_code;
    `;

    const { rows } = await db.query(sql, [from, to]);

    // Normalizar salida (devuelve solo los campos que necesita el frontend)
    const out = rows.map(r => ({
      driver_name: r.driver_name,
      driver_code: r.driver_code,
      driver_phone: r.driver_phone,
      day: r.day,
      payments_count: r.payments_count,
      total_received: parseFloat(r.total_received)
    }));

    return res.json({ data: out });
  } catch (err) {
    console.error('driverDailyBalancesByCode error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { driverDailyBalancesByCode };