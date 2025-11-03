export const USER_ROLES = {
  ADMIN: 'admin',
  DRIVER: 'driver',
  PASSENGER: 'passenger'
};

export const TRIP_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

export const ROUTE_COORDINATES = {
  PROPATRIA: { lat: 10.5000, lng: -66.9167 },
  CHACAITO: { lat: 10.4950, lng: -66.8533 }
};

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register'
  },
  DRIVERS: {
    STATUS: '/drivers/status',
    AVAILABLE: '/drivers/available'
  },
  ROUTES: {
    ALL: '/routes',
    PROPATRIA_CHACAITO: '/routes/propatria-chacaito'
  },
  TRIPS: {
    CREATE: '/trips',
    PASSENGER: '/trips/passenger',
    DRIVER: '/trips/driver',
    UPDATE_STATUS: '/trips/status'
  }
};