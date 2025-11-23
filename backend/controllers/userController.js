/**
 * backend/controllers/userController.js
 *
 * Controlador de perfil de usuario:
 * - getProfile: devuelve perfil combinado (users + drivers si existe)
 * - updateProfile: actualiza usuario y, si vienen campos de vehículo, crea/actualiza fila drivers
 * - uploadAvatarMiddleware: multer middleware para procesar avatar (req.file.buffer)
 *
 * Conserva la lógica de manejo de avatar en disco + avatars.json para compatibilidad cuando la columna
 * avatar no exista en la tabla users.
 */

const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const AVATAR_DIR = path.join(__dirname, '..', 'public', 'avatars');
const AVATAR_MAP_FILE = path.join(AVATAR_DIR, 'avatars.json');

/* ---------- Helpers para avatar map ---------- */
const readAvatarMap = () => {
  try {
    if (!fs.existsSync(AVATAR_MAP_FILE)) return {};
    const raw = fs.readFileSync(AVATAR_MAP_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.warn('No se pudo leer avatars.json:', err && (err.message || err));
    return {};
  }
};

const writeAvatarMap = (map) => {
  try {
    if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
    fs.writeFileSync(AVATAR_MAP_FILE, JSON.stringify(map, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error escribiendo avatars.json:', err && (err.message || err));
    return false;
  }
};

/* Comprueba si la columna avatar existe en users */
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
    console.warn('No se pudo comprobar columna avatar:', err && (err.message || err));
    return false;
  }
};

/* Construye la base URL del backend (ej: http://localhost:5002) */
const getBackendBaseUrl = (req) => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

/* ---------- Multer middleware (memoria) para avatar ---------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Tipo de archivo no permitido. Solo jpg, png o webp.'));
    }
    cb(null, true);
  }
});
const uploadAvatarMiddleware = upload.single('avatar');

/* ---------- getProfile: devuelve perfil combinado (users + drivers si existe) ---------- */
const getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    const userId = req.user.id;

    // Determinar si existe columna avatar en users
    const hasAvatarColumn = await checkAvatarColumn();

    // Selección de campos del usuario (mantener compatibilidad con versiones previas)
    const selectUser = hasAvatarColumn
      ? 'u.id as user_id, u.name, u.email, u.phone, u.balance, u.avatar, u.role'
      : 'u.id as user_id, u.name, u.email, u.phone, u.balance, u.role';

    // Hacemos left join con drivers para incluir datos de conductor si existen
    const q = `
      SELECT ${selectUser},
             d.id as driver_row_id, d.driver_code, d.license_number, d.vehicle_type, d.vehicle_plate,
             d.is_available, d.current_location, d.rating, d.total_trips,
             d.created_at as driver_created_at, d.updated_at as driver_updated_at
      FROM users u
      LEFT JOIN drivers d ON d.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `;
    const result = await db.query(q, [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const row = result.rows[0];

    // Normalizar avatar:
    // 1) Si hay mapping en avatars.json para este user -> usarlo si el archivo existe
    // 2) Si la columna avatar existe y es relativa (/...) -> convertir a URL absoluta
    const avatarMap = readAvatarMap();
    const mappedFile = avatarMap[String(userId)];
    if (mappedFile) {
      const candidatePath = path.join(AVATAR_DIR, mappedFile);
      if (fs.existsSync(candidatePath)) {
        const baseUrl = getBackendBaseUrl(req);
        row.avatar = `${baseUrl}/public/avatars/${mappedFile}`;
      } else {
        // limpiar mapping roto
        delete avatarMap[String(userId)];
        writeAvatarMap(avatarMap);
        if (row.avatar && typeof row.avatar === 'string' && row.avatar.startsWith('/')) row.avatar = null;
      }
    } else if (row.avatar && typeof row.avatar === 'string') {
      if (row.avatar.startsWith('/')) {
        const baseUrl = getBackendBaseUrl(req);
        row.avatar = `${baseUrl}${row.avatar}`;
      } else if (!row.avatar.startsWith('http')) {
        // si por alguna razón la DB guarda solo nombre de archivo
        const baseUrl = getBackendBaseUrl(req);
        row.avatar = `${baseUrl}/public/avatars/${row.avatar}`;
      }
    }

    return res.json(row);
  } catch (err) {
    console.error('Error getProfile:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

/* ---------- updateProfile: actualiza users y drivers (si corresponde) ---------- */
const updateProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    const userId = req.user.id;

    // Soportar body y campos enviados por FormData (multer coloca fields en req.body)
    const raw = req.body || {};

    // Debug log (útil para ver lo que llega)
    console.log('[userController.updateProfile] userId=%d rawBody=%o file=%s', userId, raw, !!req.file);

    // Compatibilidad nombres: vehicle / vehicle_type / unit ; plate / vehicle_plate / placa ; license_number / license
    // Normalizar: trim y convertir strings vacías a null
    const normalize = (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v !== 'string') return v;
      const t = v.trim();
      return t.length ? t : null;
    };

    const vehicle = normalize(raw.vehicle ?? raw.vehicle_type ?? raw.unit);
    const plate = normalize(raw.plate ?? raw.vehicle_plate ?? raw.placa);
    const license_number = normalize(raw.license_number ?? raw.license);
    const email = normalize(raw.email ?? null);
    const phone = normalize(raw.phone ?? null);
    const name = normalize(raw.name ?? null);

    console.log('[userController.updateProfile] resolved vehicle=%s plate=%s license=%s email=%s phone=%s name=%s', vehicle, plate, license_number, email, phone, name);

    const hasAvatarColumn = await checkAvatarColumn();

    // Validación: email único si se está actualizando
    if (email) {
      const emailQ = 'SELECT id FROM users WHERE email = $1 AND id <> $2 LIMIT 1';
      const emailRes = await db.query(emailQ, [email, userId]);
      if (emailRes.rows.length > 0) {
        return res.status(400).json({ error: 'El email ya está en uso por otro usuario' });
      }
    }

    // Manejo de avatar (si se subió archivo en req.file)
    let finalAvatarUrl = null;
    let savedAvatarFileName = null;
    if (req.file && req.file.buffer) {
      try {
        if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

        const rawExt = (req.file.originalname && path.extname(req.file.originalname)) || '';
        const ext = rawExt ? rawExt.toLowerCase() : '.png';
        const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
        const fileName = `${userId}-${Date.now()}${safeExt}`;
        const filePath = path.join(AVATAR_DIR, fileName);
        fs.writeFileSync(filePath, req.file.buffer);

        const relativePathForDb = `/public/avatars/${fileName}`;
        finalAvatarUrl = `${getBackendBaseUrl(req)}${relativePathForDb}`;

        // actualizar avatars.json mapping
        const avatarMap = readAvatarMap();
        avatarMap[String(userId)] = fileName;
        writeAvatarMap(avatarMap);

        savedAvatarFileName = fileName;
      } catch (fsErr) {
        console.error('Error guardando avatar:', fsErr && (fsErr.message || fsErr));
        return res.status(500).json({ error: 'No se pudo guardar el avatar' });
      }
    }

    // Iniciar transacción para actualizar users y drivers de forma atómica
    await db.query('BEGIN');

    // Construir actualización de users (incluir avatar si columna existe)
    const userFields = [];
    const userValues = [];
    let ui = 1;

    if (name !== null) { userFields.push(`name = $${ui++}`); userValues.push(name); }
    if (email !== null) { userFields.push(`email = $${ui++}`); userValues.push(email); }
    if (phone !== null) { userFields.push(`phone = $${ui++}`); userValues.push(phone); }

    // Si hay avatar y columna avatar existe, guardamos relativa
    if (savedAvatarFileName && hasAvatarColumn) {
      const relativePathForDb = `/public/avatars/${savedAvatarFileName}`;
      userFields.push(`avatar = $${ui++}`);
      userValues.push(relativePathForDb);
    }

    if (userFields.length > 0) {
      userValues.push(userId);
      const qUpdateUser = `UPDATE users SET ${userFields.join(', ')}, updated_at = now() WHERE id = $${userValues.length} RETURNING id, name, email, phone, balance${hasAvatarColumn ? ', avatar' : ''}, role`;
      const ures = await db.query(qUpdateUser, userValues);
      console.log('[userController.updateProfile] users updated rowCount=%d', ures.rowCount);
    } else {
      console.log('[userController.updateProfile] no user fields to update');
    }

    // Actualizar/crear fila en drivers si vienen campos de driver (no actualizamos con nulls)
    if (vehicle !== null || plate !== null || license_number !== null) {
      const drvExist = await db.query('SELECT id FROM drivers WHERE user_id = $1 LIMIT 1', [userId]);
      if (drvExist.rows.length > 0) {
        const drvId = drvExist.rows[0].id;
        const dFields = [];
        const dParams = [];
        let dj = 1;
        if (vehicle !== null) { dFields.push(`vehicle_type = $${dj++}`); dParams.push(vehicle); }
        if (plate !== null) { dFields.push(`vehicle_plate = $${dj++}`); dParams.push(plate); }
        if (license_number !== null) { dFields.push(`license_number = $${dj++}`); dParams.push(license_number); }
        if (dFields.length > 0) {
          dParams.push(drvId);
          const qUpdateDrv = `UPDATE drivers SET ${dFields.join(', ')}, updated_at = now() WHERE id = $${dParams.length}`;
          const drvRes = await db.query(qUpdateDrv, dParams);
          console.log('[userController.updateProfile] drivers updated rowCount=%d', drvRes.rowCount);
        } else {
          console.log('[userController.updateProfile] no driver fields to update for existing driver row');
        }
      } else {
        // Insertar nueva fila drivers con lo que venga (solo columnas con valores)
        const cols = ['user_id'];
        const vals = ['$1'];
        const params = [userId];
        let dk = 2;
        if (vehicle !== null) { cols.push('vehicle_type'); vals.push(`$${dk++}`); params.push(vehicle); }
        if (plate !== null) { cols.push('vehicle_plate'); vals.push(`$${dk++}`); params.push(plate); }
        if (license_number !== null) { cols.push('license_number'); vals.push(`$${dk++}`); params.push(license_number); }
        const qInsertDrv = `INSERT INTO drivers (${cols.join(',')}, created_at, updated_at) VALUES (${vals.join(',')}, now(), now()) RETURNING id`;
        const insertRes = await db.query(qInsertDrv, params);
        console.log('[userController.updateProfile] drivers insert id=%o', insertRes.rows[0] && insertRes.rows[0].id);
      }
    } else {
      console.log('[userController.updateProfile] no driver data in request (vehicle/plate/license_number all null)');
    }

    // Commit
    await db.query('COMMIT');

    // Preparar y devolver perfil actualizado (JOIN users + drivers)
    const qProfile = `
      SELECT u.id as user_id, u.name, u.email, u.phone, u.balance,
             d.id as driver_row_id, d.driver_code, d.license_number, d.vehicle_type, d.vehicle_plate,
             d.is_available, d.current_location, d.rating, d.total_trips,
             u.role, u.avatar,
             d.created_at as driver_created_at, d.updated_at as driver_updated_at
      FROM users u
      LEFT JOIN drivers d ON d.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `;
    const pres = await db.query(qProfile, [userId]);
    const profile = pres.rows[0] || null;

    // Normalizar avatar en respuesta
    if (profile) {
      const avatarMap = readAvatarMap();
      const mappedFile = avatarMap[String(userId)];
      if (mappedFile) {
        const candidatePath = path.join(AVATAR_DIR, mappedFile);
        if (fs.existsSync(candidatePath)) {
          profile.avatar = `${getBackendBaseUrl(req)}/public/avatars/${mappedFile}`;
        } else {
          // limpiar mapping roto
          delete avatarMap[String(userId)];
          writeAvatarMap(avatarMap);
          if (profile.avatar && typeof profile.avatar === 'string' && profile.avatar.startsWith('/')) profile.avatar = null;
        }
      } else if (profile.avatar && typeof profile.avatar === 'string') {
        if (profile.avatar.startsWith('/')) {
          profile.avatar = `${getBackendBaseUrl(req)}${profile.avatar}`;
        } else if (!profile.avatar.startsWith('http')) {
          profile.avatar = `${getBackendBaseUrl(req)}/public/avatars/${profile.avatar}`;
        }
      } else if (!profile.avatar && finalAvatarUrl) {
        // Si no existe columna avatar en DB pero subimos archivo -> devolver URL temporal
        profile.avatar = finalAvatarUrl;
      }
    }

    return res.json(profile);
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (rbErr) { /* ignore */ }
    console.error('Error updateProfile:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

/* ---------- Exports ---------- */
module.exports = {
  getProfile,
  updateProfile,
  uploadAvatarMiddleware
};