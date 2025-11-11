const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { manualPayment } = require('../controllers/paymentController');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * POST /api/payment/pay
 * (existente) - ejecutar pago (manual)
 */
router.post('/pay', authenticateToken, authorize('passenger'), manualPayment);

/**
 * Devuelve un array con los nombres de columnas existentes en la tabla payments.
 */
async function listPaymentColumns() {
  const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'payments'
    ORDER BY ordinal_position
  `;
  const res = await db.query(q);
  return res.rows.map(r => r.column_name);
}

/**
 * Detectar la columna que se usa para referenciar al usuario/pasajero.
 */
function findUserColumn(columns) {
  const candidates = ['user_id', 'passenger_id', 'payer_id', 'customer_id', 'created_by'];
  for (const c of candidates) if (columns.includes(c)) return c;
  return null;
}

/**
 * GET /api/payment?date=YYYY-MM-DD[&userId=123]
 * - Usuarios normales: filtran por su id (en la columna detectada)
 * - Admin: puede ver todos o filtrar por userId
 *
 * La consulta se arma dinámicamente según las columnas existentes para evitar errores.
 */
router.get('/', authenticateToken, async (req, res) => {
  const user = req.user;
  const date = req.query.date ? String(req.query.date) : null;
  const qUserId = req.query.userId ? parseInt(req.query.userId, 10) : null;

  try {
    const columns = await listPaymentColumns();

    // Determinar columna de usuario
    const userCol = findUserColumn(columns);
    if (!userCol) {
      const msg = 'La tabla "payments" no contiene una columna de usuario compatible (user_id, passenger_id, payer_id, customer_id, created_by).';
      console.error('[GET /api/payment] Error:', msg);
      return res.status(500).json({ error: 'Error interno: columna de usuario no encontrada en payments', message: msg });
    }

    // Construir SELECT dinámico
    const selectCols = ['p.id', `p.${userCol} AS user_id`];

    // Campos base comunes: amount, created_at si existen
    if (columns.includes('amount')) selectCols.push('p.amount');
    if (columns.includes('created_at')) selectCols.push('p.created_at');

    // Campos opcionales: reference, method, note, data
    if (columns.includes('reference')) selectCols.push('p.reference');
    if (columns.includes('method')) selectCols.push('p.method');
    if (columns.includes('note')) selectCols.push('p.note');
    if (columns.includes('data')) selectCols.push('p.data');

    // Include driver_id and route_id if present (and later we'll join for names)
    const hasDriverId = columns.includes('driver_id');
    const hasRouteId = columns.includes('route_id');
    if (hasDriverId) selectCols.push('p.driver_id');
    if (hasRouteId) selectCols.push('p.route_id');

    // Build FROM + optional joins
    let text = `SELECT ${selectCols.join(', ')} FROM payments p`;
    const joinClauses = [];
    // left join users as driver to get driver_name (if driver_id exists)
    if (hasDriverId) {
      joinClauses.push(`LEFT JOIN users d ON d.id = p.driver_id`);
      // select driver name
      text = text.replace('FROM payments p', `FROM payments p LEFT JOIN users d ON d.id = p.driver_id`);
      text = text.replace('SELECT ', 'SELECT ');
      // append driver_name selection if we didn't already request it
      if (!selectCols.includes('d.name AS driver_name')) {
        text = text.replace('FROM payments p', `, d.name AS driver_name FROM payments p`);
      }
    }
    // left join routes to get route_name
    if (hasRouteId) {
      // If we already modified text above, add join accordingly
      if (text.includes('LEFT JOIN users d ON')) {
        text += ` LEFT JOIN routes r ON r.id = p.route_id`;
        text = text.replace('SELECT ', 'SELECT ');
        if (!text.includes('r.name AS route_name')) {
          // insert route_name into select list after IDENTIFICATION of select
          text = text.replace('FROM payments p', `, r.name AS route_name FROM payments p`);
        }
      } else {
        text = text.replace('FROM payments p', `, r.name AS route_name FROM payments p LEFT JOIN routes r ON r.id = p.route_id`);
      }
    }

    // Build WHERE conditions and params
    const where = [];
    const params = [];

    if (user.role === 'admin') {
      if (qUserId) {
        params.push(qUserId);
        where.push(`p.${userCol} = $${params.length}`);
      }
    } else {
      params.push(user.id);
      where.push(`p.${userCol} = $${params.length}`);
    }

    if (date) {
      params.push(date);
      where.push(`DATE(p.created_at) = $${params.length}`);
    }

    if (where.length > 0) {
      text += ' WHERE ' + where.join(' AND ');
    }

    text += ' ORDER BY p.created_at DESC LIMIT 200';

    // Ejecutar consulta
    const result = await db.query(text, params);

    // Normalizar salida: ensure driver_name / route_name keys exist (may be undefined)
    const rows = result.rows.map(r => {
      if (r.driver_name === undefined && r.driver_id !== undefined) r.driver_name = null;
      if (r.route_name === undefined && r.route_id !== undefined) r.route_name = null;
      return r;
    });

    return res.json(rows);
  } catch (err) {
    console.error('[GET /api/payment] Unexpected error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error obteniendo historial de pagos' });
  }
});

module.exports = router;