// backend/routes/admin.js
// Rutas administrativas montadas en /api/admin
// Asegúrate de que ../controllers/reportsController.js exista si quieres exponer reportes

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
// CORRECCIÓN: require correcto para reportsController (nombre exacto: reportsController)
let reportsController = null;
try {
  reportsController = require('../controllers/reportsController');
} catch (err) {
  // Si no existe, no rompemos el router; dejamos un fallback que responde 501
  console.warn('⚠️ reportsController no disponible:', err.message || err);
}

const { authenticateToken, authorize } = require('../middleware/auth');

const adminProtect = [authenticateToken, authorize('admin')];

// Estadísticas y gestión de usuarios
router.get('/stats', adminProtect, adminController.getStats);
router.get('/users', adminProtect, adminController.getAllUsers);
router.put('/users/:id', adminProtect, adminController.updateUser);
router.delete('/users/:id', adminProtect, adminController.deleteUser);

// Crear conductor (solo admin)
router.post('/drivers', adminProtect, adminController.createDriver);

// Reportes (si existe el controller, lo usamos; si no devolvemos 501)
if (reportsController && typeof reportsController.driverDailyBalancesByCode === 'function') {
  router.get('/reports/driver-daily-balances', adminProtect, reportsController.driverDailyBalancesByCode);
} else {
  router.get('/reports/driver-daily-balances', adminProtect, (req, res) => {
    res.status(501).json({ error: 'Report controller no implementado en este servidor' });
  });
}

module.exports = router;