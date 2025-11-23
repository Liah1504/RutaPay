// src/services/api.js
// Instancia axios centralizada: exporta `api` como default y wrappers (userAPI, authAPI, tripAPI, rechargeAPI, routeAPI, driverAPI, notificationsAPI, adminAPI, paymentAPI)
// ----------------- ACTUALIZADO -----------------
// - driverAPI.getPaymentsSummary ahora apunta a admin path '/admin/drivers/payments/summary'
// - Se agregó adminAPI.getDriverBalancesRange que envuelve ese endpoint.
// - Se agregó notificationsAPI.markAllRead para marcar todas las notificaciones como leídas.

import axios from 'axios';

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_URL)
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : 'http://localhost:5002/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
});

// Token helper utilities
export const setAuthToken = (token) => {
  try {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('rutapay_token', token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('rutapay_token');
    }
  } catch (err) {
    // ignore storage errors
    console.warn('setAuthToken error', err);
  }
};

export const clearAuthToken = () => setAuthToken(null);

// Apply stored token (if any) at startup
try {
  const stored = localStorage.getItem('rutapay_token');
  if (stored) {
    api.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
  }
} catch (e) {
  // ignore
}

// Response interceptor: if 401, clear token (optional) and propagate
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error?.config;
    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      // optional: clear token so user can login again
      try {
        localStorage.removeItem('rutapay_token');
        delete api.defaults.headers.common['Authorization'];
      } catch (e) { /* ignore */ }
    }
    return Promise.reject(error);
  }
);

// --- API wrappers ---

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
  // updated: call admin endpoint (requires admin token) or other admin endpoints
  getPaymentsSummary: (params) => api.get('/admin/drivers/payments/summary', { params }),
  getNotifications: (limit = 5, unread = false) => api.get('/notifications', { params: { limit, unread } }),
  updateProfile: (data) => api.put('/drivers/profile', data)
};

export const notificationsAPI = {
  // Get latest notifications for the current user (optionally only unread)
  getLatestForDriver: (limit = 10) => api.get('/notifications', { params: { limit, unread: true } }),
  // Mark a single notification as read
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  // Mark all notifications for the authenticated user as read
  markAllRead: () => api.put('/notifications/read-all'),
  // Get notifications for the current user (paginated)
  getForUser: (limit = 20) => api.get('/notifications', { params: { limit } }),
  // Admin listing
  getForAdmin: (limit = 50, type = null) => api.get('/notifications/admin', { params: { limit, type } })
};

// ------- ADMIN API (incluye ingresos y reportes) -------
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
  },

  // Obtener ingresos por periodo (day|week|month)
  getRevenue: (period = 'day') => api.get('/admin/revenue', { params: { period } }),
  // Obtener ingresos por rango start/end (YYYY-MM-DD)
  getRevenueRange: (start, end) => api.get('/admin/revenue', { params: { start, end } }),

  // Nuevo: resumen pagos por conductor (rango o fecha)
  // llamable desde frontend admin pages (necesita token con rol admin)
  getDriverPaymentsSummary: (params) => api.get('/admin/drivers/payments/summary', { params }),
  getDriverBalancesRange: (start, end, driverId = null) => {
    const params = { start, end };
    if (driverId) params.driverId = driverId;
    return api.get('/admin/drivers/payments/summary', { params });
  }
};
// ----------------------------------------------------------

export const paymentAPI = {
  executePayment: (paymentData) => api.post('/payment/pay', paymentData),
  getHistory: (date) => api.get('/payment', { params: { date } }),
  getHistoryRange: (startIso, endIso) => api.get('/payment', { params: { start: startIso, end: endIso } })
};

export default api;