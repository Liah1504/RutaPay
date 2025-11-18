const db = require('../config/database');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FRONTEND_URL } = process.env;

// transporter (si no hay variables, no fallará aquí; sendMail se atrapará)
const transporter = nodemailer.createTransport({
  host: SMTP_HOST || '',
  port: Number(SMTP_PORT || 587),
  secure: Number(SMTP_PORT || 587) === 465,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
});

const forgotPassword = async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email es requerido' });

  try {
    const userRes = await db.query('SELECT id, name FROM users WHERE email = $1 LIMIT 1', [String(email).trim().toLowerCase()]);
    if (userRes.rows.length === 0) {
      // Responder genérico para no revelar existencia
      return res.json({ message: 'Si existe una cuenta, se ha enviado un código de recuperación al correo.' });
    }

    const user = userRes.rows[0];
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await db.query(
      `INSERT INTO password_resets (user_id, code, expires_at, used, created_at)
       VALUES ($1, $2, $3, false, now())`,
      [user.id, code, expiresAt]
    );

    const html = `
      <p>Hola ${user.name || ''},</p>
      <p>Usa este código para reestablecer tu contraseña (válido 30 minutos):</p>
      <h2>${code}</h2>
      <p>Si no solicitaste este cambio, ignora este correo.</p>
      <p>RutaPay</p>
    `;

    try {
      if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        await transporter.sendMail({
          from: FROM_EMAIL,
          to: email,
          subject: 'Recuperación de contraseña - RutaPay',
          html
        });
      } else {
        // fallback para desarrollo: registrar en consola
        console.info(`passwordController: SMTP no configurado. Código para ${email}: ${code}`);
      }
    } catch (mailErr) {
      console.warn('passwordController: fallo al enviar email (no crítico):', mailErr && mailErr.message);
      console.info(`passwordController: código para ${email}: ${code}`);
    }

    return res.json({ message: 'Si existe una cuenta, se ha enviado un código de recuperación al correo.' });
  } catch (err) {
    console.error('forgotPassword error:', err && (err.stack || err.message));
    return res.status(500).json({ error: 'Error procesando solicitud' });
  }
};

const resetPassword = async (req, res) => {
  const { email, code, password } = req.body || {};
  if (!email || !code || !password) return res.status(400).json({ error: 'email, code y password son requeridos' });

  try {
    const u = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [String(email).trim().toLowerCase()]);
    if (u.rows.length === 0) return res.status(400).json({ error: 'Código inválido o expirado' });
    const userId = u.rows[0].id;

    const pr = await db.query(
      `SELECT id, used, expires_at FROM password_resets
       WHERE user_id = $1 AND code = $2
       ORDER BY created_at DESC LIMIT 1`,
      [userId, String(code).trim()]
    );

    if (pr.rows.length === 0) return res.status(400).json({ error: 'Código inválido o expirado' });
    const row = pr.rows[0];
    if (row.used) return res.status(400).json({ error: 'Código ya usado' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Código expirado' });

    await db.query('BEGIN');
    const hashed = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = $1, updated_at = now() WHERE id = $2', [hashed, userId]);
    await db.query('UPDATE password_resets SET used = true WHERE id = $1', [row.id]);
    await db.query('UPDATE password_resets SET used = true WHERE user_id = $1 AND id <> $2', [userId, row.id]);
    await db.query('COMMIT');

    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    console.error('resetPassword error:', err && (err.stack || err.message));
    return res.status(500).json({ error: 'Error reestableciendo contraseña' });
  }
};

module.exports = { forgotPassword, resetPassword };