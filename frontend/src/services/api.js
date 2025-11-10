import axios from 'axios';

// Base URL: usa VITE_API_URL si está en Vite, si no usa localhost
const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_URL)
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:5002/api';

axios.defaults.baseURL = API_BASE;

// Si ya hay token guardado por el AuthContext (clave: 'rutapay_token'), aplicarlo al arrancar
try {
  const stored = localStorage.getItem('rutapay_token');
  if (stored) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
  }
} catch (e) {
  // ignore
}

export const userAPI = {
  getProfile: () => axios.get('/users/profile'),
  getProfileNoCache: () => axios.get('/users/profile', { params: { _t: Date.now() } }),
  updateProfile: (userData) => axios.put('/users/profile', userData),
  updateProfileForm: (formData) => axios.put('/users/profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export const authAPI = {
  login: (email, password) => axios.post('/auth/login', { email, password }),
  register: (userData) => axios.post('/auth/register', userData)
};

export const tripAPI = {
  createTrip: (tripData) => axios.post('/trips', tripData),
  getPassengerTrips: () => axios.get('/trips/passenger'),
  getDriverTrips: () => axios.get('/trips/driver'),
  updateStatus: (data) => axios.put('/trips/status', data)
};

export const rechargeAPI = {
  create: (rechargeData) => axios.post('/recharges', rechargeData),
  getPending: () => axios.get('/recharges/pending'),
  confirm: (id) => axios.put(`/recharges/${id}/confirm`),
  // Nuevo: rechazar recarga con razón (server debe exponer POST /recharges/:id/reject)
  reject: (id, reason) => axios.post(`/recharges/${id}/reject`, { reason })
};

export const routeAPI = {
  getAll: () => axios.get('/routes'),
  create: (routeData) => axios.post('/routes', routeData),
  update: (id, routeData) => axios.put(`/routes/${id}`, routeData)
};

export const driverAPI = {
  getProfile: () => axios.get('/drivers/profile'),
  getPayments: () => axios.get('/drivers/payments'),
  getPaymentsSummary: (date) => axios.get('/drivers/payments/summary', { params: { date } }),
  getNotifications: (limit = 5) => axios.get('/drivers/notifications', { params: { limit } }),
  updateProfile: (data) => axios.put('/drivers/profile', data)
};

export const notificationsAPI = {
  // driver notifications (existing)
  getLatestForDriver: (limit = 10) => axios.get('/drivers/notifications', { params: { limit } }),
  markAsRead: (id) => axios.put(`/notifications/${id}/read`),
  // Nuevo: obtener notificaciones del usuario (pasajero) - server debe exponer GET /notifications (user auth)
  getForUser: (limit = 20) => axios.get('/notifications', { params: { limit } })
};

export const adminAPI = {
  getStats: () => axios.get('/admin/stats'),
  getAllUsers: () => axios.get('/admin/users'),
  updateUser: (id, userData) => axios.put(`/admin/users/${id}`, userData),
  deleteUser: (id) => axios.delete(`/admin/users/${id}`),
  createDriver: (driverData) => axios.post('/admin/drivers', driverData),

  createUser: async (userData) => {
    const payloadWithRole = { ...userData, role: userData.role || 'admin' };
    try {
      return await axios.post('/admin/users', payloadWithRole);
    } catch (err) {
      if (!err.response || err.response.status !== 404) throw err;
    }
    try {
      return await axios.post('/users', payloadWithRole);
    } catch (err) {
      if (!err.response || err.response.status !== 404) throw err;
    }
    try {
      return await axios.post('/auth/register', payloadWithRole);
    } catch (err) {
      throw err;
    }
  },
};

export const paymentAPI = {
  executePayment: (paymentData) => axios.post('/payment/pay', paymentData)
};

export default axios;