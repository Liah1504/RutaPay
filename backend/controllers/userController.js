const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

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

/**
 * Construye la base URL del backend con protocolo y host (ej: http://localhost:5002)
 */
const getBackendBaseUrl = (req) => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

/**
 * Multer middleware en memoria: producirá req.file.buffer
 * - Uso recomendado en la ruta: router.put('/profile', authenticateToken, uploadAvatarMiddleware, updateProfile)
 */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadAvatarMiddleware = upload.single('avatar');

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

    // Si hay mapping en avatars.json, y el archivo existe, agregamos URL absoluta
    const avatarMap = readAvatarMap();
    const mappedFile = avatarMap[String(userId)];
    if (mappedFile) {
      const candidatePath = path.join(AVATAR_DIR, mappedFile);
      if (fs.existsSync(candidatePath)) {
        const baseUrl = getBackendBaseUrl(req);
        row.avatar = `${baseUrl}/public/avatars/${mappedFile}`;
      } else {
        // archivo no existe: limpiar mapping para evitar 404 repetidos
        delete avatarMap[String(userId)];
        writeAvatarMap(avatarMap);
      }
    } else if (row.avatar) {
      // si la columna avatar existe en BD y es relativa, normalizar a URL absoluta
      if (typeof row.avatar === 'string' && row.avatar.startsWith('/')) {
        const baseUrl = getBackendBaseUrl(req);
        row.avatar = `${baseUrl}${row.avatar}`;
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
    const { email, phone, vehicle, plate, license_number } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone); }
    if (vehicle !== undefined) { fields.push(`vehicle = $${idx++}`); values.push(vehicle); }
    if (plate !== undefined) { fields.push(`plate = $${idx++}`); values.push(plate); }
    if (license_number !== undefined) { fields.push(`license_number = $${idx++}`); values.push(license_number); }

    let avatarUrl = null;
    // Support both multer memory upload (req.file.buffer) and legacy file handling if any
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

      const baseUrl = getBackendBaseUrl(req);
      avatarUrl = `${baseUrl}/public/avatars/${fileName}`;
    }

    let resultRow = null;
    if (fields.length > 0) {
      const hasAvatarColumn = await checkAvatarColumn();
      const returningFields = hasAvatarColumn
        ? 'id, name, email, phone, balance, avatar, role'
        : 'id, name, email, phone, balance, role';

      const q = `UPDATE users SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING ${returningFields}`;
      values.push(userId);
      const result = await db.query(q, values);
      resultRow = result.rows[0];

      // Si resultRow.avatar es relativo, transformarlo a URL absoluta
      if (resultRow && resultRow.avatar && typeof resultRow.avatar === 'string' && resultRow.avatar.startsWith('/')) {
        const baseUrl = getBackendBaseUrl(req);
        resultRow.avatar = `${baseUrl}${resultRow.avatar}`;
      }
    }

    const response = resultRow ? { ...resultRow } : {};
    if (avatarUrl) response.avatarUrl = avatarUrl;

    // If avatar uploaded but no other fields updated, return avatarUrl so frontend can update immediately
    if (!resultRow && !avatarUrl) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    return res.json(response);
  } catch (err) {
    console.error('Error updateProfile:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatarMiddleware
};