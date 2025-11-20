// backend/routes/userRoutes.js
const express = require('express');
const { getProfile, updateProfile, uploadAvatarMiddleware } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/profile (protegido)
router.get('/profile', authenticateToken, getProfile);

// PUT /api/users/profile (protegido) — usa el middleware de upload exportado desde userController
// Content-Type: multipart/form-data (campo 'avatar' opcional)
router.put('/profile', authenticateToken, uploadAvatarMiddleware, updateProfile);

module.exports = router;