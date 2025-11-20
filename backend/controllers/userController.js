// backend/controllers/userController.js
// MODIFICADO POR MÍ: mejoras en manejo de avatar, validaciones (email único), y retorno consistente de avatar URL.
// Exporta: getProfile, updateProfile, uploadAvatarMiddleware

const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const AVATAR_DIR = path.join(__dirname, '..', 'public', 'avatars');
const AVATAR_MAP_FILE = path.join(AVATAR_DIR, 'avatars.json');

// --- Helpers para map de avatares (lectura/escritura sincronas - suficiente para operaciones puntuales) ---
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
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    // permitir solo imágenes comunes
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Tipo de archivo no permitido. Solo jpg, png o webp.'));
    }
    cb(null, true);
  }
});
const uploadAvatarMiddleware = upload.single('avatar');

/**
 * GET /api/users/profile
 * Devuelve el perfil del usuario autenticado.
 */
const getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

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
        // si la columna avatar existe y apunta a algo inexistente, dejamos como null
        if (row.avatar && typeof row.avatar === 'string' && row.avatar.startsWith('/')) {
          row.avatar = null;
        }
      }
    } else if (row.avatar) {
      // si la columna avatar existe en BD y es relativa, normalizar a URL absoluta
      if (typeof row.avatar === 'string' && row.avatar.startsWith('/')) {
        const baseUrl = getBackendBaseUrl(req);
        row.avatar = `${baseUrl}${row.avatar}`;
      }
      // si ya es una URL absoluta la dejamos tal cual
    }

    return res.json(row);
  } catch (err) {
    console.error('Error getProfile:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

/**
 * PUT /api/users/profile
 * Actualiza campos del perfil. Soporta upload de avatar (campo 'avatar' multipart/form-data).
 * Si la columna avatar existe en la BD, la actualiza con la ruta relativa (/public/avatars/filename)
 * Si la columna avatar no existe, guarda el archivo en public/avatars y lo mapea en avatars.json.
 */
const updateProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const userId = req.user.id;
    // Campos permitidos a actualizar desde el body:
    const { email, phone, vehicle, plate, license_number, name } = req.body;

    // Validaciones básicas
    const hasAvatarColumn = await checkAvatarColumn();

    // Si actualizan email, verificar unicidad
    if (email) {
      const emailQ = 'SELECT id FROM users WHERE email = $1 AND id <> $2 LIMIT 1';
      const emailRes = await db.query(emailQ, [email, userId]);
      if (emailRes.rows.length > 0) {
        return res.status(400).json({ error: 'El email ya está en uso por otro usuario' });
      }
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone); }
    if (vehicle !== undefined) { fields.push(`vehicle = $${idx++}`); values.push(vehicle); }
    if (plate !== undefined) { fields.push(`plate = $${idx++}`); values.push(plate); }
    if (license_number !== undefined) { fields.push(`license_number = $${idx++}`); values.push(license_number); }

    // Manejo de avatar si viene en req.file
    let finalAvatarUrl = null;
    if (req.file && req.file.buffer) {
      try {
        if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
        // Sanitizar extensión
        const rawExt = (req.file.originalname && path.extname(req.file.originalname)) || '';
        const ext = rawExt ? rawExt.toLowerCase() : '.png';
        const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
        const fileName = `${userId}-${Date.now()}${safeExt}`;
        const filePath = path.join(AVATAR_DIR, fileName);
        fs.writeFileSync(filePath, req.file.buffer);

        const relativePathForDb = `/public/avatars/${fileName}`; // ruta relativa accesible (según server static)
        finalAvatarUrl = `${getBackendBaseUrl(req)}${relativePathForDb}`;

        // Actualizar mapping local avatars.json en cualquier caso (útil si no hay columna avatar)
        const avatarMap = readAvatarMap();
        avatarMap[String(userId)] = fileName;
        writeAvatarMap(avatarMap);

        // Si la columna avatar existe en la BD, incluirla en los campos a actualizar (almacenamos la ruta relativa)
        if (hasAvatarColumn) {
          fields.push(`avatar = $${idx++}`);
          values.push(relativePathForDb);
        }
      } catch (fsErr) {
        console.error('Error guardando avatar:', fsErr);
        return res.status(500).json({ error: 'No se pudo guardar el avatar' });
      }
    }

    let resultRow = null;
    if (fields.length > 0) {
      // Añadir updated_at y cláusula WHERE
      const returningFields = hasAvatarColumn
        ? 'id, name, email, phone, balance, avatar, role'
        : 'id, name, email, phone, balance, role';

      const q = `UPDATE users SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING ${returningFields}`;
      values.push(userId);
      const result = await db.query(q, values);
      resultRow = result.rows[0];

      // Si resultRow.avatar es relativo, transformarlo a URL absoluta
      if (resultRow && resultRow.avatar && typeof resultRow.avatar === 'string') {
        if (resultRow.avatar.startsWith('/')) {
          const baseUrl = getBackendBaseUrl(req);
          resultRow.avatar = `${baseUrl}${resultRow.avatar}`;
        } else {
          // si es posible que sea sólo el file name en DB (no recomendado), convertir también:
          if (!resultRow.avatar.startsWith('http')) {
            const baseUrl = getBackendBaseUrl(req);
            resultRow.avatar = `${baseUrl}/public/avatars/${resultRow.avatar}`;
          }
        }
      }
    }

    // Si no se actualizó ningún campo en BD, pero sí se subió avatar y no hay columna avatar,
    // devolvemos avatarUrl para que frontend lo use desde avatars.json
    const responsePayload = resultRow ? { ...resultRow } : {};
    if (!responsePayload.avatar && finalAvatarUrl) {
      // si DB no contiene avatar, añadimos avatarUrl para frontend
      responsePayload.avatar = finalAvatarUrl;
    }

    if (!resultRow && !finalAvatarUrl) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    return res.json(responsePayload);
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