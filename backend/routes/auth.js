const express = require('express');
const { register, login } = require('../controllers/authController');

const router = express.Router();

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login  
router.post('/login', login);

// GET /api/auth/check (para verificar token si lo necesitas después)
router.get('/check', (req, res) => {
  res.json({ 
    message: 'Auth check OK',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;