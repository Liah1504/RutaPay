const db = require('../config/database');

// Actualizar estado del conductor (disponible/no disponible)
const updateDriverStatus = async (req, res) => {
  const { is_available, current_location } = req.body;
  const userId = req.user.id;

  try {
    const result = await db.query(
      'UPDATE drivers SET is_available = $1, current_location = $2 WHERE user_id = $3 RETURNING *',
      [is_available, current_location, userId]
    );

    res.json({
      message: 'Estado actualizado correctamente',
      driver: result.rows[0]
    });
  } catch (error) {
    console.error('Error actualizando estado conductor:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
};

// Obtener conductores disponibles
const getAvailableDrivers = async (req, res) => {
  try {
    const drivers = await db.query(`
      SELECT u.name, u.phone, d.* 
      FROM drivers d 
      JOIN users u ON d.user_id = u.id 
      WHERE d.is_available = true
    `);

    res.json(drivers.rows);
  } catch (error) {
    console.error('Error obteniendo conductores:', error);
    res.status(500).json({ error: 'Error al obtener conductores' });
  }
};

// Obtener perfil del conductor actual
const getDriverProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const driver = await db.query(`
      SELECT u.name, u.email, u.phone, d.* 
      FROM drivers d 
      JOIN users u ON d.user_id = u.id 
      WHERE d.user_id = $1
    `, [userId]);

    if (driver.rows.length === 0) {
      return res.status(404).json({ error: 'Conductor no encontrado' });
    }

    res.json(driver.rows[0]);
  } catch (error) {
    console.error('Error obteniendo perfil conductor:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

module.exports = { 
  updateDriverStatus, 
  getAvailableDrivers, 
  getDriverProfile 
};