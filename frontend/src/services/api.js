import axios from 'axios';

// Base URL: usa VITE_API_URL si está en Vite, si no usa localhost
const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_URL)
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:5002/api';

// Usamos el axios GLOBAL para que funcione con axios.defaults que tu AuthContext configura
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
  confirm: (id) => axios.put(`/recharges/${id}/confirm`)
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

export const adminAPI = {
  getStats: () => axios.get('/admin/stats'),
  getAllUsers: () => axios.get('/admin/users'),
  updateUser: (id, userData) => axios.put(`/admin/users/${id}`, userData),
  deleteUser: (id) => axios.delete(`/admin/users/${id}`),
  createDriver: (driverData) => axios.post('/admin/drivers', driverData)
};

export const paymentAPI = {
  executePayment: (paymentData) => axios.post('/payment/pay', paymentData)
};

export default axios;