const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const AVATAR_DIR = path.join(__dirname, '..', 'public', 'avatars');
const AVATAR_MAP_FILE = path.join(AVATAR_DIR, 'avatars.json');

const readAvatarMap = () => {
  try {
    if (!fs.existsSync(AVATAR_MAP_FILE)) return {};
    const raw = fs.readFileSync(AVATAR_MAP_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.warn('No se pudo leer avatars.json:', err.message || err);
    return {};
  }
};

const writeAvatarMap = (map) => {
  try {
    if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
    fs.writeFileSync(AVATAR_MAP_FILE, JSON.stringify(map, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error escribiendo avatars.json:', err);
    return false;
  }
};

const checkAvatarColumn = async () => {
  try {
    const q = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'avatar'
      LIMIT 1
    `;
    const res = await db.query(q);
    return res.rows.length > 0;
  } catch (err) {
    console.warn('No se pudo comprobar columna avatar:', err.message || err);
    return false;
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const hasAvatarColumn = await checkAvatarColumn();
    const selectFields = hasAvatarColumn
      ? 'id, name, email, phone, balance, avatar, role'
      : 'id, name, email, phone, balance, role';

    const q = `SELECT ${selectFields} FROM users WHERE id = $1`;
    const result = await db.query(q, [userId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const row = result.rows[0];

    // Comprueba mapping y que el archivo exista antes de asignarlo
    const avatarMap = readAvatarMap();
    const mappedFile = avatarMap[String(userId)];
    if (mappedFile) {
      const candidatePath = path.join(AVATAR_DIR, mappedFile);
      if (fs.existsSync(candidatePath)) {
        row.avatar = `/public/avatars/${mappedFile}`;
      } else {
        // si el archivo no existe, limpiar el mapping para evitar 404 repetidos
        delete avatarMap[String(userId)];
        writeAvatarMap(avatarMap);
        // no asignamos avatar en el row (seguirá sin avatar)
      }
    }

    return res.json(row);
  } catch (err) {
    console.error('Error getProfile:', err);
    return res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, phone } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone); }

    let avatarUrl = null;
    if (req.file && req.file.buffer) {
      if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
      const ext = (req.file.originalname && path.extname(req.file.originalname)) || '.png';
      const fileName = `${userId}-${Date.now()}${ext}`;
      const filePath = path.join(AVATAR_DIR, fileName);
      fs.writeFileSync(filePath, req.file.buffer);

      // actualizar mapping
      const avatarMap = readAvatarMap();
      avatarMap[String(userId)] = fileName;
      writeAvatarMap(avatarMap);

      avatarUrl = `/public/avatars/${fileName}`;
    }

    let resultRow = null;
    if (fields.length > 0) {
      const hasAvatarColumn = await checkAvatarColumn();
      const returningFields = hasAvatarColumn
        ? 'id, name, email, phone, balance, avatar, role'
        : 'id, name, email, phone, balance, role';

      const q = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING ${returningFields}`;
      values.push(userId);
      const result = await db.query(q, values);
      resultRow = result.rows[0];
    }

    const response = resultRow ? { ...resultRow } : {};
    if (avatarUrl) response.avatarUrl = avatarUrl;

    if (!resultRow && !avatarUrl) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    return res.json(response);
  } catch (err) {
    console.error('Error updateProfile:', err);
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

module.exports = {
  getProfile,
  updateProfile
};