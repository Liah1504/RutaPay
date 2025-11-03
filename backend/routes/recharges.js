const express = require('express');
const router = express.Router();
const { createRecharge, getPendingRecharges, confirmRecharge } = require('../controllers/rechargeController');
const { authenticateToken, authorize } = require('../middleware/auth'); // Importar el middleware de seguridad

// Ahora, protegemos cada ruta con el middleware correspondiente

// POST /api/recharges - Registrar recarga (SOLO para pasajeros autenticados)
router.post('/', authenticateToken, authorize('passenger'), createRecharge);

// GET /api/recharges/pending - Ver recargas pendientes (SOLO para administradores autenticados)
router.get('/pending', authenticateToken, authorize('admin'), getPendingRecharges);

// PUT /api/recharges/:id/confirm - Confirmar recarga (SOLO para administradores autenticados)
router.put('/:id/confirm', authenticateToken, authorize('admin'), confirmRecharge);

module.exports = router;