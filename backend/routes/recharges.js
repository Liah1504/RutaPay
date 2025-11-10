const express = require('express');
const router = express.Router();
const {
  createRecharge,
  getPendingRecharges,
  confirmRecharge,
  rejectRecharge,           // <-- debe existir en tu controller
  getNotificationsForUser   // opcional si quieres usar aquí, pero lo dejamos fuera
} = require('../controllers/rechargeController');
const { authenticateToken, authorize } = require('../middleware/auth'); // tu middleware

// POST /api/recharges - Registrar recarga (SOLO para pasajeros autenticados)
router.post('/', authenticateToken, authorize('passenger'), createRecharge);

// GET /api/recharges/pending - Ver recargas pendientes (SOLO para administradores)
router.get('/pending', authenticateToken, authorize('admin'), getPendingRecharges);

// PUT /api/recharges/:id/confirm - Confirmar recarga (SOLO para administradores)
router.put('/:id/confirm', authenticateToken, authorize('admin'), confirmRecharge);

// POST /api/recharges/:id/reject - Rechazar recarga con razón (SOLO para administradores)
router.post('/:id/reject', authenticateToken, authorize('admin'), rejectRecharge);

module.exports = router;