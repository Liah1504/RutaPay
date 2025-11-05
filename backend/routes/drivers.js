const express = require('express');
const router = express.Router();
const {
  getAvailableDrivers,
  getDriverProfile,
  getDriverPayments,
  getDriverPaymentsSummary
} = require('../controllers/driverController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Nota: eliminamos la ruta PUT /status para no exponer la actualización de disponibilidad

// GET /api/drivers/available (public)
router.get('/available', getAvailableDrivers);

// GET /api/drivers/profile (protegido, solo driver)
router.get('/profile', authenticateToken, authorize('driver'), getDriverProfile);

// GET /api/drivers/payments (historial de pagos - protegido, solo driver)
router.get('/payments', authenticateToken, authorize('driver'), getDriverPayments);

// GET /api/drivers/payments/summary?date=YYYY-MM-DD (resumen por fecha)
router.get('/payments/summary', authenticateToken, authorize('driver'), getDriverPaymentsSummary);

module.exports = router;