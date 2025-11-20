// backend/server.js
// Punto de entrada del backend: monta routers tolerantes (tryRequire), lista rutas para debug,
// sirve estáticos y maneja errores globales.
// Reemplaza tu archivo server.js con este, reinicia el servidor y observa los logs.

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

/**
 * tryRequire: intenta require y devuelve null si falla.
 * Loguea el fallo sin detener el arranque del servidor.
 */
function tryRequire(modulePath, friendlyName) {
  try {
    const mod = require(modulePath);
    console.log(`✅ Require exitoso: ${modulePath}`);
    return mod;
  } catch (err) {
    console.warn(`⚠️ No se pudo require '${modulePath}' (${friendlyName || 'módulo'}):`, err.message);
    return null;
  }
}

// Cargar routers/controladores (algunos pueden ser opcionales)
const authRoutes = tryRequire('./routes/auth', 'auth routes');
const driverRoutes = tryRequire('./routes/drivers', 'driver routes');
const routeRoutes = tryRequire('./routes/routes', 'route routes');
const tripRoutes = tryRequire('./routes/trips', 'trip routes');
const rechargesRoutes = tryRequire('./routes/recharges', 'recharges routes');
const userRoutes = tryRequire('./routes/userRoutes', 'user routes'); // tu archivo se llama userRoutes.js
const adminRoutes = tryRequire('./routes/admin', 'admin routes');
const paymentRoutes = tryRequire('./routes/payment', 'payment routes');
const notificationsRoutes = tryRequire('./routes/notifications', 'notifications routes');
const reportsController = tryRequire('./controllers/reportsController', 'reports controller'); // opcional

console.log('🔍 Cargando rutas...');

app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'Authorization']
}));

// Logging middleware para ver peticiones entrantes y si traen Authorization
app.use((req, res, next) => {
  console.log('🔍 Request:', {
    method: req.method,
    url: req.url,
    origin: req.headers.origin,
    authorization: req.headers.authorization ? 'PRESENTE' : 'AUSENTE',
    timestamp: new Date().toISOString()
  });
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (ej. avatars subidos en /public/avatars)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Endpoint de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor funcionando',
    timestamp: new Date().toISOString()
  });
});

// Montar routers si existen
if (authRoutes) { app.use('/api/auth', authRoutes); console.log('✅ Mounted: /api/auth'); }
if (driverRoutes) { app.use('/api/drivers', driverRoutes); console.log('✅ Mounted: /api/drivers'); }
if (routeRoutes) { app.use('/api/routes', routeRoutes); console.log('✅ Mounted: /api/routes'); }
if (tripRoutes) { app.use('/api/trips', tripRoutes); console.log('✅ Mounted: /api/trips'); }
if (rechargesRoutes) { app.use('/api/recharges', rechargesRoutes); console.log('✅ Mounted: /api/recharges'); }
if (notificationsRoutes) { app.use('/api/notifications', notificationsRoutes); console.log('✅ Mounted: /api/notifications'); }
if (paymentRoutes) { app.use('/api/payment', paymentRoutes); console.log('✅ Mounted: /api/payment'); }

// Montar users y admin routers (verifica que los archivos existan con esos nombres)
if (userRoutes) {
  app.use('/api/users', userRoutes);
  console.log('✅ Mounted: /api/users');
} else {
  console.warn('⚠️ Saltando montaje de /api/users porque userRoutes no está disponible');
}

if (adminRoutes) {
  app.use('/api/admin', adminRoutes);
  console.log('✅ Mounted: /api/admin');
} else {
  console.warn('⚠️ Saltando montaje de /api/admin porque adminRoutes no está disponible');
}

// Ruta de prueba
app.get('/api/routes/test', (req, res) => {
  res.json({ success: true, message: 'Endpoint de rutas funcionando' });
});

/**
 * Helper temporal para listar rutas montadas en el app (útil para debugging en desarrollo).
 * Muestra rutas internas; si ves "GET /stats" aquí y tienes admin mounted, la ruta completa
 * será /api/admin/stats.
 */
function listRoutes(app) {
  try {
    const routes = [];
    app._router.stack.forEach(mw => {
      if (mw.route && mw.route.path) {
        const methods = Object.keys(mw.route.methods).join(',').toUpperCase();
        routes.push(`${methods} ${mw.route.path}`);
      } else if (mw.name === 'router' && mw.handle && mw.handle.stack) {
        mw.handle.stack.forEach(handler => {
          if (handler.route && handler.route.path) {
            const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
            routes.push(`${methods} ${handler.route.path}`);
          }
        });
      }
    });
    console.log('--- Mounted routes ---\n' + routes.join('\n'));
  } catch (err) {
    console.warn('No se pudo listar rutas:', err && (err.message || err));
  }
}

// Lista rutas (temporal en desarrollo)
listRoutes(app);

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  console.log('❌ Ruta no encontrada:', req.originalUrl);
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.originalUrl} no existe en este servidor`,
    // lista de ejemplo que ayuda a debuggear desde el frontend
    availableRoutes: [
      'GET /api/health',
      'GET /api/routes/test',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/users/profile',
      'PUT /api/users/profile',
      'GET /api/drivers/available',
      'PUT /api/drivers/status',
      'GET /api/drivers/profile',
      'GET /api/routes',
      'POST /api/trips',
      'GET /api/trips/passenger',
      'GET /api/trips/driver',
      'PUT /api/trips/status',
      'POST /api/recharges',
      'GET /api/recharges/pending',
      'PUT /api/recharges/:id/confirm',
      'POST /api/payment/pay',
      'GET /api/admin/users'
    ]
  });
});

// Error handler global
app.use((error, req, res, next) => {
  console.error('❌ Error del servidor:', error && (error.stack || error.message || error));
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? 'Algo salió mal' : (error.message || String(error)),
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ ERROR NO CAPTURADO (uncaughtException):', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ PROMESA RECHAZADA NO MANEJADA (unhandledRejection):', reason);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 SERVICIO RUTAPAY INICIADO CORRECTAMENTE');
  console.log(`📡 Backend: http://localhost:${PORT}`);
  console.log('='.repeat(60));
});

module.exports = app;