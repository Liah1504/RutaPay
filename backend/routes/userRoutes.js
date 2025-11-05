const express = require('express');
const { getProfile, updateProfile } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const upload = multer(); // memoria

const router = express.Router();

router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, upload.single('avatar'), updateProfile);

module.exports = router;