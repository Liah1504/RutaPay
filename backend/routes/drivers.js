const express = require('express');
const { updateDriverStatus, getAvailableDrivers, getDriverProfile } = require('../controllers/driverController');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// PUT /api/drivers/status
router.put('/status', authenticateToken, authorize('driver'), updateDriverStatus);

// GET /api/drivers/available
router.get('/available', authenticateToken, getAvailableDrivers);

// GET /api/drivers/profile
router.get('/profile', authenticateToken, authorize('driver'), getDriverProfile);

module.exports = router;