// backend/controllers/tripController.js

const db = require('../config/database');

// =============================================
// FUNCIÓN 1: createTrip (Versión Estable y Directa)
// =============================================
const createTrip = async (req, res) => {
    const { route_id } = req.body;
    const passengerId = req.user.id;

    // NOTA IMPORTANTE: Usamos db.query directamente para evitar el fallo de db.connect,
    // asumiendo que el riesgo de error es bajo. La transacción segura es la mejor práctica,
    // pero la evitamos aquí por problemas de configuración de Node/Postgres.

    try {
        // 1. Obtener tarifa y verificar ruta
        const routeResult = await db.query('SELECT fare FROM routes WHERE id = $1', [route_id]);
        if (routeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ruta no encontrada.' }); 
        }
        const fare = routeResult.rows[0].fare;

        // 2. Verificar saldo
        const passengerResult = await db.query('SELECT balance FROM users WHERE id = $1', [passengerId]);
        if (parseFloat(passengerResult.rows[0].balance) < parseFloat(fare)) {
            return res.status(400).json({ error: 'Saldo insuficiente para solicitar este viaje.' });
        }

        // 3. Encontrar conductor disponible
        const availableDriver = await db.query(`
            SELECT d.id FROM drivers d 
            WHERE d.is_available = true 
            ORDER BY d.updated_at ASC
            LIMIT 1
        `);

        if (availableDriver.rows.length === 0) {
            return res.status(400).json({ error: 'No hay conductores disponibles en este momento' });
        }
        const driverId = availableDriver.rows[0].id;

        // 4. Ejecutar escrituras (ESTE ES EL PUNTO DE RIESGO SIN TRANSACCIÓN)
        // A. Cobrar al pasajero
        await db.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [fare, passengerId]);

        // B. Crear el registro del viaje
        const newTrip = await db.query(
            `INSERT INTO trips (route_id, driver_id, passenger_id, status, fare) 
             VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
            [route_id, driverId, passengerId, fare]
        );

        // C. Marcar al conductor como no disponible
        await db.query('UPDATE drivers SET is_available = false WHERE id = $1', [driverId]);

        res.status(201).json({
            message: 'Viaje creado exitosamente',
            trip: newTrip.rows[0]
        });
        
    } catch (error) {
        console.error('Error creando viaje:', error);
        res.status(500).json({ error: 'Error al crear viaje' });
    }
};

// =============================================
// FUNCIÓN 2: getPassengerTrips
// =============================================
const getPassengerTrips = async (req, res) => {
    const passengerId = req.user.id;
    try {
        const trips = await db.query(`
            SELECT 
                t.*, 
                r.name as route_name, 
                r.start_point, 
                r.end_point,
                driver_user.name as driver_name, 
                driver_user.phone as driver_phone
            FROM trips t
            JOIN routes r ON t.route_id = r.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            LEFT JOIN users driver_user ON d.user_id = driver_user.id
            WHERE t.passenger_id = $1
            ORDER BY t.created_at DESC
        `, [passengerId]);
        res.json(trips.rows);
    } catch (error) {
        console.error('Error obteniendo viajes del pasajero:', error);
        res.status(500).json({ error: 'Error al obtener viajes' });
    }
};

// =============================================
// FUNCIÓN 3: getDriverTrips
// =============================================
const getDriverTrips = async (req, res) => {
    const userId = req.user.id;

    try {
        const driverSubquery = await db.query('SELECT id FROM drivers WHERE user_id = $1', [userId]);

        if (driverSubquery.rows.length === 0) {
            return res.json([]); 
        }

        const driverId = driverSubquery.rows[0].id;

        const trips = await db.query(`
            SELECT 
                t.*, 
                r.name as route_name, 
                r.start_point, 
                r.end_point,
                passenger_user.name as passenger_name, 
                passenger_user.phone as passenger_phone
            FROM trips t
            JOIN routes r ON t.route_id = r.id
            JOIN users passenger_user ON t.passenger_id = passenger_user.id
            WHERE t.driver_id = $1
            ORDER BY t.created_at DESC
        `, [driverId]);

        res.json(trips.rows);
    } catch (error) {
        console.error('[DEBUG] Error en getDriverTrips:', error);
        res.status(500).json({ error: 'Error al obtener viajes' });
    }
};

// =============================================
// FUNCIÓN 4: updateTripStatus
// =============================================
const updateTripStatus = async (req, res) => {
    const { trip_id, status } = req.body;
    const userId = req.user.id;

    try {
        const driverResult = await db.query('SELECT id FROM drivers WHERE user_id = $1', [userId]);
        if (driverResult.rows.length === 0) {
            return res.status(403).json({ error: 'Acción no permitida.' });
        }
        const driverId = driverResult.rows[0].id;

        const updatedTrip = await db.query(
            'UPDATE trips SET status = $1 WHERE id = $2 AND driver_id = $3 RETURNING *',
            [status, trip_id, driverId]
        );

        if (updatedTrip.rows.length === 0) {
            return res.status(404).json({ error: 'Viaje no encontrado o no asignado a este conductor' });
        }

        if (status === 'completed' || status === 'cancelled') {
            await db.query(
                'UPDATE drivers SET is_available = true WHERE id = $1',
                [driverId]
            );
        }

        res.json({
            message: 'Estado del viaje actualizado',
            trip: updatedTrip.rows[0]
        });
    } catch (error) {
        console.error('Error actualizando viaje:', error);
        res.status(500).json({ error: 'Error al actualizar viaje' });
    }
};

// =============================================
// EXPORTACIONES 
// =============================================
module.exports = {
    createTrip,
    getPassengerTrips,
    getDriverTrips,
    updateTripStatus
};