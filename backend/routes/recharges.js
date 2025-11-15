const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Preferimos usar el controller si existe
let rechargesController = null;
try {
  // eslint-disable-next-line global-require
  rechargesController = require('../controllers/rechargeController');
} catch (err) {
  // controller no disponible → fallback más abajo
}

const db = require('../config/database');

/* -------------------------------------------------------------------------- */
/* Usar controller si existe                                                   */
/* -------------------------------------------------------------------------- */
if (rechargesController
  && typeof rechargesController.createRecharge === 'function'
  && typeof rechargesController.getPendingRecharges === 'function'
  && typeof rechargesController.confirmRecharge === 'function'
  && typeof rechargesController.rejectRecharge === 'function'
) {
  router.post('/', authenticateToken, rechargesController.createRecharge);
  router.get('/', authenticateToken, async (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    try {
      const result = await require('../config/database').query(
        `SELECT id, user_id, amount, reference, status, created_at
         FROM recharges
         ORDER BY created_at DESC
         LIMIT $1`, [limit]
      );
      return res.json(result.rows);
    } catch (err) {
      console.error('GET /api/recharges error (fallback):', err && (err.stack || err.message || err));
      return res.status(500).json({ error: 'Error obteniendo recargas' });
    }
  });

  router.get('/pending', authenticateToken, rechargesController.getPendingRecharges);
  router.put('/:id/confirm', authenticateToken, rechargesController.confirmRecharge);
  router.post('/:id/reject', authenticateToken, rechargesController.rejectRecharge);

  module.exports = router;
  return;
}

/* -------------------------------------------------------------------------- */
/* Fallback inline (si no existe controller)                                   */
/* -------------------------------------------------------------------------- */
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const { amount, reference } = req.body || {};
  if (!userId) return res.status(401).json({ error: 'No autorizado' });
  if (!amount) return res.status(400).json({ error: 'Amount es requerido' });

  try {
    // <-- Cambio: usar 'pendiente' en lugar de 'pending' para respetar la constraint DB
    const r = await db.query(
      `INSERT INTO recharges (user_id, amount, reference, status, created_at)
       VALUES ($1, $2, $3, 'pendiente', now())
       RETURNING *`,
      [userId, amount, reference || null]
    );

    // intentar crear notificación (no crítico)
    try {
      const title = 'Recarga enviada';
      const body = `Tu recarga de Bs ${parseFloat(amount).toFixed(2)} (ref ${reference || '—'}) fue enviada y está pendiente de aprobación.`;
      const data = { type: 'recharge_pending', recharge_id: r.rows[0].id, amount, reference, user_id: userId };
      await db.query(
        `INSERT INTO notifications (user_id, title, body, data, read, created_at)
         VALUES ($1, $2, $3, $4::jsonb, false, now())`,
        [userId, title, body, JSON.stringify(data)]
      );
    } catch (e) {
      console.warn('recharges fallback: no se pudo crear notificación', e && (e.message || e));
    }
    return res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('POST /api/recharges error (fallback):', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error guardando recarga', details: err && (err.message || String(err)) });
  }
});

// GET /pending, PUT /confirm y POST /:id/reject (igual que antes, con status en español)
router.get('/pending', authenticateToken, async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  try {
    const result = await db.query(
      `SELECT r.id, r.user_id, u.name AS user_name, u.email AS user_email,
              r.amount, r.reference, r.status, r.created_at
       FROM recharges r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.status = 'pendiente'
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/recharges/pending (fallback) error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'Error obteniendo recargas pendientes' });
  }
});

router.put('/:id/confirm', authenticateToken, async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    await db.query('UPDATE recharges SET status=$1, updated_at=now() WHERE id = $2', ['confirmada', id]);
    res.json({ message: 'Recarga confirmada' });
  } catch (err) {
    console.error('PUT /api/recharges/:id/confirm (fallback) error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'Error confirmando recarga' });
  }
});

router.post('/:id/reject', authenticateToken, async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  const id = parseInt(req.params.id, 10);
  const { reason } = req.body || {};
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    await db.query('UPDATE recharges SET status=$1, updated_at=now() WHERE id = $2', ['rechazada', id]);
    res.json({ message: 'Recarga rechazada' });
  } catch (err) {
    console.error('POST /api/recharges/:id/reject (fallback) error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'Error rechazando recarga' });
  }
});

module.exports = router;