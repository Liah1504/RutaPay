// backend/middleware/auth.js
// Middleware de autenticación y autorización
// MODIFICADO POR MÍ: manejo de roles más tolerante + logs útiles

const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('AUTH: no se recibió token en headers');
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    const secret = process.env.JWT_SECRET || 'rutapay_secret_2024';
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      console.log('AUTH: token inválido o expirado', err.message);
      return res.status(403).json({ error: 'Token inválido' });
    }

    const userQ = await db.query('SELECT id, email, name, role FROM users WHERE id = $1', [decoded.id]);
    if (userQ.rows.length === 0) {
      console.log(`AUTH: usuario id=${decoded.id} no existe en DB`);
      return res.status(403).json({ error: 'Usuario no existe' });
    }

    req.user = userQ.rows[0];
    console.log('AUTH: usuario autenticado ->', { id: req.user.id, email: req.user.email, role: req.user.role });
    return next();
  } catch (err) {
    console.error('AUTH: error interno en authenticateToken', err);
    return res.status(500).json({ error: 'Error interno de autenticación' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log('AUTH.authorize: usuario no autenticado');
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const userRole = (req.user.role || '').toString().toLowerCase();
    const normalizedRoles = roles.map(r => (r || '').toString().toLowerCase());

    // Map aliases
    const allowedAliases = {
      admin: ['admin', 'administrator', 'administrador']
    };

    const expanded = new Set();
    normalizedRoles.forEach(r => {
      if (allowedAliases[r]) allowedAliases[r].forEach(a => expanded.add(a));
      expanded.add(r);
    });

    if (!expanded.has(userRole)) {
      console.log(`AUTH.authorize: usuario role=${userRole} no autorizado para ${roles}`);
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
    }
    return next();
  };
};

module.exports = {
  authenticateToken,
  authorize
};