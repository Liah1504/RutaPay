const db = require('../config/database');

// =============================================
// FUNCIÓN 1: createRecharge (Registra la Solicitud)
// =============================================
const createRecharge = async (req, res) => {
  const userId = req.user.id;
  const { amount, date, reference } = req.body;

  if (!amount || !date || !reference) {
    return res.status(400).json({ error: "Todos los campos son requeridos." });
  }

  try {
    const result = await db.query(
      `INSERT INTO recharges (user_id, amount, date, reference, status) VALUES ($1, $2, $3, $4, 'pendiente') RETURNING *`,
      [userId, amount, date, reference]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error guardando recarga:', error);
    res.status(500).json({ error: 'Error interno al guardar la recarga.' });
  }
};

// =============================================
// FUNCIÓN 2: getPendingRecharges (Admin)
// =============================================
const getPendingRecharges = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.name as user_name, u.email as user_email FROM recharges r JOIN users u ON r.user_id = u.id WHERE r.status = 'pendiente' ORDER BY r.created_at ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error listando recargas:', error);
    res.status(500).json({ error: 'Error listando recargas' });
  }
};

// =============================================
// FUNCIÓN 3: confirmRecharge (Admin)
// =============================================
const confirmRecharge = async (req, res) => {
  const { id } = req.params;

  try {
    const rec = await db.query(`UPDATE recharges SET status='confirmada' WHERE id=$1 RETURNING *`, [id]);

    if (rec.rows.length === 0) {
      return res.status(404).json({ error: 'Recarga no encontrada' });
    }

    const amount = rec.rows[0].amount;
    const userId = rec.rows[0].user_id;

    await db.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2`,
      [amount, userId]
    );

    res.json({ message: 'Recarga confirmada y saldo sumado.' });

  } catch (error) {
    console.error('❌ Error confirmando recarga:', error);
    res.status(500).json({ error: 'Error confirmando recarga.' });
  }
};

// =============================================
// FUNCIÓN 4: rejectRecharge (Admin)
// - Actualiza status -> 'rechazada'
// - Guarda rejected_reason en recharges.rejected_reason
// - Crea una notificación para el usuario con la razón
// =============================================
const rejectRecharge = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ error: 'La razón del rechazo es requerida.' });
  }

  try {
    // 1) Actualizar la recarga
    const rec = await db.query(
      `UPDATE recharges SET status='rechazada', rejected_reason=$1 WHERE id=$2 RETURNING *`,
      [reason, id]
    );

    if (rec.rows.length === 0) {
      return res.status(404).json({ error: 'Recarga no encontrada' });
    }

    const recharge = rec.rows[0];
    const userId = recharge.user_id;

    // 2) Crear notificación para el usuario (tabla notifications)
    // Asegúrate de tener la tabla `notifications` (te incluyo migration abajo).
    try {
      const title = 'Recarga rechazada';
      const body = `Tu recarga de Bs ${parseFloat(recharge.amount).toFixed(2)} ha sido rechazada. Razón: ${reason}`;
      const data = { recharge_id: recharge.id, amount: recharge.amount };

      await db.query(
        `INSERT INTO notifications (user_id, title, body, data) VALUES ($1, $2, $3, $4)`,
        [userId, title, body, JSON.stringify(data)]
      );
    } catch (notifErr) {
      console.warn('❗ No se pudo crear notificación (pero el rechazo fue aplicado):', notifErr);
      // No abortamos; rechazo ya aplicado
    }

    res.json({ message: 'Recarga rechazada y usuario notificado.' });
  } catch (error) {
    console.error('❌ Error rechazando recarga:', error);
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
      `SELECT id, title, body, data, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo notificaciones:', error);
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