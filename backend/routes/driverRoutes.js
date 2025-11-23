const express = require('express');
const router = express.Router();

// Importar el controlador correcto (plural: driversController)
const driversController = require('../controllers/driversController');
const auth = require('../middleware/auth');

// debug logs para verificar exports/resolves
console.log('ROUTES/driverRoutes: driversController keys ->', driversController && Object.keys(driversController));
console.log('ROUTES/driverRoutes: auth module ->', auth && Object.keys(auth));

// compatibilidad: aceptar authenticate o authenticateToken
const authenticate = (auth && (auth.authenticate || auth.authenticateToken)) || null;

if (!authenticate || typeof authenticate !== 'function') {
  throw new Error('Middleware de autenticación "authenticate" no encontrado o no es función en backend/middleware/auth.js');
}

// Validar controllers
if (!driversController || typeof driversController !== 'object') {
  throw new Error('Controller "driversController" no encontrado o export incorrecto en backend/controllers/driversController.js');
}

// Rutas: GETs existentes
router.get('/profile', authenticate, driversController.getDriverProfile);
router.get('/payments', authenticate, driversController.getDriverPayments);
router.get('/payments/summary', authenticate, driversController.getDriverPaymentsSummary);
router.get('/notifications', authenticate, driversController.getDriverNotifications);

// NUEVA RUTA: PUT para actualizar perfil del driver (crea/actualiza fila drivers)
if (typeof driversController.updateDriverProfile === 'function') {
  router.put('/profile', authenticate, driversController.updateDriverProfile);
} else {
  console.warn('driversController.updateDriverProfile no está definido — no se montará PUT /drivers/profile');
}

module.exports = router;