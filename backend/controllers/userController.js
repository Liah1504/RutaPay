const db = require('../config/database');

// Obtener el perfil del usuario autenticado (incluyendo el saldo)
const getMyProfile = async (req, res) => {
  // El ID del usuario viene del token, gracias al middleware
  const userId = req.user.id;

  try {
    const user = await db.query(
      'SELECT id, email, name, role, phone, balance FROM users WHERE id = $1', 
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Enviamos el perfil completo del usuario
    res.json(user.rows[0]);
  } catch (error) {
    console.error('❌ Error obteniendo perfil de usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getMyProfile };