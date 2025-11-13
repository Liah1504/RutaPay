const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * This routes file prefers using a dedicated controller if it exists at
 * backend/controllers/notificationsController.js. If that controller is not
 * present or does not export the expected handlers, the file falls back to
 * inline implementations that are fully compatible with the previous behavior.
 *
 * Endpoints:
 *  - GET  /api/notifications?limit=XX[&unread=true]   -> list user's notifications
 *  - GET  /api/notifications/admin?limit=XX[&type=...] -> admin listing (requires admin)
 *  - PUT  /api/notifications/:id/read                -> mark notification as read (returns { notification, unread_count })
 */

// If you have a controller file, prefer using it to keep routes thin.
let notificationsController = null;
try {
  // eslint-disable-next-line global-require
  notificationsController = require('../controllers/notificationsController');
} catch (err) {
  // controller not available -> fallback to inline handlers below
}

/* -------------------------------------------------------------------------- */
/* Use controller handlers when available                                      */
/* -------------------------------------------------------------------------- */
if (notificationsController
  && typeof notificationsController.getNotificationsForUser === 'function'
  && typeof notificationsController.markNotificationAsRead === 'function'
) {
  router.get('/', authenticateToken, notificationsController.getNotificationsForUser);
  router.get('/admin', authenticateToken, notificationsController.getNotificationsForAdmin);
  router.put('/:id/read', authenticateToken, notificationsController.markNotificationAsRead);

  module.exports = router;
  // End early since controller will handle logic
  return;
}

/* -------------------------------------------------------------------------- */
/* Inline fallback handlers (compatible behavior)                              */
/* -------------------------------------------------------------------------- */

/*
 GET /api/notifications?limit=XX[&unread=true]
 Returns notifications for the authenticated user. If unread=true, only unread ones.
*/
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const limit = parseInt(req.query.limit || '20', 10);
  const unreadOnly = String(req.query.unread || 'false').toLowerCase() === 'true';

  if (!userId) return res.status(401).json({ error: 'No autorizado' });

  try {
    let text = `
      SELECT id, title, body, data, read, created_at
      FROM notifications
      WHERE user_id = $1
    `;
    const params = [userId];

    if (unreadOnly) {
      text += ` AND read = false`;
    }

    text += ` ORDER BY created_at DESC LIMIT $2`;
    params.push(limit);

    const result = await db.query(text, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo notificaciones:', error && (error.stack || error.message || error));
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
});

/*
 GET /api/notifications/admin?limit=XX&type=payment|recharge
 Admin listing (requires admin role). Optional `type` filter.
*/
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

    // Filter by type if provided
    if (type === 'payment' || type === 'payment_received') {
      text += ` WHERE (n.data->>'type' = $1 OR n.title ILIKE $2 OR n.body ILIKE $2)`;
      params.push('payment', '%pago%');
    } else if (type === 'recharge' || type === 'recharge_pending' || type === 'recharge_confirmed' || type === 'recharge_rejected') {
      text += ` WHERE (n.data->>'type' = $1 OR n.title ILIKE $2 OR n.body ILIKE $2)`;
      params.push(type === 'recharge' ? 'recharge_pending' : type, '%recarga%');
    }

    text += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(text, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo notificaciones (admin):', error && (error.stack || error.message || error));
    res.status(500).json({ error: 'Error obteniendo notificaciones (admin)' });
  }
});

/*
 PUT /api/notifications/:id/read
 Mark a notification as read if owned by the authenticated user (or admin).
 Returns { notification, unread_count } so frontend can update badge without full re-fetch.
*/
router.put('/:id/read', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'No autorizado' });

  try {
    const check = await db.query(`SELECT id, user_id, read FROM notifications WHERE id = $1`, [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Notificación no encontrada' });

    const row = check.rows[0];
    if (req.user.role !== 'admin' && row.user_id !== userId) {
      return res.status(403).json({ error: 'No autorizado para modificar esta notificación' });
    }

    // If already read, return current state and count
    if (row.read) {
      const cntRes = await db.query(`SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND read = false`, [row.user_id]);
      const notifRes = await db.query(`SELECT id, title, body, data, read, created_at FROM notifications WHERE id = $1`, [id]);
      return res.json({ notification: notifRes.rows[0] || null, unread_count: cntRes.rows[0]?.unread_count || 0 });
    }

    // Mark read
    await db.query(`UPDATE notifications SET read = true WHERE id = $1`, [id]);

    // Return updated notification and unread count
    const notifRes = await db.query(`SELECT id, title, body, data, read, created_at FROM notifications WHERE id = $1`, [id]);
    const cntRes = await db.query(`SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND read = false`, [row.user_id]);
    const unread_count = cntRes.rows[0]?.unread_count || 0;

    return res.json({ notification: notifRes.rows[0] || null, unread_count });
  } catch (error) {
    console.error('Error marcando notificación read:', error && (error.stack || error.message || error));
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;