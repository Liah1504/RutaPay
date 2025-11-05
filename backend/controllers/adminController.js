const db = require('../config/database');
const bcrypt = require('bcryptjs');

console.log('🔀 Cargando adminController');

// Obtener estadísticas básicas (ejemplo)
const getStats = async (req, res) => {
  try {
    const totalUsers = await db.query("SELECT COUNT(*) FROM users");
    const totalDrivers = await db.query("SELECT COUNT(*) FROM drivers");
    const totalTrips = await db.query("SELECT COUNT(*) FROM trips");
    const activeTrips = await db.query("SELECT COUNT(*) FROM trips WHERE status = 'in_progress'");
    const totalRevenue = await db.query("SELECT COALESCE(SUM(amount), 0) AS revenue_sum FROM recharges WHERE status = 'confirmada'");

    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count, 10),
      totalDrivers: parseInt(totalDrivers.rows[0].count, 10),
      totalTrips: parseInt(totalTrips.rows[0].count, 10),
      activeTrips: parseInt(activeTrips.rows[0].count, 10),
      totalRevenue: parseFloat(totalRevenue.rows[0].revenue_sum).toFixed(2)
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error del servidor al obtener estadísticas' });
  }
};

// Listar todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const users = await db.query('SELECT id, email, name, role, phone, balance FROM users ORDER BY id DESC');
    res.json(users.rows);
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Actualizar usuario (sin permitir crear passengers desde admin)
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

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error actualizando usuario (admin):', error);
    res.status(500).json({ error: 'Error actualizando usuario' });
  }
};

// Eliminar usuario
const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('❌ Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Crear conductor (solo admin) - endpoint protegido
const createDriver = async (req, res) => {
  const { email, password, name, phone, vehicle_type = null, vehicle_plate = null } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password y name son requeridos' });
  }

  try {
    // Verificar que no exista el email
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está en uso' });
    }

    // Crear user con role 'driver'
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const newUser = await db.query(
      'INSERT INTO users (email, password, name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, phone',
      [email, hashed, name, phone, 'driver']
    );

    const userId = newUser.rows[0].id;

    // Generar driver_code secuencial simple (int) - si no hay ninguno empezamos en 100
    const codeRes = await db.query("SELECT COALESCE(MAX(NULLIF(driver_code, '')::int), 100) + 1 AS next_code FROM drivers");
    const driver_code = codeRes.rows[0].next_code;

    // Insertar en tabla drivers
    await db.query(
      `INSERT INTO drivers (user_id, driver_code, vehicle_type, vehicle_plate, is_available)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, driver_code, vehicle_type, vehicle_plate, true]
    );

    res.status(201).json({ message: 'Conductor creado', user: newUser.rows[0], driver_code });
  } catch (error) {
    console.error('❌ Error creando conductor (admin):', error);
    res.status(500).json({ error: 'Error creando conductor' });
  }
};

module.exports = {
  getStats,
  getAllUsers,
  updateUser,
  deleteUser,
  createDriver
};