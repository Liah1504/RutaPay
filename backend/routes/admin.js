const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { authenticateToken, authorize } = require('../middleware/auth');

const adminProtect = [authenticateToken, authorize('admin')];

router.get('/stats', adminProtect, adminController.getStats);
router.get('/users', adminProtect, adminController.getAllUsers);
router.put('/users/:id', adminProtect, adminController.updateUser);
router.delete('/users/:id', adminProtect, adminController.deleteUser);

// NUEVA RUTA: crear conductor (solo admin)
router.post('/drivers', adminProtect, adminController.createDriver);

module.exports = router;