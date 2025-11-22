// backend/controllers/adminController.js
// Controlador admin: getStats, getAllUsers, updateUser, deleteUser, createDriver, getRevenue
// MODIFICADO: conserva tu lógica original y añade getRevenue (periodo/rango).
// Usa ../config/database tal como en tu repo.

const db = require('../config/database');
const bcrypt = require('bcryptjs');

console.log('🔀 Cargando adminController');

const getStats = async (req, res) => {
  try {
    const [
      totalUsersResult,
      totalDriversResult,
      totalTripsResult,
      activeTripsResult,
      totalRevenueResult
    ] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS total_users FROM users"),
      db.query("SELECT COUNT(*)::int AS total_drivers FROM drivers"),
      db.query("SELECT COUNT(*)::int AS total_trips FROM trips"),
      db.query("SELECT COUNT(*)::int AS active_trips FROM trips WHERE status = 'in_progress'"),
      db.query("SELECT COALESCE(SUM(amount),0)::numeric::float8 AS total_revenue FROM recharges WHERE status IN ('confirmada','confirmed')")
    ]);

    const stats = {
      totalUsers: totalUsersResult.rows[0]?.total_users ?? 0,
      totalDrivers: totalDriversResult.rows[0]?.total_drivers ?? 0,
      totalTrips: totalTripsResult.rows[0]?.total_trips ?? 0,
      activeTrips: activeTripsResult.rows[0]?.active_trips ?? 0,
      totalRevenue: Number(totalRevenueResult.rows[0]?.total_revenue ?? 0)
    };

    return res.json(stats);
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas (adminController.getStats):', error);
    return res.status(500).json({ error: 'Error interno al obtener estadísticas' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await db.query('SELECT id, email, name, role, phone, balance FROM users ORDER BY id DESC');
    return res.json(users.rows);
  } catch (error) {
    console.error('❌ Error obteniendo usuarios (adminController.getAllUsers):', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

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

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error actualizando usuario (adminController.updateUser):', error);
    return res.status(500).json({ error: 'Error actualizando usuario' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    return res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('❌ Error eliminando usuario (adminController.deleteUser):', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

/**
 * createDriver:
 * - Crea user + driver dentro de una transacción.
 * - Genera driver_code de forma segura (solo valores numéricos).
 * - Devuelve driver_code (y user) en la respuesta.
 */
const createDriver = async (req, res) => {
  const { email, password, name, phone = null, vehicle_type = null, vehicle_plate = null } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password y name son requeridos' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está en uso' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // Inicio de transacción: crear usuario y fila en drivers de forma atómica
    await db.query('BEGIN');

    const newUser = await db.query(
      'INSERT INTO users (email, password, name, phone, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id, email, name, role, phone',
      [email, hashed, name, phone, 'driver']
    );
    const userId = newUser.rows[0].id;

    // Generar driver_code seguro: considerar sólo códigos que sean enteros
    // Evita fallos si hay driver_code no numérico
    const codeRes = await db.query(
      `SELECT COALESCE(MAX( (CASE WHEN driver_code ~ '^[0-9]+$' THEN driver_code::int ELSE NULL END) ), 100) + 1 AS next_code
       FROM drivers`
    );
    const driver_code = String(codeRes.rows[0].next_code);

    // Insertar driver
    await db.query(
      `INSERT INTO drivers (user_id, driver_code, vehicle_type, vehicle_plate, is_available, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [userId, driver_code, vehicle_type, vehicle_plate, true]
    );

    await db.query('COMMIT');

    return res.status(201).json({ message: 'Conductor creado', user: newUser.rows[0], driver_code });
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch (e) { /* ignore rollback error */ }
    console.error('❌ Error creando conductor (adminController.createDriver):', error);
    if (error && error.code === '22P02') {
      return res.status(400).json({ error: 'Error en datos numéricos al generar driver_code. Revisa registros existentes.' });
    }
    return res.status(500).json({ error: 'Error creando conductor' });
  }
};

/**
 * getRevenue:
 * Soporta:
 *  - /api/admin/revenue?period=day|week|month
 *  - /api/admin/revenue?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Devuelve: { total: number, items: [{ date, amount }, ...] }
 *
 * Implementación defensiva: si existe tabla payments la usa; si no, intenta recharges.
 */
const getRevenue = async (req, res) => {
  try {
    const { period, start, end } = req.query;

    // Detectar tabla source: payments preferred, else recharges
    const tblCheck = await db.query(`SELECT to_regclass('public.payments') AS tpayments, to_regclass('public.recharges') AS trecharges`);
    const hasPayments = Boolean(tblCheck.rows[0]?.tpayments);
    const hasRecharges = Boolean(tblCheck.rows[0]?.trecharges);

    const sourceTable = hasPayments ? 'payments' : (hasRecharges ? 'recharges' : null);
    if (!sourceTable) {
      // No hay tablas conocidas, respondemos vacío
      return res.json({ total: 0, items: [] });
    }

    const isRecharge = sourceTable === 'recharges';

    // Rango start/end => group by day
    if (start && end) {
      const q = `
        SELECT date_trunc('day', created_at)::date AS date, SUM(amount)::numeric::float8 AS amount
        FROM ${sourceTable}
        ${isRecharge ? "WHERE status IN ('confirmada','confirmed') AND created_at::date BETWEEN $1::date AND $2::date" : "WHERE created_at::date BETWEEN $1::date AND $2::date"}
        GROUP BY 1 ORDER BY 1
      `;
      const r = await db.query(q, [start, end]);
      const total = r.rows.reduce((s, row) => s + Number(row.amount || 0), 0);
      return res.json({ total, items: r.rows.map(rw => ({ date: rw.date, amount: Number(rw.amount || 0) })) });
    }

    // Interpretar period (default day)
    const p = (period || 'day').toString().toLowerCase();

    if (p === 'day') {
      // Agrupar por hora para hoy
      const q = `
        SELECT date_trunc('hour', created_at) AS period, SUM(amount)::numeric::float8 AS amount
        FROM ${sourceTable}
        ${isRecharge ? "WHERE status IN ('confirmada','confirmed') AND created_at::date = current_date" : "WHERE created_at::date = current_date"}
        GROUP BY 1 ORDER BY 1
      `;
      const r = await db.query(q);
      const total = r.rows.reduce((s, row) => s + Number(row.amount || 0), 0);
      const items = r.rows.map(row => ({ date: row.period instanceof Date ? row.period.toISOString() : row.period, amount: Number(row.amount || 0) }));
      return res.json({ total, items });
    } else if (p === 'week') {
      const q = `
        SELECT date_trunc('day', created_at)::date AS date, SUM(amount)::numeric::float8 AS amount
        FROM ${sourceTable}
        ${isRecharge ? "WHERE status IN ('confirmada','confirmed') AND created_at >= date_trunc('week', current_date)" : "WHERE created_at >= date_trunc('week', current_date)"}
        GROUP BY 1 ORDER BY 1
      `;
      const r = await db.query(q);
      const total = r.rows.reduce((s, row) => s + Number(row.amount || 0), 0);
      return res.json({ total, items: r.rows.map(rw => ({ date: rw.date, amount: Number(rw.amount || 0) })) });
    } else if (p === 'month') {
      const q = `
        SELECT date_trunc('day', created_at)::date AS date, SUM(amount)::numeric::float8 AS amount
        FROM ${sourceTable}
        ${isRecharge ? "WHERE status IN ('confirmada','confirmed') AND created_at >= date_trunc('month', current_date)" : "WHERE created_at >= date_trunc('month', current_date)"}
        GROUP BY 1 ORDER BY 1
      `;
      const r = await db.query(q);
      const total = r.rows.reduce((s, row) => s + Number(row.amount || 0), 0);
      return res.json({ total, items: r.rows.map(rw => ({ date: rw.date, amount: Number(rw.amount || 0) })) });
    }

    // period inválido
    return res.status(400).json({ error: 'Parámetro period inválido. Use day|week|month o start/end' });
  } catch (err) {
    console.error('❌ Error adminController.getRevenue:', err);
    return res.status(500).json({ error: 'Error obteniendo ingresos' });
  }
};

module.exports = {
  getStats,
  getAllUsers,
  updateUser,
  deleteUser,
  createDriver,
  getRevenue
};