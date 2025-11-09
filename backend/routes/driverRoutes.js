const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const auth = require('../middleware/auth');

// debug logs para verificar exports/resolves
console.log('ROUTES/driverRoutes: driverController keys ->', driverController && Object.keys(driverController));
console.log('ROUTES/driverRoutes: auth module ->', auth && Object.keys(auth));

// compatibilidad: aceptar authenticate o authenticateToken
const authenticate = (auth && (auth.authenticate || auth.authenticateToken)) || null;

if (!authenticate || typeof authenticate !== 'function') {
  throw new Error('Middleware de autenticación "authenticate" no encontrado o no es función en backend/middleware/auth.js');
}

// Validar controllers
if (!driverController || typeof driverController !== 'object') {
  throw new Error('Controller "driverController" no encontrado o export incorrecto en backend/controllers/driverController.js');
}

// Rutas
router.get('/profile', authenticate, driverController.getDriverProfile);
router.get('/payments', authenticate, driverController.getDriverPayments);
router.get('/payments/summary', authenticate, driverController.getDriverPaymentsSummary);
router.get('/notifications', authenticate, driverController.getDriverNotifications);

module.exports = router;