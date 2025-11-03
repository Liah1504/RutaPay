// backend/server.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Importar rutas
const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/drivers');
const routeRoutes = require('./routes/routes');
const tripRoutes = require('./routes/trips');
const rechargesRoutes = require('./routes/recharges');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payment'); // <-- 1. IMPORTAR RUTA DE PAGO

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

// ✅ CORS CONFIGURADO CORRECTAMENTE
app.use(cors({
  origin: [
    'http://localhost:3001',  // ✅ TU FRONTEND
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

console.log('🔍 Cargando rutas...');

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
      payment: { // <-- NUEVA SECCIÓN DE ENDPOINTS DE PAGO
        'POST /api/payment/pay': 'Pago manual de pasajero a conductor'
      },
      admin: { 
        'GET /api/admin/users': 'Listar todos los usuarios',
        'PUT /api/admin/users/:id': 'Actualizar usuario',
        'DELETE /api/admin/users/:id': 'Eliminar usuario'
      },
      system: {
        'GET /api/health': 'Estado del servidor'
      }
    }
  });
});

// 📍 RUTAS PRINCIPALES
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/recharges', rechargesRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes); // <-- 2. USAR RUTA DE PAGO

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
      'POST /api/payment/pay', // <-- ¡NUEVO!
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
  console.log('   http://localhost:3001 ← TU FRONTEND');
  console.log('   http://localhost:3000');
  console.log('   http://localhost:5173');
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