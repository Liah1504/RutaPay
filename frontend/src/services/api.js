import axios from 'axios';

const API_BASE = 'http://localhost:5002/api';

export const userAPI = {
  getProfile: () => axios.get(`${API_BASE}/users/profile`),
};

export const authAPI = {
  register: (userData) => axios.post(`${API_BASE}/auth/register`, userData), // will create passengers only
  login: (email, password) => axios.post(`${API_BASE}/auth/login`, { email, password }),
};

export const tripAPI = {
  getPassengerTrips: () => axios.get(`${API_BASE}/trips/passenger`),
  getDriverTrips: () => axios.get(`${API_BASE}/trips/driver`),
  updateStatus: (data) => axios.put(`${API_BASE}/trips/status`, data),
};

export const rechargeAPI = {
  create: (rechargeData) => axios.post(`${API_BASE}/recharges`, rechargeData),
  getPending: () => axios.get(`${API_BASE}/recharges/pending`),
  confirm: (id) => axios.put(`${API_BASE}/recharges/${id}/confirm`),
};

export const routeAPI = {
  getAll: () => axios.get(`${API_BASE}/routes`),
  create: (routeData) => axios.post(`${API_BASE}/routes`, routeData),
  update: (id, routeData) => axios.put(`${API_BASE}/routes/${id}`, routeData),
};

export const driverAPI = {
  getProfile: () => axios.get(`${API_BASE}/drivers/profile`),
  getPayments: () => axios.get(`${API_BASE}/drivers/payments`),
  getPaymentsSummary: (date) => axios.get(`${API_BASE}/drivers/payments/summary`, { params: { date } }),
};

export const adminAPI = {
  getStats: () => axios.get(`${API_BASE}/admin/stats`),
  getAllUsers: () => axios.get(`${API_BASE}/admin/users`),
  updateUser: (id, userData) => axios.put(`${API_BASE}/admin/users/${id}`, userData),
  deleteUser: (id) => axios.delete(`${API_BASE}/admin/users/${id}`),
  // Crear conductor (solo admin)
  createDriver: (driverData) => axios.post(`${API_BASE}/admin/drivers`, driverData),
};

export const paymentAPI = {
  executePayment: (paymentData) => axios.post(`${API_BASE}/payment/pay`, paymentData),
};