const db = require('../config/database');

// Obtener todas las rutas
const getAllRoutes = async (req, res) => {
  // DEBUG
  console.log('--- [DEBUG] Ejecutando getAllRoutes ---');
  try {
    const routes = await db.query(`
      SELECT * FROM routes
      WHERE is_active = true
      ORDER BY name
    `);
    console.log(`[DEBUG] Encontradas ${routes.rows.length} rutas.`);
    res.json(routes.rows);
  } catch (error) {
    console.error('❌ Error obteniendo todas las rutas:', error);
    res.status(500).json({ error: 'Error al obtener las rutas' });
  }
};

// Obtener ruta específica por ID
const getRouteById = async (req, res) => {
  const { id } = req.params;
  try {
    const route = await db.query('SELECT * FROM routes WHERE id = $1', [id]);
    if (route.rows.length === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    res.json(route.rows[0]);
  } catch (error) {
    console.error('Error obteniendo ruta por ID:', error);
    res.status(500).json({ error: 'Error al obtener ruta' });
  }
};

// Crear nueva ruta (solo admin)
const createRoute = async (req, res) => {
  const { name, start_point, end_point, waypoints, estimated_time, distance, fare } = req.body;
  try {
    const newRoute = await db.query(
      `INSERT INTO routes (name, start_point, end_point, waypoints, estimated_time, distance, fare, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
      [name, start_point, end_point, waypoints, estimated_time, distance, fare]
    );
    res.status(201).json({
      message: 'Ruta creada exitosamente',
      route: newRoute.rows[0]
    });
  } catch (error) {
    console.error('Error creando ruta:', error);
    res.status(500).json({ error: 'Error al crear ruta' });
  }
};

// Actualizar ruta
const updateRoute = async (req, res) => {
  const { id } = req.params;
  const { name, start_point, end_point, waypoints, estimated_time, distance, is_active, fare } = req.body;
  try {
    const updatedRoute = await db.query(
      `UPDATE routes
       SET name = $1, start_point = $2, end_point = $3, waypoints = $4,
           estimated_time = $5, distance = $6, is_active = $7, fare = $8
       WHERE id = $9 RETURNING *`,
      [name, start_point, end_point, waypoints, estimated_time, distance, is_active, fare, id]
    );
    if (updatedRoute.rows.length === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    res.json({
      message: 'Ruta actualizada exitosamente',
      route: updatedRoute.rows[0]
    });
  } catch (error) {
    console.error('Error actualizando ruta:', error);
    res.status(500).json({ error: 'Error al actualizar ruta' });
  }
};

// Desactivar ruta
const deactivateRoute = async (req, res) => {
  const { id } = req.params;
  try {
    const updatedRoute = await db.query(
      'UPDATE routes SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    if (updatedRoute.rows.length === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    res.json({
      message: 'Ruta desactivada exitosamente',
      route: updatedRoute.rows[0]
    });
  } catch (error) {
    console.error('Error desactivando ruta:', error);
    res.status(500).json({ error: 'Error al desactivar ruta' });
  }
};

// Obtener rutas más populares
const getPopularRoutes = async (req, res) => {
  try {
    const popularRoutes = await db.query(`
      SELECT r.*, COUNT(t.id) as trip_count
      FROM routes r
      LEFT JOIN trips t ON r.id = t.route_id
      WHERE r.is_active = true
      GROUP BY r.id
      ORDER BY trip_count DESC
      LIMIT 5
    `);
    res.json(popularRoutes.rows);
  } catch (error) {
    console.error('Error obteniendo rutas populares:', error);
    res.status(500).json({ error: 'Error al obtener rutas populares' });
  }
};

module.exports = {
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deactivateRoute,
  getPopularRoutes
};
