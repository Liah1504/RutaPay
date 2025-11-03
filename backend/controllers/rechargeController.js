// backend/controllers/rechargeController.js

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
    // Utilizamos una sola línea para la consulta SQL para evitar problemas
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
// FUNCIÓN 3: confirmRecharge (Admin - SIN db.connect)
// =============================================
const confirmRecharge = async (req, res) => {
  const { id } = req.params;
  
  try {
    // 1. Marcar recarga como confirmada (USANDO db.query DIRECTO)
    const rec = await db.query(`UPDATE recharges SET status='confirmada' WHERE id=$1 RETURNING *`, [id]);

    if (rec.rows.length === 0) {
      return res.status(404).json({ error: 'Recarga no encontrada' });
    }

    const amount = rec.rows[0].amount;
    const userId = rec.rows[0].user_id;

    // 2. Sumar saldo al usuario (USANDO db.query DIRECTO)
    await db.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2`,
      [amount, userId]
    );
    
    res.json({ message: 'Recarga confirmada y saldo sumado.' });

  } catch (error) {
    console.error('❌ Error confirmando recarga:', error);
    // Si la primera consulta falla, la segunda nunca se ejecuta.
    res.status(500).json({ error: 'Error confirmando recarga.' });
  }
};

// =============================================
// EXPORTACIONES 
// =============================================
module.exports = { 
    createRecharge, 
    getPendingRecharges, 
    confirmRecharge 
};