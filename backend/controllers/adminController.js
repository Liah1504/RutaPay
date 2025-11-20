// backend/controllers/adminController.js
// Controlador admin: getStats, usuarios CRUD, createDriver
// MODIFICADO POR MÍ: getStats robusto y consistente con la UI

const db = require('../config/database');
const bcrypt = require('bcryptjs');

console.log('🔀 Cargando adminController');

const getStats = async (req, res) => {
  try {
    const [
      totalUsersResult,
      totalDriversResult,
      totalTripsResult,
      activeTripsResult,
      totalRevenueResult
    ] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS total_users FROM users"),
      db.query("SELECT COUNT(*)::int AS total_drivers FROM drivers"),
      db.query("SELECT COUNT(*)::int AS total_trips FROM trips"),
      // Ajusta el estado 'in_progress' si tu sistema usa otro valor
      db.query("SELECT COUNT(*)::int AS active_trips FROM trips WHERE status = 'in_progress'"),
      // Ajusta la tabla/estado si tu sistema registra ingreso de otra forma
      db.query("SELECT COALESCE(SUM(amount),0)::numeric(12,2) AS total_revenue FROM recharges WHERE status = 'confirmada' OR status = 'confirmed'")
    ]);

    const stats = {
      totalUsers: totalUsersResult.rows[0]?.total_users ?? 0,
      totalDrivers: totalDriversResult.rows[0]?.total_drivers ?? 0,
      totalTrips: totalTripsResult.rows[0]?.total_trips ?? 0,
      activeTrips: activeTripsResult.rows[0]?.active_trips ?? 0,
      totalRevenue: (totalRevenueResult.rows[0]?.total_revenue ?? '0.00').toString()
    };

    return res.json(stats);
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas (adminController.getStats):', error);
    return res.status(500).json({ error: 'Error interno al obtener estadísticas' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await db.query('SELECT id, email, name, role, phone, balance FROM users ORDER BY id DESC');
    return res.json(users.rows);
  } catch (error) {
    console.error('❌ Error obteniendo usuarios (adminController.getAllUsers):', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, phone, role } = req.body;

  try {
    if (role && role === 'passenger') {
      return res.status(400).json({ error: 'No está permitido que el administrador cree o convierta usuarios a "passenger".' });
    }

    const result = await db.query(
      `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), role = COALESCE($3, role)
       WHERE id = $4 RETURNING id, email, name, role, phone`,
      [name, phone, role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error actualizando usuario (adminController.updateUser):', error);
    return res.status(500).json({ error: 'Error actualizando usuario' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    return res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('❌ Error eliminando usuario (adminController.deleteUser):', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

const createDriver = async (req, res) => {
  const { email, password, name, phone, vehicle_type = null, vehicle_plate = null } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password y name son requeridos' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está en uso' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const newUser = await db.query(
      'INSERT INTO users (email, password, name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, phone',
      [email, hashed, name, phone, 'driver']
    );

    const userId = newUser.rows[0].id;

    // driver_code secuencial simple (verifica tipo de columna en DB)
    const codeRes = await db.query("SELECT COALESCE(MAX(NULLIF(driver_code, '')::int), 100) + 1 AS next_code FROM drivers");
    const driver_code = codeRes.rows[0].next_code;

    await db.query(
      `INSERT INTO drivers (user_id, driver_code, vehicle_type, vehicle_plate, is_available)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, driver_code, vehicle_type, vehicle_plate, true]
    );

    return res.status(201).json({ message: 'Conductor creado', user: newUser.rows[0], driver_code });
  } catch (error) {
    console.error('❌ Error creando conductor (adminController.createDriver):', error);
    return res.status(500).json({ error: 'Error creando conductor' });
  }
};

module.exports = {
  getStats,
  getAllUsers,
  updateUser,
  deleteUser,
  createDriver
};