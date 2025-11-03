// backend/controllers/paymentController.js

const db = require('../config/database');

// POST /api/payment/pay
const manualPayment = async (req, res) => {
    // ID del pasajero que está pagando (viene del token)
    const passengerUserId = req.user.id;
    
    // 'driver_id' en el body es el 'driver_code' (ej. 101)
    const { driver_id, route_id } = req.body; 

    // NO usamos db.connect() porque tu configuración usa db.query()
    try {
        // --- Verificaciones ---

        // 1. Obtener la tarifa de la ruta
        const routeResult = await db.query('SELECT fare FROM routes WHERE id = $1', [route_id]);
        if (routeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ruta no encontrada' });
        }
        const fare = parseFloat(routeResult.rows[0].fare);

        // 2. Verificar saldo del pasajero
        const passengerResult = await db.query('SELECT balance FROM users WHERE id = $1', [passengerUserId]);
        const passengerBalance = parseFloat(passengerResult.rows[0].balance);
        
        if (passengerBalance < fare) {
            return res.status(400).json({ error: 'Saldo insuficiente' });
        }

        // 3. Verificar que el conductor existe (¡BUSCANDO EN driver_code!)
        const driverResult = await db.query('SELECT id, user_id FROM drivers WHERE driver_code = $1', [driver_id]);
        
        if (driverResult.rows.length === 0) {
            // Si el código (101, 102, etc.) no existe
            return res.status(404).json({ error: 'Código de conductor no encontrado' }); 
        }
        
        // Obtenemos el ID de la tabla 'drivers' (el 1, 2, o 3) y el user_id (para pagarle)
        const actualDriverId = driverResult.rows[0].id; // El ID de la fila (1, 2, 3...)
        const driverUserId = driverResult.rows[0].user_id; // El ID de la tabla 'users' (para el dinero)

        // --- Transacción Manual (El Pago) ---

        // 4. Descontar saldo al pasajero
        await db.query(
            'UPDATE users SET balance = balance - $1 WHERE id = $2',
            [fare, passengerUserId]
        );

        // 5. Acreditar saldo al conductor (a su 'user_id')
        await db.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [fare, driverUserId]
        );

        // 6. Registrar el viaje como 'completado'
        const newTrip = await db.query(
            `INSERT INTO trips (route_id, driver_id, passenger_id, status, fare) 
             VALUES ($1, $2, $3, 'completed', $4) RETURNING *`,
            [route_id, actualDriverId, passengerUserId, fare] // Usamos el ID real del driver (1, 2, 3)
        );
        
        res.status(201).json({
            message: 'Pago realizado y viaje registrado exitosamente',
            trip: newTrip.rows[0]
        });

    } catch (error) {
        console.error('❌ Error en el pago manual:', error);
        res.status(500).json({ error: error.message || 'Error al procesar el pago' });
    }
};

module.exports = {
    manualPayment
};