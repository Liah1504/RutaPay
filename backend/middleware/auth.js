const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rutapay_secret_2024');
    
    // Verificar que el usuario aún existe en la base de datos
    const user = await db.query('SELECT id, email, name, role FROM users WHERE id = $1', [decoded.id]);
    
    if (user.rows.length === 0) {
      return res.status(403).json({ error: 'Usuario no existe' });
    }

    req.user = user.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'No tienes permisos para realizar esta acción' 
      });
    }
    next();
  };
};

module.exports = { authenticateToken, authorize };