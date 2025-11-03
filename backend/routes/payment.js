// backend/routes/payment.js

const express = require('express');
const router = express.Router();
const { manualPayment } = require('../controllers/paymentController');
const { authenticateToken, authorize } = require('../middleware/auth');

// POST /api/payment/pay
// Protegido: Solo un 'pasajero' logueado puede ejecutar esta acción
router.post('/pay', authenticateToken, authorize('passenger'), manualPayment);

module.exports = router;