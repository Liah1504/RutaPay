const express = require('express');
const { getMyProfile } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/profile - Ruta protegida para obtener el perfil del propio usuario
router.get('/profile', authenticateToken, getMyProfile);

module.exports = router;