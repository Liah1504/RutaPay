const db = require('../config/database');

// =============================================
// FUNCIÓN 1: createRecharge (Registra la Solicitud)
// - Inserta recarga y crea una notificación con data.type = 'recharge_pending'
// =============================================
const createRecharge = async (req, res) => {
  const userId = req.user?.id;
  const { amount, date, reference } = req.body;

  if (!userId) return res.status(401).json({ error: 'No autorizado' });
  if (!amount || !date || !reference) {
    return res.status(400).json({ error: "Todos los campos son requeridos." });
  }

  try {
    const result = await db.query(
      `INSERT INTO recharges (user_id, amount, date, reference, status, created_at)
       VALUES ($1, $2, $3, $4, 'pendiente', now())
       RETURNING *`,
      [userId, amount, date, reference]
    );

    const recharge = result.rows[0];

    // Crear notificación para administradores / registro
    try {
      const title = 'Nueva recarga pendiente';
      const body = `El usuario ID ${userId} solicitó una recarga de Bs ${parseFloat(amount).toFixed(2)} (ref ${reference}).`;
      const data = { type: 'recharge_pending', recharge_id: recharge.id, amount, reference, user_id: userId };

      await db.query(
        `INSERT INTO notifications (user_id, title, body, data, read, created_at)
         VALUES ($1, $2, $3, $4, false, now())`,
        [userId, title, body, JSON.stringify(data)]
      );
    } catch (notifErr) {
      console.warn('[createRecharge] No se pudo crear notificación de recarga pendiente:', notifErr && (notifErr.stack || notifErr.message || notifErr));
    }

    res.status(201).json(recharge);
  } catch (error) {
    console.error('❌ Error guardando recarga:', error && (error.stack || error.message || error));
    res.status(500).json({ error: 'Error interno al guardar la recarga.' });
  }
};

// =============================================
// FUNCIÓN 2: getPendingRecharges (Admin)
// =============================================
const getPendingRecharges = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.name as user_name, u.email as user_email
       FROM recharges r
       JOIN users u ON r.user_id = u.id
       WHERE r.status = 'pendiente'
       ORDER BY r.created_at ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error listando recargas:', error && (error.stack || error.message || error));
    res.status(500).json({ error: 'Error listando recargas' });
  }
};

// =============================================
// FUNCIÓN 3: confirmRecharge (Admin)
// - Marca recarga como confirmada, suma saldo al usuario
// - Crea notificación para el usuario con data.type = 'recharge_confirmed'
// Nota: no usamos updated_at para evitar error si la columna no existe
// =============================================
const confirmRecharge = async (req, res) => {
  const { id } = req.params;

  try {
    // Marcar la recarga como confirmada
    const rec = await db.query(
      `UPDATE recharges
       SET status='confirmada'
       WHERE id=$1
       RETURNING *`,
      [id]
    );

    if (rec.rows.length === 0) {
      return res.status(404).json({ error: 'Recarga no encontrada' });
    }

    const recharge = rec.rows[0];
    const amount = parseFloat(recharge.amount);
    const userId = recharge.user_id;

    // Sumar al balance del usuario
    await db.query(
      `UPDATE users SET balance = COALESCE(balance,0) + $1 WHERE id = $2`,
      [amount, userId]
    );

    // Crear notificación para el pasajero confirmando la recarga
    try {
      const title = 'Recarga confirmada';
      const body = `Tu recarga de Bs ${amount.toFixed(2)} ha sido confirmada y sumada a tu balance.`;
      const data = { type: 'recharge_confirmed', recharge_id: recharge.id, amount, user_id: userId };

      await db.query(
        `INSERT INTO notifications (user_id, title, body, data, read, created_at)
         VALUES ($1, $2, $3, $4, false, now())`,
        [userId, title, body, JSON.stringify(data)]
      );
    } catch (notifErr) {
      console.warn('[confirmRecharge] No se pudo crear notificación de recarga confirmada:', notifErr && (notifErr.stack || notifErr.message || notifErr));
    }

    // Responder con la recarga actualizada
    res.json({ message: 'Recarga confirmada y saldo sumado.', recharge: recharge });
  } catch (error) {
    console.error('❌ Error confirmando recarga:', error && (error.stack || error.message || error));
    res.status(500).json({ error: 'Error confirmando recarga.' });
  }
};

// =============================================
// FUNCIÓN 4: rejectRecharge (Admin)
// - Actualiza status -> 'rechazada'
// - Guarda rejected_reason en recharges.rejected_reason
// - Crea una notificación para el usuario con la razón (data.type = 'recharge_rejected')
// =============================================
const rejectRecharge = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ error: 'La razón del rechazo es requerida.' });
  }

  try {
    const rec = await db.query(
      `UPDATE recharges
       SET status='rechazada', rejected_reason=$1
       WHERE id=$2
       RETURNING *`,
      [reason, id]
    );

    if (rec.rows.length === 0) {
      return res.status(404).json({ error: 'Recarga no encontrada' });
    }

    const recharge = rec.rows[0];
    const userId = recharge.user_id;

    // Crear notificación para el usuario
    try {
      const title = 'Recarga rechazada';
      const body = `Tu recarga de Bs ${parseFloat(recharge.amount).toFixed(2)} ha sido rechazada. Razón: ${reason}`;
      const data = { type: 'recharge_rejected', recharge_id: recharge.id, amount: recharge.amount, reason, user_id: userId };

      await db.query(
        `INSERT INTO notifications (user_id, title, body, data, read, created_at)
         VALUES ($1, $2, $3, $4, false, now())`,
        [userId, title, body, JSON.stringify(data)]
      );
    } catch (notifErr) {
      console.warn('❗ No se pudo crear notificación (pero el rechazo fue aplicado):', notifErr && (notifErr.stack || notifErr.message || notifErr));
    }

    res.json({ message: 'Recarga rechazada y usuario notificado.' });
  } catch (error) {
    console.error('❌ Error rechazando recarga:', error && (error.stack || error.message || error));
    res.status(500).json({ error: 'Error rechazando recarga.' });
  }
};

// =============================================
// FUNCIÓN 5: getNotificationsForUser (Pasajero)
// Endpoint: GET /api/notifications
// =============================================
const getNotificationsForUser = async (req, res) => {
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
    console.error('❌ Error obteniendo notificaciones:', error && (error.stack || error.message || error));
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
};

// =============================================
// EXPORTACIONES
// =============================================
module.exports = {
  createRecharge,
  getPendingRecharges,
  confirmRecharge,
  rejectRecharge,
  getNotificationsForUser
};