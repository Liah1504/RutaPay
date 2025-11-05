import axios from 'axios';

const API_BASE = 'http://localhost:5002/api';

// --- User API (perfil y actualización) ---
export const userAPI = {
  // Obtener perfil del usuario autenticado
  getProfile: () => axios.get(`${API_BASE}/users/profile`),

  // Actualizar perfil con JSON (email, phone, avatar como data URL opcional)
  updateProfile: (userData) => axios.put(`${API_BASE}/users/profile`, userData),

  // Actualizar perfil con multipart/form-data (para subir avatar como archivo)
  updateProfileForm: (formData) => axios.put(`${API_BASE}/users/profile`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

// --- Autenticación ---
export const authAPI = {
  login: (email, password) => axios.post(`${API_BASE}/auth/login`, { email, password }),
  register: (userData) => axios.post(`${API_BASE}/auth/register`, userData) // por defecto crea pasajeros
};

// --- Trips API ---
export const tripAPI = {
  createTrip: (tripData) => axios.post(`${API_BASE}/trips`, tripData),
  getPassengerTrips: () => axios.get(`${API_BASE}/trips/passenger`),
  getDriverTrips: () => axios.get(`${API_BASE}/trips/driver`),
  updateStatus: (data) => axios.put(`${API_BASE}/trips/status`, data)
};

// --- Recargas ---
export const rechargeAPI = {
  create: (rechargeData) => axios.post(`${API_BASE}/recharges`, rechargeData),
  getPending: () => axios.get(`${API_BASE}/recharges/pending`),
  confirm: (id) => axios.put(`${API_BASE}/recharges/${id}/confirm`)
};

// --- Rutas ---
export const routeAPI = {
  getAll: () => axios.get(`${API_BASE}/routes`),
  create: (routeData) => axios.post(`${API_BASE}/routes`, routeData),
  update: (id, routeData) => axios.put(`${API_BASE}/routes/${id}`, routeData)
};

// --- Drivers (conductor) ---
export const driverAPI = {
  getProfile: () => axios.get(`${API_BASE}/drivers/profile`),
  getPayments: () => axios.get(`${API_BASE}/drivers/payments`),
  getPaymentsSummary: (date) => axios.get(`${API_BASE}/drivers/payments/summary`, { params: { date } })
};

// --- Admin ---
export const adminAPI = {
  getStats: () => axios.get(`${API_BASE}/admin/stats`),
  getAllUsers: () => axios.get(`${API_BASE}/admin/users`),
  updateUser: (id, userData) => axios.put(`${API_BASE}/admin/users/${id}`, userData),
  deleteUser: (id) => axios.delete(`${API_BASE}/admin/users/${id}`),
  // Crear conductor (solo admin)
  createDriver: (driverData) => axios.post(`${API_BASE}/admin/drivers`, driverData)
};

// --- Pagos (pasajero -> conductor) ---
export const paymentAPI = {
  executePayment: (paymentData) => axios.post(`${API_BASE}/payment/pay`, paymentData)
};