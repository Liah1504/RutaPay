const db = require('../config/database');

const isDev = process.env.NODE_ENV !== 'production';

/**
 * createRecharge
 * POST /api/recharges
 * Crea una recarga en estado 'pendiente' y notifica a usuario/admins.
 */
const createRecharge = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'No autorizado' });

  const { amount, reference } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount es requerido' });

  try {
    // Insertar la recarga con estado en español ('pendiente')
    const insertQ = `
      INSERT INTO recharges (user_id, amount, reference, status, created_at)
      VALUES ($1, $2, $3, 'pendiente', NOW())
      RETURNING *
    `;
    const r = await db.query(insertQ, [userId, amount, reference || null]);
    const recharge = r.rows[0];

    // Notificar al usuario 
    try {
      const titleUser = 'Recarga enviada';
      const bodyUser = `Tu recarga de Bs ${parseFloat(amount).toFixed(2)} (ref ${reference || '—'}) fue enviada y está pendiente de aprobación.`;
      const dataUser = { type: 'recharge_pending', recharge_id: recharge.id, amount, reference, user_id: userId };

      await db.query(
        `INSERT INTO notifications (user_id, title, body, data, read, created_at)
         VALUES ($1, $2, $3, $4::jsonb, false, now())`,
        [userId, titleUser, bodyUser, JSON.stringify(dataUser)]
      );
    } catch (notifUserErr) {
      console.warn('createRecharge: fallo creando notificación usuario:', notifUserErr && (notifUserErr.stack || notifUserErr.message || notifUserErr));
    }

    // Notificar a administradores
    try {
      const titleAdmin = 'Nueva recarga pendiente';
      const bodyAdmin = `El usuario ID ${userId} solicitó una recarga de Bs ${parseFloat(amount).toFixed(2)} (ref ${reference || '—'}).`;
      const dataAdmin = { type: 'recharge_pending', recharge_id: recharge.id, amount, reference, user_id: userId };

      const adminsRes = await db.query(`SELECT id FROM users WHERE role = 'admin'`);
      const admins = adminsRes.rows || [];
      for (const a of admins) {
        try {
          await db.query(
            `INSERT INTO notifications (user_id, title, body, data, read, created_at)
             VALUES ($1, $2, $3, $4::jsonb, false, now())`,
            [a.id, titleAdmin, bodyAdmin, JSON.stringify(dataAdmin)]
          );
        } catch (perAdminErr) {
          console.warn('createRecharge: fallo creando notificación admin para user_id=', a.id, perAdminErr && (perAdminErr.message || perAdminErr));
        }
      }
    } catch (notifAdminErr) {
      console.warn('createRecharge: error generando notificaciones admin:', notifAdminErr && (notifAdminErr.stack || notifAdminErr.message || notifAdminErr));
    }

    return res.status(201).json(recharge);
  } catch (error) {
    console.error('createRecharge error:', error && (error.stack || error.message || error));

    // Si el error es por la constraint de status, intentamos fallback sin especificar status
    const msg = String(error && (error.message || error));
    if (msg.toLowerCase().includes('viol') && msg.toLowerCase().includes('status')) {
      try {
        console.warn('createRecharge: fallo por CHECK status -> intentando INSERT sin status para usar el default de BD');
        const insertQ2 = `
          INSERT INTO recharges (user_id, amount, reference, created_at)
          VALUES ($1, $2, $3, NOW())
          RETURNING *
        `;
        const r2 = await db.query(insertQ2, [userId, amount, reference || null]);
        const recharge2 = r2.rows[0];

        // Notificar usuario/admin (opcional) - intentar en background
        try {
          const titleUser = 'Recarga enviada';
          const bodyUser = `Tu recarga de Bs ${parseFloat(amount).toFixed(2)} (ref ${reference || '—'}) fue enviada y está pendiente de aprobación.`;
          const dataUser = { type: 'recharge_pending', recharge_id: recharge2.id, amount, reference, user_id: userId };
          await db.query(
            `INSERT INTO notifications (user_id, title, body, data, read, created_at)
             VALUES ($1, $2, $3, $4::jsonb, false, now())`,
            [userId, titleUser, bodyUser, JSON.stringify(dataUser)]
          );
        } catch (notifUserErr) {
          console.warn('createRecharge (fallback): no se pudo crear notificación para usuario', notifUserErr && (notifUserErr.message || notifUserErr));
        }

        return res.status(201).json(recharge2);
      } catch (err2) {
        console.error('createRecharge (fallback) ERROR:', err2 && (err2.stack || err2.message || err2));
        return res.status(500).json({ error: 'Error guardando recarga (fallback)', details: err2 && (err2.message || String(err2)) });
      }
    }

    return res.status(500).json({ error: 'Error guardando recarga', details: msg });
  }
};


