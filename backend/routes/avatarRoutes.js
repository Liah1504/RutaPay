// backend/routes/avatarRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../config/database'); // ajusta si tu proyecto tiene otra ruta
const { authenticateToken } = require('../middleware/auth'); // middleware existente

// Guardar en backend/public/avatars para que el servidor ya lo sirva via /public
const AVATAR_DIR = path.join(__dirname, '..', 'public', 'avatars');

// Storage en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// PUT /api/users/avatar  -> subir avatar y actualizar users.avatar
router.put('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    // logs para debug
    console.log('AVATAR UPLOAD route - req.user:', req.user && { id: req.user.id, email: req.user.email });
    console.log('AVATAR UPLOAD route - req.file:', req.file && { filename: req.file.filename, size: req.file.size });

    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'No autorizado' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // ruta relativa que se guardará en DB (reso: /public/avatars/xxxx.jpg)
    const avatarRelative = `/public/avatars/${req.file.filename}`;

    const updateQ = 'UPDATE users SET avatar = $1, updated_at = now() WHERE id = $2 RETURNING id, email, avatar';
    const result = await db.query(updateQ, [avatarRelative, userId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Construir URL absoluta para que el frontend pueda usarla de inmediato (opcional)
    const baseUrl = process.env.BACKEND_URL ? process.env.BACKEND_URL.replace(/\/$/, '') : `${req.protocol}://${req.get('host')}`;
    const avatarUrl = `${baseUrl}${avatarRelative}`;

    return res.json({ user: { ...result.rows[0], avatar: avatarUrl } });
  } catch (err) {
    console.error('Error uploading avatar:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Error subiendo avatar' });
  }
});

module.exports = router;