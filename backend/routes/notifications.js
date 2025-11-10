const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/notifications?limit=XX  -> devuelve notificaciones del usuario autenticado
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const limit = parseInt(req.query.limit || '20', 10);
  if (!userId) return res.status(401).json({ error: 'No autorizado' });

  try {
    const result = await db.query(
      `SELECT id, title, body, data, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo notificaciones:', error);
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
});

// GET /api/notifications/admin?limit=XX&type=payment|recharge  -> LISTAR notificaciones para ADMIN (opcionalmente filtrar por tipo)
router.get('/admin', authenticateToken, async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No autorizado (admin)' });
  }

  const limit = parseInt(req.query.limit || '50', 10);
  const type = req.query.type ? String(req.query.type).toLowerCase() : null;

  try {
    // Base query
    let text = `
      SELECT n.id, n.user_id, u.name as user_name, u.email as user_email,
             n.title, n.body, n.data, n.read, n.created_at
      FROM notifications n
      LEFT JOIN users u ON u.id = n.user_id
    `;
    const params = [];

    // Filtro por tipo si viene en query
    if (type === 'payment' || type === 'payment_received') {
      text += ` WHERE (n.data->>'type' = $1 OR n.title ILIKE $2 OR n.body ILIKE $2)`;
      params.push('payment_received', '%pago%');
    } else if (type === 'recharge' || type === 'recharge_pending' || type === 'recharge_confirmed' || type === 'recharge_rejected') {
      text += ` WHERE (n.data->>'type' = $1 OR n.title ILIKE $2 OR n.body ILIKE $2)`;
      // allow passing 'recharge' to match recharge_pending/confirmed/rejected via data.type or via text 'recarga'
      params.push(type === 'recharge' ? 'recharge_pending' : type, '%recarga%');
    }

    text += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(text, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo notificaciones (admin):', error);
    res.status(500).json({ error: 'Error obteniendo notificaciones (admin)' });
  }
});

// PUT /api/notifications/:id/read -> marcar notificación como leída (solo si le pertenece al user o admin)
router.put('/:id/read', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'No autorizado' });

  try {
    // Si es admin puede marcar cualquier notificación como leída
    if (req.user.role === 'admin') {
      await db.query(`UPDATE notifications SET read = true WHERE id = $1`, [id]);
      return res.json({ message: 'Marcada como leída (admin)' });
    }

    const check = await db.query(`SELECT id FROM notifications WHERE id=$1 AND user_id=$2`, [id, userId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Notificación no encontrada' });

    await db.query(`UPDATE notifications SET read = true WHERE id = $1`, [id]);
    res.json({ message: 'Marcada como leída' });
  } catch (error) {
    console.error('Error marcando notificación read:', error);
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;