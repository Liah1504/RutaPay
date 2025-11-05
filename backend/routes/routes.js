const express = require('express');
const { 
  getAllRoutes, 
  getRouteById, 
  createRoute, 
  updateRoute,
  deactivateRoute,
  getPopularRoutes
} = require('../controllers/routeController');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/routes - Obtener todas las rutas
router.get('/', getAllRoutes);

// GET /api/routes/popular - Rutas más populares
router.get('/popular', getPopularRoutes);

// GET /api/routes/:id - Obtener ruta por ID
router.get('/:id', getRouteById);

// POST /api/routes - Crear nueva ruta (solo admin)
router.post('/', authenticateToken, authorize('admin'), createRoute);

// PUT /api/routes/:id - Actualizar ruta (solo admin)
router.put('/:id', authenticateToken, authorize('admin'), updateRoute);

// DELETE /api/routes/:id - Desactivar ruta (solo admin)
router.delete('/:id', authenticateToken, authorize('admin'), deactivateRoute);

module.exports = router;
