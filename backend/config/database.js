const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'rutapay',
  password: process.env.DB_PASSWORD || '123456',
  port: process.env.DB_PORT || 5001,
});

// Probar la conexión
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.stack);
  } else {
    console.log('✅ Conectado a PostgreSQL - Rutapay');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};