/**
 * getPendingRecharges
 * GET /api/recharges/pending
 * Devuelve recargas pendientes (admin)
 */
const getPendingRecharges = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  try {
    const result = await db.query(
      `SELECT r.id, r.user_id, u.name AS user_name, u.email AS user_email,
              r.amount, r.reference, r.status, r.created_at
       FROM recharges r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.status = 'pendiente'
       ORDER BY r.created_at DESC
       LIMIT 200`
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('getPendingRecharges error:', error && (error.stack || error.message || error));
    return res.status(500).json({ error: 'Error obteniendo recargas pendientes' });
  }
};


/**
 * confirmRecharge
 * PUT /api/recharges/:id/confirm
 * Admin confirma la recarga: actualiza status = 'confirmada', aplica monto al saldo del usuario
 * y notifica al usuario. El proceso es transaccional e intenta ser idempotente (no perder datos).
 */
const confirmRecharge = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado' });

  const rechargeId = parseInt(req.params.id, 10);
  if (Number.isNaN(rechargeId)) return res.status(400).json({ error: 'ID inválido' });

  try {
    await db.query('BEGIN');

    // Lock the recharge row
    const recRes = await db.query('SELECT id, user_id, amount, reference, status FROM recharges WHERE id = $1 FOR UPDATE', [rechargeId]);
    if (recRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Recarga no encontrada' });
    }
    const rec = recRes.rows[0];

    // Determine whether we have already applied the amount.
    // Strategy:
    // 1) If table has 'applied' column, use it.
    // 2) Else, look for an existing 'recharge_confirmed' notification for this recharge_id.
    let applied = false;
    try {
      const colCheck = await db.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'recharges' AND column_name = 'applied' LIMIT 1`
      );
      if (colCheck.rows.length > 0) {
        // read applied flag
        const aRes = await db.query('SELECT applied FROM recharges WHERE id = $1', [rechargeId]);
        applied = !!aRes.rows[0].applied;
      } else {
        // no applied column; check notifications for a confirmed notification for this recharge
        const notifCheck = await db.query(
          `SELECT 1 FROM notifications
           WHERE (data->>'recharge_id') = $1::text
             AND (data->>'type' = 'recharge_confirmed' OR title ILIKE '%Recarga confirmada%')
           LIMIT 1`, [String(rechargeId)]
        );
        applied = notifCheck.rows.length > 0;
      }
    } catch (innerErr) {
      // if any error checking columns/notifications, assume not applied (safe fallback)
      console.warn('confirmRecharge: warning checking applied/notif state:', innerErr && (innerErr.message || innerErr));
      applied = false;
    }

    // If already applied (balance updated) and status is confirmada, nothing to do
    if (rec.status === 'confirmada' && applied) {
      await db.query('COMMIT');
      return res.json({ message: 'Recarga ya confirmada previamente' });
    }

    // Update recharge status and, if available, set applied = true and updated_at.
    try {
      // Try to perform an update that sets applied and updated_at if possible.
      await db.query(
        `UPDATE recharges
         SET status = $1, applied = true, updated_at = now()
         WHERE id = $2`,
        ['confirmada', rechargeId]
      );
    } catch (e) {
      // Fallback if columns do not exist (applied/updated_at)
      await db.query('UPDATE recharges SET status = $1 WHERE id = $2', ['confirmada', rechargeId]);
    }

    // Apply amount to user's balance if not already applied
    if (!applied) {
      // Lock the user row and update balance
      const userId = rec.user_id;
      await db.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

      await db.query(
        `UPDATE users
         SET balance = COALESCE(balance, 0) + $1
         WHERE id = $2`,
        [rec.amount, userId]
      );
    } else {
      // If already applied but status was not 'confirmada', we still ensure status set above.
      // No balance modification to avoid double-apply.
    }

    // Ensure there's a confirmation notification (insert only if not present)
    try {
      const notifExists = await db.query(
        `SELECT 1 FROM notifications
         WHERE (data->>'recharge_id') = $1::text
           AND (data->>'type' = 'recharge_confirmed' OR title ILIKE '%Recarga confirmada%')
         LIMIT 1`,
        [String(rechargeId)]
      );

      if (notifExists.rows.length === 0) {
        const title = 'Recarga confirmada';
        const body = `Tu recarga de Bs ${parseFloat(rec.amount).toFixed(2)} (ref ${rec.reference || '—'}) ha sido aprobada y añadida a tu saldo.`;
        const data = { type: 'recharge_confirmed', recharge_id: rec.id, amount: rec.amount, user_id: rec.user_id };

        await db.query(
          `INSERT INTO notifications (user_id, title, body, data, read, created_at)
           VALUES ($1, $2, $3, $4::jsonb, false, now())`,
          [rec.user_id, title, body, JSON.stringify(data)]
        );
      }
    } catch (notifErr) {
      console.warn('confirmRecharge: no se pudo crear notificación de confirmación:', notifErr && (notifErr.stack || notifErr.message || notifErr));
      // no rollback por fallo de notificación
    }

    await db.query('COMMIT');
    return res.json({ message: 'Recarga confirmada y saldo actualizado' });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    console.error('confirmRecharge error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error confirmando recarga' });
  }
};


/**
 * rejectRecharge
 * POST /api/recharges/:id/reject
 * Admin rechaza la recarga: actualiza estado = 'rechazada' y notifica al usuario.
 * This function will not alter user balances. It's safe and will try to preserve existing data.
 */
const rejectRecharge = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado' });

  const rechargeId = parseInt(req.params.id, 10);
  const { reason } = req.body || {};
  if (Number.isNaN(rechargeId)) return res.status(400).json({ error: 'ID inválido' });

  try {
    await db.query('BEGIN');

    const recRes = await db.query('SELECT id, user_id, amount, reference, status FROM recharges WHERE id = $1 FOR UPDATE', [rechargeId]);
    if (recRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Recarga no encontrada' });
    }
    const rec = recRes.rows[0];

    // Update status to 'rechazada' (try with updated_at if available)
    try {
      await db.query('UPDATE recharges SET status = $1, updated_at = now() WHERE id = $2', ['rechazada', rechargeId]);
    } catch (e) {
      await db.query('UPDATE recharges SET status = $1 WHERE id = $2', ['rechazada', rechargeId]);
    }

    // Insert a rejection notification (do not rollback if notification fails)
    try {
      const title = 'Recarga rechazada';
      const body = `Tu recarga de Bs ${parseFloat(rec.amount).toFixed(2)} (ref ${rec.reference || '—'}) fue rechazada. Razón: ${reason || 'No especificada'}.`;
      const data = { type: 'recharge_rejected', recharge_id: rec.id, amount: rec.amount, reason: reason || null, user_id: rec.user_id };

      await db.query(
        `INSERT INTO notifications (user_id, title, body, data, read, created_at)
         VALUES ($1, $2, $3, $4::jsonb, false, now())`,
        [rec.user_id, title, body, JSON.stringify(data)]
      );
    } catch (notifErr) {
      console.warn('rejectRecharge: no se pudo crear notificación de rechazo:', notifErr && (notifErr.stack || notifErr.message || notifErr));
    }

    await db.query('COMMIT');
    return res.json({ message: 'Recarga rechazada y usuario notificado.' });
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    console.error('rejectRecharge error:', error && (error.stack || error.message || error));
    return res.status(500).json({ error: 'Error rechazando recarga.' });
  }
};


/**
 * getNotificationsForUser (helper)
 */
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
    console.error('getNotificationsForUser error:', error && (error.stack || error.message || error));
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
};

module.exports = {
  createRecharge,
  getPendingRecharges,
  confirmRecharge,
  rejectRecharge,
  getNotificationsForUser
};