const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController'); // tu controlador de auth existente
const passwordController = require('../controllers/passwordController');

// Rutas existentes de auth (login/register/etc.)
router.post('/login', authController.login);
router.post('/register', authController.register);

// NUEVAS rutas para recuperar contraseña
router.post('/forgot', passwordController.forgotPassword); // body: { email }
router.post('/reset', passwordController.resetPassword); // body: { email, code, password }

module.exports = router;