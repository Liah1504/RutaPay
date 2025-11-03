// backend/controllers/adminController.js

const db = require('../config/database');
const bcrypt = require('bcryptjs'); 

// =============================================
// FUNCIÓN 1: OBTENER ESTADÍSTICAS (Actualizada con Ingresos)
// =============================================
const getStats = async (req, res) => {
    try {
        // Consulta 1: Total Usuarios
        const totalUsers = await db.query('SELECT COUNT(*) FROM users');
        
        // Consulta 2: Total Conductores (rol 'driver')
        const totalDrivers = await db.query("SELECT COUNT(*) FROM users WHERE role = 'driver'");
        
        // Consulta 3: Total Viajes (todos)
        const totalTrips = await db.query('SELECT COUNT(*) FROM trips');
        
        // Consulta 4: Viajes Activos
        const activeTrips = await db.query("SELECT COUNT(*) FROM trips WHERE status IN ('pending', 'accepted', 'in_progress')");
        
        // 🚨 NUEVA CONSULTA: Suma total de dinero recargado (solo 'confirmada')
        const totalRevenue = await db.query("SELECT COALESCE(SUM(amount), 0) AS revenue_sum FROM recharges WHERE status = 'confirmada'");
        
        // Formateamos y enviamos los resultados
        res.json({
            totalUsers: parseInt(totalUsers.rows[0].count, 10),
            totalDrivers: parseInt(totalDrivers.rows[0].count, 10),
            totalTrips: parseInt(totalTrips.rows[0].count, 10),
            activeTrips: parseInt(activeTrips.rows[0].count, 10),
            totalRevenue: parseFloat(totalRevenue.rows[0].revenue_sum).toFixed(2), // <-- NUEVO CAMPO
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error del servidor al obtener estadísticas' });
    }
};

// =============================================
// FUNCIONES DE GESTIÓN DE USUARIOS (El resto del código se mantiene igual)
// =============================================
const getAllUsers = async (req, res) => {
    // ... Tu código para getAllUsers ...
    try {
        const users = await db.query(
            'SELECT id, email, name, role, phone, balance, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(users.rows);
    } catch (error) {
        console.error('❌ Error listando usuarios:', error);
        res.status(500).json({ error: 'Error del servidor al listar usuarios' });
    }
};

const updateUser = async (req, res) => {
    // ... Tu código para updateUser ...
    const { id } = req.params;
    const { name, email, phone, role, password } = req.body;
    const client = await db.connect(); 
    try {
        await client.query('BEGIN');
        let updateQuery = 'UPDATE users SET name = $1, email = $2, phone = $3, role = $4';
        let queryParams = [name, email, phone, role];
        let paramIndex = 5;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updateQuery += `, password = $${paramIndex}`;
            queryParams.push(hashedPassword);
            paramIndex++;
        }
        updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
        queryParams.push(id);
        const updatedUser = await client.query(updateQuery, queryParams);
        if (updatedUser.rows.length === 0) {
            throw new Error('Usuario no encontrado');
        }
        const oldRole = updatedUser.rows[0].role;
        const newRole = role;
        
        if (newRole === 'driver' && oldRole !== 'driver') {
            const driverExists = await client.query('SELECT 1 FROM drivers WHERE user_id = $1', [id]);
            if (driverExists.rows.length === 0) {
                await client.query('INSERT INTO drivers (user_id, is_available) VALUES ($1, true)', [id]);
            }
        } else if (newRole !== 'driver' && oldRole === 'driver') {
            await client.query('DELETE FROM drivers WHERE user_id = $1', [id]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Usuario actualizado exitosamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error actualizando usuario (transacción revertida):', error);
        res.status(500).json({ error: error.message || 'Error al actualizar usuario' });
    } finally {
        client.release();
    }
};

const deleteUser = async (req, res) => {
    // ... Tu código para deleteUser ...
    const { id } = req.params;
    try {
        const deletedUser = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (deletedUser.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('❌ Error eliminando usuario:', error);
        res.status(500).json({ error: 'Error del servidor al eliminar usuario' });
    }
};

module.exports = { getAllUsers, updateUser, deleteUser, getStats };