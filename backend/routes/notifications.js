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
      `SELECT id, title, body, data, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo notificaciones:', error);
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
});

// PUT /api/notifications/:id/read -> marcar notificación como leída (solo si le pertenece al user)
router.put('/:id/read', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'No autorizado' });

  try {
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