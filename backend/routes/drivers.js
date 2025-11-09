// backend/routes/drivers.js
const express = require('express');
const router = express.Router();

// Controlador y middleware
const driverController = require('../controllers/driverController');
const auth = require('../middleware/auth');

// Logs de depuración para identificar problema de exports/require
console.log('ROUTES/drivers: driverController ->', driverController && Object.keys(driverController));
console.log('ROUTES/drivers: auth module ->', auth && Object.keys(auth));

// Resolve la función de autenticación (soporta authenticate o authenticateToken)
const authenticate = auth && (auth.authenticate || auth.authenticateToken || auth);

// Validación temprana para evitar crash por undefined
if (!authenticate || typeof authenticate !== 'function') {
  console.error('ERROR: Middleware de autenticación no encontrado o no es función (backend/middleware/auth.js).');
  throw new Error('Middleware de autenticación "authenticate" no encontrado o no es función en backend/middleware/auth.js');
}

// Validar funciones del controlador
const missingHandlers = [];
if (!driverController || typeof driverController !== 'object') {
  console.error('ERROR: driverController no encontrado o export incorrecto (backend/controllers/driverController.js).');
  throw new Error('Controller "driverController" no encontrado o export incorrecto en backend/controllers/driverController.js');
}
if (typeof driverController.getDriverProfile !== 'function') missingHandlers.push('getDriverProfile');
if (typeof driverController.getDriverPayments !== 'function') missingHandlers.push('getDriverPayments');
if (typeof driverController.getDriverPaymentsSummary !== 'function') missingHandlers.push('getDriverPaymentsSummary');
if (typeof driverController.getDriverNotifications !== 'function') missingHandlers.push('getDriverNotifications');

if (missingHandlers.length > 0) {
  console.error('ERROR: Faltan handlers en driverController:', missingHandlers);
  throw new Error(`Faltan handlers en driverController: ${missingHandlers.join(', ')}`);
}

// Rutas
router.get('/profile', authenticate, driverController.getDriverProfile);
router.get('/payments', authenticate, driverController.getDriverPayments);
router.get('/payments/summary', authenticate, driverController.getDriverPaymentsSummary);
router.get('/notifications', authenticate, driverController.getDriverNotifications);

module.exports = router;