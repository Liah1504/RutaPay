// src/services/api.js
// Instancia axios centralizada: exporta `api` como default y wrappers (userAPI, adminAPI, etc.)
// MODIFICADO POR MÍ: usar una instancia central `api` para que AuthContext aplique token sobre la misma instancia.

import axios from 'axios';

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_URL)
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:5002/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Si ya hay token guardado por el AuthContext (clave: 'rutapay_token'), aplicarlo al arrancar
try {
  const stored = localStorage.getItem('rutapay_token');
  if (stored) {
    api.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
  }
} catch (e) {
  // ignore
}

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  getProfileNoCache: () => api.get('/users/profile', { params: { _t: Date.now() } }),
  updateProfile: (userData) => api.put('/users/profile', userData),
  updateProfileForm: (formData) => api.put('/users/profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  forgotPassword: (email) => api.post('/auth/forgot', { email }),
  resetPassword: (payload) => api.post('/auth/reset', payload)
};

export const tripAPI = {
  createTrip: (tripData) => api.post('/trips', tripData),
  getPassengerTrips: () => api.get('/trips/passenger'),
  getDriverTrips: () => api.get('/trips/driver'),
  updateStatus: (data) => api.put('/trips/status', data)
};

export const rechargeAPI = {
  create: (rechargeData) => api.post('/recharges', rechargeData),
  getPending: () => api.get('/recharges/pending'),
  confirm: (id) => api.put(`/recharges/${id}/confirm`),
  reject: (id, reason) => api.post(`/recharges/${id}/reject`, { reason })
};

export const routeAPI = {
  getAll: () => api.get('/routes'),
  create: (routeData) => api.post('/routes', routeData),
  update: (id, routeData) => api.put(`/routes/${id}`, routeData)
};

export const driverAPI = {
  getProfile: () => api.get('/drivers/profile'),
  getPayments: () => api.get('/drivers/payments'),
  getPaymentsSummary: (date) => api.get('/drivers/payments/summary', { params: { date } }),
  getNotifications: (limit = 5, unread = false) => api.get('/notifications', { params: { limit, unread } }),
  updateProfile: (data) => api.put('/drivers/profile', data)
};

export const notificationsAPI = {
  getLatestForDriver: (limit = 10) => api.get('/notifications', { params: { limit, unread: true } }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  getForUser: (limit = 20) => api.get('/notifications', { params: { limit } }),
  getForAdmin: (limit = 50, type = null) => api.get('/notifications/admin', { params: { limit, type } })
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getAllUsers: () => api.get('/admin/users'),
  updateUser: (id, userData) => api.put(`/admin/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  createDriver: (driverData) => api.post('/admin/drivers', driverData),
  createUser: async (userData) => {
    const payloadWithRole = { ...userData, role: userData.role || 'admin' };
    try { return await api.post('/admin/users', payloadWithRole); } catch (err) { if (!err.response || err.response.status !== 404) throw err; }
    try { return await api.post('/users', payloadWithRole); } catch (err) { if (!err.response || err.response.status !== 404) throw err; }
    return await api.post('/auth/register', payloadWithRole);
  }
};

export const paymentAPI = {
  executePayment: (paymentData) => api.post('/payment/pay', paymentData),
  getHistory: (date) => api.get('/payment', { params: { date } }),
  getHistoryRange: (startIso, endIso) => api.get('/payment', { params: { start: startIso, end: endIso } })
};

export default api;