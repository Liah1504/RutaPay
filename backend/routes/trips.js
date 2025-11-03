const express = require('express');
const { createTrip, getPassengerTrips, getDriverTrips, updateTripStatus } = require('../controllers/tripController');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// ✅ AGREGA AUTENTICACIÓN A TODAS LAS RUTAS DE TRIPS

// POST /api/trips - Crear nuevo viaje (SOLO pasajeros)
router.post('/', authenticateToken, authorize('passenger'), createTrip);

// GET /api/trips/passenger - Obtener viajes del pasajero (SOLO pasajeros)
router.get('/passenger', authenticateToken, authorize('passenger'), getPassengerTrips);

// GET /api/trips/driver - Obtener viajes del conductor (SOLO conductores)
router.get('/driver', authenticateToken, authorize('driver'), getDriverTrips);

// PUT /api/trips/status - Actualizar estado del viaje (SOLO conductores)
router.put('/status', authenticateToken, authorize('driver'), updateTripStatus);

module.exports = router;