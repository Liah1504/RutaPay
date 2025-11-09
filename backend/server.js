const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); // <-- añadido para servir archivos estáticos

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

// Helper para requires tolerantes (no romperá el arranque si falta algún archivo)
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

// Importar rutas de forma tolerante (si alguna falta no romperá el servidor)
const authRoutes = tryRequire('./routes/auth', 'auth routes');
const driverRoutes = tryRequire('./routes/drivers', 'driver routes');
const routeRoutes = tryRequire('./routes/routes', 'route routes');
const tripRoutes = tryRequire('./routes/trips', 'trip routes');
const rechargesRoutes = tryRequire('./routes/recharges', 'recharges routes');
const userRoutes = tryRequire('./routes/userRoutes', 'user routes');
const adminRoutes = tryRequire('./routes/admin', 'admin routes');
const paymentRoutes = tryRequire('./routes/payment', 'payment routes');

console.log('🔍 Cargando rutas...');

// ✅ CORS CONFIGURADO
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

// Middleware para logging de requests
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

// Servir archivos estáticos (avatars subidos a /backend/public/avatars)
app.use('/public', express.static(path.join(__dirname, 'public')));

// 🌐 ENDPOINT DE SALUD - SIN AUTENTICACIÓN
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '🚀 Servidor Rutapay funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Ruta principal - SIN AUTENTICACIÓN
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Bienvenido a Rutapay API',
    version: '1.0.0',
    status: 'Servidor funcionando correctamente',
    endpoints: {
      auth: {
        'POST /api/auth/login': 'Iniciar sesión',
        'POST /api/auth/register': 'Registrar usuario'
      },
      users: { 
        'GET /api/users/profile': 'Obtener perfil del usuario actual'
      },
      drivers: {
        'GET /api/drivers/available': 'Choferes disponibles',
        'PUT /api/drivers/status': 'Actualizar estado chofer',
        'GET /api/drivers/profile': 'Perfil chofer'
      },
      routes: {
        'GET /api/routes': 'Todas las rutas',
        'GET /api/routes/propatria-chacaito': 'Ruta específica'
      },
      trips: {
        'POST /api/trips': 'Crear viaje',
        'GET /api/trips/passenger': 'Viajes del pasajero',
        'GET /api/trips/driver': 'Viajes del chofer',
        'PUT /api/trips/status': 'Actualizar estado viaje'
      },
      recharges: {
        'POST /api/recharges': 'Registrar recarga de saldo',
        'GET /api/recharges/pending': 'Ver recargas pendientes (admin)',
        'PUT /api/recharges/:id/confirm': 'Confirmar recarga (admin)'
      },
      payment: {
        'POST /api/payment/pay': 'Pago manual de pasajero a conductor'
      },
      admin: { 
        'GET /api/admin/users': 'Listar todos los usuarios',
        'PUT /api/admin/users/:id': 'Actualizar usuario',
        'DELETE /api/admin/users/:id': 'Eliminar usuario',
        'POST /api/admin/drivers': 'Crear conductor (admin)'
      },
      system: {
        'GET /api/health': 'Estado del servidor'
      }
    }
  });
});

// 📍 MONTAR RUTAS PRINCIPALES (solo si existen)
if (authRoutes) {
  app.use('/api/auth', authRoutes);
  console.log('✅ Mounted: /api/auth');
} else {
  console.warn('⚠️ Saltando montaje de /api/auth porque authRoutes no está disponible');
}

if (driverRoutes) {
  app.use('/api/drivers', driverRoutes);
  console.log('✅ Mounted: /api/drivers');
} else {
  console.warn('⚠️ Saltando montaje de /api/drivers porque driverRoutes no está disponible');
}

if (routeRoutes) {
  app.use('/api/routes', routeRoutes);
  console.log('✅ Mounted: /api/routes');
} else {
  console.warn('⚠️ Saltando montaje de /api/routes porque routeRoutes no está disponible');
}

