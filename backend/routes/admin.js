// backend/routes/admin.js

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController'); 
const { authenticateToken, authorize } = require('../middleware/auth'); 

const adminProtect = [authenticateToken, authorize('admin')];


// ==================================================================
// RUTAS DE ESTADÍSTICAS (¡NUEVO!)
// ==================================================================

// GET /api/admin/stats
router.get('/stats', adminProtect, adminController.getStats); // <-- RUTA NUEVA

// ==================================================================
// RUTAS DE GESTIÓN DE USUARIOS (CRUD)
// ==================================================================

// GET /api/admin/users - Listar todos los usuarios
router.get('/users', adminProtect, adminController.getAllUsers);

// PUT /api/admin/users/:id - Actualizar usuario y rol
router.put('/users/:id', adminProtect, adminController.updateUser);

// DELETE /api/admin/users/:id - Eliminar usuario
router.delete('/users/:id', adminProtect, adminController.deleteUser);


module.exports = router;