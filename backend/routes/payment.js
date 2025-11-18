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
 * GET /api/payment
 * - soporta:
 *    - start & end (ISO UTC) => p.created_at BETWEEN start AND end  (recomendado)
 *    - date=YYYY-MM-DD (legacy) => DATE(p.created_at) = date  (mantener compatibilidad)
 * - Admin puede filtrar por userId
 * - Usuarios normales verán solo sus pagos (se usa la columna detectada)
 *
 * La consulta se arma dinámicamente según las columnas existentes para evitar errores.
 */
router.get('/', authenticateToken, async (req, res) => {
  const user = req.user;
  const start = req.query.start ? String(req.query.start) : null; // ISO UTC start
  const end = req.query.end ? String(req.query.end) : null;       // ISO UTC end
  const date = req.query.date ? String(req.query.date) : null;    // legacy YYYY-MM-DD
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

    // Construir SELECT dinámico (con columnas que realmente existen)
    const selectParts = [];
    selectParts.push('p.id');
    selectParts.push(`p.${userCol} AS user_id`);

    if (columns.includes('amount')) selectParts.push('p.amount');
    if (columns.includes('created_at')) selectParts.push('p.created_at');
    if (columns.includes('reference')) selectParts.push('p.reference');
    if (columns.includes('method')) selectParts.push('p.method');
    if (columns.includes('note')) selectParts.push('p.note');
    if (columns.includes('data')) selectParts.push('p.data');

    const hasDriverId = columns.includes('driver_id');
    const hasRouteId = columns.includes('route_id');
    if (hasDriverId) selectParts.push('p.driver_id');
    if (hasRouteId) selectParts.push('p.route_id');

    // Preparar joins si existen columnas relacionadas
    const joinClauses = [];
    const extraSelects = [];
    if (hasDriverId) {
      // CORRECCIÓN: resolver el nombre del conductor a través de drivers -> users
      // en vez de unir directamente users ON p.driver_id (que puede devolver el nombre de un user si driver_id coincide con users.id)
      joinClauses.push('LEFT JOIN drivers d ON d.id = p.driver_id');
      joinClauses.push('LEFT JOIN users du ON du.id = d.user_id');
      extraSelects.push('du.name AS driver_name');
    }
    if (hasRouteId) {
      joinClauses.push('LEFT JOIN routes r ON r.id = p.route_id');
      extraSelects.push('r.name AS route_name');
    }

    // Montar consulta final
    const allSelects = [...extraSelects, ...selectParts];
    let text = `SELECT ${allSelects.join(', ')} FROM payments p`;
    if (joinClauses.length > 0) text += ' ' + joinClauses.join(' ');

    // WHERE conditions & params
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

    // Preferir start/end (más preciso con zonas horarias). Si no están,
    // aceptar legacy date param (DATE(created_at) = 'YYYY-MM-DD').
    if (start && end) {
      params.push(start);
      where.push(`p.created_at >= $${params.length}`);
      params.push(end);
      where.push(`p.created_at <= $${params.length}`);
    } else if (date) {
      // Legacy behavior (kept for compatibility)
      params.push(date);
      where.push(`DATE(p.created_at) = $${params.length}`);
    }

    if (where.length > 0) text += ' WHERE ' + where.join(' AND ');

    text += ' ORDER BY p.created_at DESC LIMIT 200';

    const result = await db.query(text, params);

    // Normalizar salida: ensure driver_name / route_name keys exist (may be undefined)
    const rows = result.rows.map(r => {
      if (hasDriverId && !('driver_name' in r)) r.driver_name = null;
      if (hasRouteId && !('route_name' in r)) r.route_name = null;
      return r;
    });

    return res.json(rows);
  } catch (err) {
    console.error('[GET /api/payment] Unexpected error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error obteniendo historial de pagos' });
  }
});

module.exports = router;