if (tripRoutes) {
  app.use('/api/trips', tripRoutes);
  console.log('✅ Mounted: /api/trips');
} else {
  console.warn('⚠️ Saltando montaje de /api/trips porque tripRoutes no está disponible');
}

if (rechargesRoutes) {
  app.use('/api/recharges', rechargesRoutes);
  console.log('✅ Mounted: /api/recharges');
} else {
  console.warn('⚠️ Saltando montaje de /api/recharges porque rechargesRoutes no está disponible');
}

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

if (paymentRoutes) {
  app.use('/api/payment', paymentRoutes);
  console.log('✅ Mounted: /api/payment');
} else {
  console.warn('⚠️ Saltando montaje de /api/payment porque paymentRoutes no está disponible');
}

// ✅ RUTA DE PRUEBA PARA RUTAS - SIN AUTENTICACIÓN (TEMPORAL)
app.get('/api/routes/test', (req, res) => {
  console.log('✅ Ruta de prueba /api/routes/test accedida');
  res.json({
    success: true,
    message: '✅ Endpoint de rutas funcionando correctamente',
    testRoutes: [
      {
        id: 1,
        name: 'Propatria a Chacaíto - TEST',
        start_point: 'Propatria',
        end_point: 'Chacaíto',
        estimated_time: 45,
        distance: 12.5,
        fare: 15.50,
        is_active: true
      },
      {
        id: 2,
        name: 'Chacaíto a Propatria - TEST',
        start_point: 'Chacaíto',
        end_point: 'Propatria',
        estimated_time: 45,
        distance: 12.5,
        fare: 15.50,
        is_active: true
      }
    ],
    timestamp: new Date().toISOString()
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  console.log('❌ Ruta no encontrada:', req.originalUrl);
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.originalUrl} no existe en este servidor`,
    availableRoutes: [
      'GET /api/health',
      'GET /api/routes/test',
      'POST /api/auth/register', 
      'POST /api/auth/login',
      'GET /api/users/profile',
      'GET /api/drivers/available',
      'PUT /api/drivers/status', 
      'GET /api/drivers/profile',
      'GET /api/routes',
      'GET /api/routes/propatria-chacaito',
      'POST /api/trips',
      'GET /api/trips/passenger',
      'GET /api/trips/driver',
      'PUT /api/trips/status',
      'POST /api/recharges',
      'GET /api/recharges/pending',
      'PUT /api/recharges/:id/confirm',
      'POST /api/payment/pay',
      'GET /api/admin/users',
      'PUT /api/admin/users/:id',
      'DELETE /api/admin/users/:id'
    ]
  });
});

// 🚨 MANEJADOR DE ERRORES GLOBAL
app.use((error, req, res, next) => {
  console.error('❌ Error del servidor:', error);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' 
      ? 'Algo salió mal en el servidor' 
      : error.message,
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ ERROR NO CAPTURADO (uncaughtException):', error);
  console.log('🔄 El servidor continuará ejecutándose...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ PROMESA RECHAZADA NO MANEJADA (unhandledRejection):', reason);
  console.log('🔄 El servidor continuará ejecutándose...');
});

const server = app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 SERVICIO RUTAPAY INICIADO CORRECTAMENTE');
  console.log('='.repeat(60));
  console.log(`📡 Backend: http://localhost:${PORT}`);
  console.log(`🌐 Health: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test Routes: http://localhost:${PORT}/api/routes/test`);
  console.log(`👤 Frontend: http://localhost:3001`);
  console.log('='.repeat(60));
  console.log('✅ CORS configurado para:');
  console.log('   http://localhost:3001 ← TU FRONTEND');
  console.log('   http://localhost:3000');
  console.log('   http://localhost:5173');
  console.log('='.repeat(60));
});

// Cierre graceful del servidor
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor gracefully...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

module.exports = app;