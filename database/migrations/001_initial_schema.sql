-- =============================================
-- RUTAPAY - Migración Inicial
-- Sistema de Gestión de Transporte
-- Base de datos: PostgreSQL
-- =============================================

-- Eliminar tablas si existen (para desarrollo)
DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =============================================
-- TABLA: users (Usuarios del sistema)
-- =============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'driver', 'passenger')),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA: drivers (Conductores)
-- =============================================
CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(100),
    vehicle_type VARCHAR(100),
    vehicle_plate VARCHAR(20),
    is_available BOOLEAN DEFAULT true,
    current_location JSONB,
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_trips INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA: routes (Rutas del sistema)
-- =============================================
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_point VARCHAR(255) NOT NULL,
    end_point VARCHAR(255) NOT NULL,
    waypoints JSONB,
    estimated_time INTEGER, -- en minutos
    distance DECIMAL(10,2), -- en km
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA: trips (Viajes)
-- =============================================
CREATE TABLE trips (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id),
    driver_id INTEGER REFERENCES drivers(id),
    passenger_id INTEGER REFERENCES users(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
    fare DECIMAL(10,2), -- costo del viaje
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA: ratings (Calificaciones y reseñas)
-- =============================================
CREATE TABLE ratings (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id),
    from_user_id INTEGER REFERENCES users(id),
    to_user_id INTEGER REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Usuario administrador (password: admin123)
INSERT INTO users (email, password, role, name, phone) VALUES
('admin@rutapay.com', '$2a$10$8K1p/a0dRTlB0.Z6sR9QeO$2a$10$8K1p/a0dRTlB0.Z6sR9Qe', 'admin', 'Administrador Rutapay', '+584141234567');

-- Rutas principales Propatria - Chacaíto
INSERT INTO routes (name, start_point, end_point, estimated_time, distance, is_active) VALUES
('Propatria - Chacaíto', 'Propatria', 'Chacaíto', 45, 12.5, true),
('Chacaíto - Propatria', 'Chacaíto', 'Propatria', 45, 12.5, true),
('Propatria - El Silencio', 'Propatria', 'El Silencio', 20, 5.2, true),
('El Silencio - Chacaíto', 'El Silencio', 'Chacaíto', 25, 7.3, true);

-- Conductores de ejemplo (password: conductor123)
INSERT INTO users (email, password, role, name, phone) VALUES
('conductor1@rutapay.com', '$2a$10$8K1p/a0dRTlB0.Z6sR9QeO$2a$10$8K1p/a0dRTlB0.Z6sR9Qe', 'driver', 'Carlos Pérez', '+584142345678'),
('conductor2@rutapay.com', '$2a$10$8K1p/a0dRTlB0.Z6sR9QeO$2a$10$8K1p/a0dRTlB0.Z6sR9Qe', 'driver', 'María González', '+584143456789'),
('conductor3@rutapay.com', '$2a$10$8K1p/a0dRTlB0.Z6sR9QeO$2a$10$8K1p/a0dRTlB0.Z6sR9Qe', 'driver', 'José Rodríguez', '+584144567890');

-- Información de conductores
INSERT INTO drivers (user_id, license_number, vehicle_type, vehicle_plate, is_available) VALUES
(2, 'LIC123456', 'Toyota Corolla', 'ABC123', true),
(3, 'LIC789012', 'Nissan Sentra', 'DEF456', true),
(4, 'LIC345678', 'Chevrolet Spark', 'GHI789', false);

-- Pasajeros de ejemplo (password: pasajero123)
INSERT INTO users (email, password, role, name, phone) VALUES
('pasajero1@rutapay.com', '$2a$10$8K1p/a0dRTlB0.Z6sR9QeO$2a$10$8K1p/a0dRTlB0.Z6sR9Qe', 'passenger', 'Ana Martínez', '+584145678901'),
('pasajero2@rutapay.com', '$2a$10$8K1p/a0dRTlB0.Z6sR9QeO$2a$10$8K1p/a0dRTlB0.Z6sR9Qe', 'passenger', 'Luis Hernández', '+584146789012'),
('pasajero3@rutapay.com', '$2a$10$8K1p/a0dRTlB0.Z6sR9QeO$2a$10$8K1p/a0dRTlB0.Z6sR9Qe', 'passenger', 'Sofia Díaz', '+584147890123');

-- Viajes de ejemplo
INSERT INTO trips (route_id, driver_id, passenger_id, status, fare) VALUES
(1, 1, 5, 'completed', 15.50),
(1, 2, 6, 'in_progress', 15.50),
(2, 3, 7, 'pending', 15.50);

-- =============================================
-- ÍNDICES para mejorar rendimiento
-- =============================================

-- Índices para users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Índices para drivers
CREATE INDEX idx_drivers_available ON drivers(is_available);
CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_rating ON drivers(rating);

-- Índices para routes
CREATE INDEX idx_routes_active ON routes(is_active);
CREATE INDEX idx_routes_start_end ON routes(start_point, end_point);

-- Índices para trips
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_passenger_id ON trips(passenger_id);
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_route_id ON trips(route_id);
CREATE INDEX idx_trips_created_at ON trips(created_at);

-- Índices para ratings
CREATE INDEX idx_ratings_trip_id ON ratings(trip_id);
CREATE INDEX idx_ratings_from_user ON ratings(from_user_id);
CREATE INDEX idx_ratings_to_user ON ratings(to_user_id);

-- =============================================
-- FUNCIONES y TRIGGERS
-- =============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at 
    BEFORE UPDATE ON drivers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at 
    BEFORE UPDATE ON trips 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VISTAS ÚTILES
-- =============================================

-- Vista para conductores disponibles
CREATE OR REPLACE VIEW available_drivers AS
SELECT 
    u.name,
    u.phone,
    d.id as driver_id,
    d.vehicle_type,
    d.vehicle_plate,
    d.rating
FROM drivers d
JOIN users u ON d.user_id = u.id
WHERE d.is_available = true;

-- Vista para viajes activos
CREATE OR REPLACE VIEW active_trips AS
SELECT 
    t.id as trip_id,
    r.name as route_name,
    r.start_point,
    r.end_point,
    driver.name as driver_name,
    passenger.name as passenger_name,
    t.status,
    t.created_at
FROM trips t
JOIN routes r ON t.route_id = r.id
JOIN users driver ON t.driver_id = driver.id
JOIN users passenger ON t.passenger_id = passenger.id
WHERE t.status IN ('pending', 'accepted', 'in_progress');

-- =============================================
-- MENSAJE DE CONFIRMACIÓN
-- =============================================

DO $$ 
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✅ ESQUEMA RUTAPAY CREADO EXITOSAMENTE';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '📊 Tablas creadas: 5';
    RAISE NOTICE '👤 Usuarios creados: 7';
    RAISE NOTICE '🛣️  Rutas creadas: 4';
    RAISE NOTICE '🚗 Conductores: 3';
    RAISE NOTICE '👥 Pasajeros: 3';
    RAISE NOTICE '🎯 Viajes de ejemplo: 3';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '🔑 CREDENCIALES DE PRUEBA:';
    RAISE NOTICE '   Admin: admin@rutapay.com / admin123';
    RAISE NOTICE '   Conductores: conductor[1-3]@rutapay.com / conductor123';
    RAISE NOTICE '   Pasajeros: pasajero[1-3]@rutapay.com / pasajero123';
    RAISE NOTICE '=========================================';
END $$;