const db = require('../config/database');

/**
 * GET /api/notifications?limit=XX[&unread=true]
 * Devuelve las notificaciones del usuario autenticado. Si unread=true devuelve solo no leídas.
 */
const getNotificationsForUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autorizado' });

    const limit = parseInt(req.query.limit || '20', 10);
    const unreadOnly = String(req.query.unread || 'false').toLowerCase() === 'true';

    const params = [userId, limit];
    let q = `
      SELECT id, title, body, data, read, created_at
      FROM notifications
      WHERE user_id = $1
    `;

    if (unreadOnly) q += ` AND read = false`;
    q += ` ORDER BY created_at DESC LIMIT $2`;

    const result = await db.query(q, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('getNotificationsForUser error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Marca la notificación como leída si pertenece al usuario o si es admin.
 * Devuelve { notification, unread_count } para actualizar badge sin re-fetch completo.
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const notifId = parseInt(req.params.id, 10);
    if (Number.isNaN(notifId)) return res.status(400).json({ error: 'ID inválido' });

    // Verificar existencia
    const check = await db.query('SELECT id, user_id, read FROM notifications WHERE id = $1', [notifId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Notificación no encontrada' });

    const row = check.rows[0];
    // permiso: admin puede marcar cualquier notificación
    if (row.user_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta notificación' });
    }

    // Si ya estaba leída, devolver estado actual y contador
    if (row.read) {
      const cntRes = await db.query('SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND read = false', [row.user_id]);
      const notifRes = await db.query('SELECT id, title, body, data, read, created_at FROM notifications WHERE id = $1', [notifId]);
      return res.json({ notification: notifRes.rows[0] || null, unread_count: cntRes.rows[0]?.unread_count || 0 });
    }

    // Marcar como leída
    await db.query('UPDATE notifications SET read = true WHERE id = $1', [notifId]);

    // Devolver notificación actualizada y contador no leídas
    const notifRes = await db.query('SELECT id, title, body, data, read, created_at FROM notifications WHERE id = $1', [notifId]);
    const cntRes = await db.query('SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND read = false', [row.user_id]);
    const unread_count = cntRes.rows[0]?.unread_count || 0;

    return res.json({ notification: notifRes.rows[0] || null, unread_count });
  } catch (err) {
    console.error('markNotificationAsRead error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error al marcar notificación' });
  }
};

/**
 * GET /api/notifications/admin?limit=XX&type=...
 * Vista para admin (opcional). Filtra por tipo si se envía.
 */
const getNotificationsForAdmin = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado (admin)' });

    const limit = parseInt(req.query.limit || '50', 10);
    const type = req.query.type ? String(req.query.type).toLowerCase() : null;

    let text = `
      SELECT n.id, n.user_id, u.name as user_name, u.email as user_email,
             n.title, n.body, n.data, n.read, n.created_at
      FROM notifications n
      LEFT JOIN users u ON u.id = n.user_id
    `;
    const params = [];

    if (type === 'payment' || type === 'payment_received') {
      text += ` WHERE (n.data->>'type' = $1 OR n.title ILIKE $2 OR n.body ILIKE $2)`;
      params.push('payment', '%pago%');
    } else if (type && (type.startsWith('recharge') || type === 'recharge')) {
      text += ` WHERE (n.data->>'type' = $1 OR n.title ILIKE $2 OR n.body ILIKE $2)`;
      params.push(type === 'recharge' ? 'recharge_pending' : type, '%recarga%');
    }

    text += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(text, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('getNotificationsForAdmin error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error al obtener notificaciones (admin)' });
  }
};

module.exports = {
  getNotificationsForUser,
  markNotificationAsRead,
  getNotificationsForAdmin
};