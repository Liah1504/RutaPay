// Este script se usa para crear el primer usuario administrador en la base de datos.
// Se debe ejecutar una sola vez o cuando necesites resetear al administrador.

// Importamos las dependencias necesarias
require('dotenv').config({ path: '../.env' }); // Apuntamos al .env de la carpeta backend
const bcrypt = require('bcryptjs');
const db = require('../config/database');

// --- DATOS DEL ADMINISTRADOR QUE VAMOS A CREAR ---
const adminData = {
  name: 'Administrador Principal',
  email: 'admin@rutapay.com',
  password: 'admin123', // La contraseña en texto plano que usaremos para el login
  phone: '0414-0000000',
  role: 'admin'
};

const createAdmin = async () => {
  console.log('--- Iniciando script de creación de administrador ---');

  try {
    // 1. Verificar si el administrador ya existe
    console.log(`Buscando si el usuario "${adminData.email}" ya existe...`);
    const userExists = await db.query('SELECT * FROM users WHERE email = $1', [adminData.email]);

    if (userExists.rows.length > 0) {
      console.log('✅ El usuario administrador ya existe en la base de datos. No se necesita hacer nada.');
      return; // Si ya existe, terminamos el script
    }

    console.log('Usuario no encontrado. Procediendo a crearlo...');

    // 2. Hashear la contraseña (usando la misma lógica que en tu authController)
    console.log('Generando hash para la contraseña...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);
    console.log('Hash generado exitosamente.');

    // 3. Insertar el nuevo administrador en la base de datos
    console.log('Insertando nuevo administrador en la tabla "users"...');
    const newUser = await db.query(
      'INSERT INTO users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role',
      [adminData.name, adminData.email, hashedPassword, adminData.phone, adminData.role]
    );

    console.log('🎉 ¡ÉXITO! Usuario administrador creado con los siguientes datos:');
    console.log(newUser.rows[0]);
    console.log('\nAhora puedes iniciar sesión con:');
    console.log(`   - Email: ${adminData.email}`);
    console.log(`   - Contraseña: ${adminData.password}`);

  } catch (error) {
    console.error('❌ ERROR: Ocurrió un problema durante la creación del administrador.');
    console.error(error);
  } finally {
    // 4. Cierra la conexión a la base de datos para que el script termine
    console.log('--- Script finalizado ---');
  }
};

// Ejecutamos la función
createAdmin();