import axios from 'axios';

/**
 * Central API client for RutaPay frontend
 * - Detects VITE_API_URL if available, otherwise falls back to http://localhost:5002
 * - Exposes helpers to set/clear auth token
 * - Provides typed API groups: userAPI, authAPI, tripAPI, rechargeAPI, routeAPI, driverAPI, notificationsAPI, adminAPI, paymentAPI
 * - updateProfile duplicates common field names (vehicle/vehicle_type/unit, plate/placa/vehicle_plate, license_number/license)
 *   to improve compatibility with backends that expect different param names.
 */

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : 'http://localhost:5002/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
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
  // ignore storage errors
}

// Response interceptor: if 401, optionally clear token and propagate
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error?.config;
    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        localStorage.removeItem('rutapay_token');
        delete api.defaults.headers.common['Authorization'];
      } catch (e) { /* ignore */ }
    }
    return Promise.reject(error);
  }
);

// Helper - normalize response payloads to support res.data or res.data.data shapes
const normalizeResponse = (res) => res?.data?.data ?? res?.data ?? res;

/**
 * Utility to clean an object by removing undefined values
 */
const cleanObject = (obj = {}) => {
  const out = {};
  Object.keys(obj).forEach(k => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
};

/**
 * Build a payload duplicating common keys to increase compatibility with
 * backends that might expect different param names.
 */
const buildCompatProfilePayload = (payload = {}) => {
  const body = {
    ...payload,
    // vehicle aliases
    vehicle: payload.vehicle ?? payload.vehicle_type ?? payload.unit,
    vehicle_type: payload.vehicle ?? payload.vehicle_type ?? payload.unit,
    unit: payload.vehicle ?? payload.vehicle_type ?? payload.unit,

    // plate aliases
    plate: payload.plate ?? payload.vehicle_plate ?? payload.placa,
    vehicle_plate: payload.plate ?? payload.vehicle_plate ?? payload.placa,
    placa: payload.plate ?? payload.vehicle_plate ?? payload.placa,

    // license aliases
    license_number: payload.license_number ?? payload.license,
    license: payload.license_number ?? payload.license
  };

  return cleanObject(body);
};

// --- API wrappers ---
// NOTE: these functions mostly return axios responses. Callers in the app usually access res.data or res.data.data.
// Keep that in mind when integrating.

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  getProfileNoCache: () => api.get('/users/profile', { params: { _t: Date.now() } }),

  // Update profile via JSON; duplicates keys for compatibility
  updateProfile: (userData = {}) => {
    const body = buildCompatProfilePayload(userData);
    return api.put('/users/profile', body);
  },

  // Update profile with multipart/form-data (avatar + fields)
  // Accepts either a FormData instance or an object; if object -> converted to FormData
  updateProfileForm: (formOrData) => {
    let fd;
    if (formOrData instanceof FormData) {
      fd = formOrData;
      // ensure compatibility aliases exist in FormData
      const maybeVehicle = fd.get('vehicle') || fd.get('vehicle_type') || fd.get('unit');
      if (maybeVehicle && !fd.get('vehicle_type')) fd.append('vehicle_type', maybeVehicle);
      if (maybeVehicle && !fd.get('unit')) fd.append('unit', maybeVehicle);

      const maybePlate = fd.get('plate') || fd.get('vehicle_plate') || fd.get('placa');
      if (maybePlate && !fd.get('vehicle_plate')) fd.append('vehicle_plate', maybePlate);
      if (maybePlate && !fd.get('placa')) fd.append('placa', maybePlate);

      const maybeLicense = fd.get('license_number') || fd.get('license');
      if (maybeLicense && !fd.get('license')) fd.append('license', maybeLicense);
      if (maybeLicense && !fd.get('license_number')) fd.append('license_number', maybeLicense);
    } else {
      // plain object -> convert and add aliases
      const body = buildCompatProfilePayload(formOrData || {});
      fd = new FormData();
      Object.keys(body).forEach(k => {
        fd.append(k, body[k]);
      });
    }

    return api.put('/users/profile', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
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

// ---------- DRIVER API (seguro y con fallback compat) ----------
export const driverAPI = {
  // Try the driver-scoped profile endpoint
  getProfile: () => api.get('/drivers/profile'),

  // Driver payments (driver-scoped)
  getPayments: () => api.get('/drivers/payments'),

  // Prefer driver endpoint for summary; fallback to admin scope on 404
  getPaymentsSummary: (params) => api.get('/drivers/payments/summary', { params }),

  // Generic driver dashboard attempt with fallback to admin summary if 404
  getDriverDashboard: async (params = {}) => {
    try {
      return await api.get('/drivers/dashboard', { params });
    } catch (err) {
      if (err?.response?.status === 404) {
        return api.get('/admin/drivers/payments/summary', { params });
      }
      throw err;
    }
  },

  // update driver profile (driver-specific endpoint if backend exposes it)
  updateProfile: (data) => {
    // If backend expects /drivers/profile: use it
    // We also build compatibility payload for driver fields
    const body = buildCompatProfilePayload(data);
    return api.put('/drivers/profile', body);
  },

  // If your backend exposes drivers/me or drivers/:id endpoints, use these:
  updateDriverMe: (data) => {
    const body = buildCompatProfilePayload(data);
    return api.put('/drivers/me', body);
  },

  updateDriverById: (id, data) => {
    const body = buildCompatProfilePayload(data);
    return api.put(`/drivers/${id}`, body);
  },

  getNotifications: (limit = 5, unread = false) => api.get('/notifications', { params: { limit, unread } })
};
// ---------------------------------------------------------------

export const notificationsAPI = {
  getLatestForDriver: (limit = 10) => api.get('/notifications', { params: { limit, unread: true } }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  getForUser: (limit = 20) => api.get('/notifications', { params: { limit } }),
  getForAdmin: (limit = 50, type = null) => api.get('/notifications/admin', { params: { limit, type } })
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getAllUsers: () => api.get('/admin/users'),
  // NEW: try to fetch drivers directly if backend exposes it
  getDrivers: () => api.get('/admin/drivers'),
  updateUser: (id, userData) => api.put(`/admin/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  createDriver: (driverData) => api.post('/admin/drivers', driverData),

  // createUser with fallbacks (tries admin creation, then generic users, then auth/register)
  createUser: async (userData) => {
    const payloadWithRole = { ...userData, role: userData.role || 'admin' };
    try { return await api.post('/admin/users', payloadWithRole); } catch (err) { if (!err.response || err.response.status !== 404) throw err; }
    try { return await api.post('/users', payloadWithRole); } catch (err) { if (!err.response || err.response.status !== 404) throw err; }
    return await api.post('/auth/register', payloadWithRole);
  },

  getRevenue: (period = 'day') => api.get('/admin/revenue', { params: { period } }),
  getRevenueRange: (start, end) => api.get('/admin/revenue', { params: { start, end } }),
  getDriverPaymentsSummary: (params) => api.get('/admin/drivers/payments/summary', { params }),
  getDriverBalancesRange: (start, end, driverId = null) => {
    const params = { start, end };
    if (driverId) params.driverId = driverId;
    return api.get('/admin/drivers/payments/summary', { params });
  }
};

export const paymentAPI = {
  executePayment: (paymentData) => api.post('/payment/pay', paymentData),
  getHistory: (date) => api.get('/payment', { params: { date } }),
  getHistoryRange: (startIso, endIso) => api.get('/payment', { params: { start: startIso, end: endIso } })
};

export default api;