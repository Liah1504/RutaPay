// frontend/src/services/api.js

import axios from 'axios';

// Asegúrate de que esta URL base apunte a tu backend (lo definimos en 5002)
const API_BASE = 'http://localhost:5002/api'; 

// =============================================
// API DE USUARIOS Y AUTENTICACIÓN
// =============================================

export const userAPI = {
    getProfile: () => axios.get(`${API_BASE}/users/profile`),
};

export const authAPI = {
    register: (userData) => axios.post(`${API_BASE}/auth/register`, userData),
    login: (email, password) => axios.post(`${API_BASE}/auth/login`, { email, password }),
};


// =============================================
// API DE FUNCIONALIDADES CENTRALES
// =============================================

export const tripAPI = {
    // create: (tripData) => axios.post(`${API_BASE}/trips`, tripData), // Ya no usamos esta
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
    updateStatus: (data) => axios.put(`${API_BASE}/drivers/status`, data),
};


// =============================================
// API DE ADMINISTRACIÓN
// =============================================

export const adminAPI = { 
    getStats: () => axios.get(`${API_BASE}/admin/stats`),
    getAllUsers: () => axios.get(`${API_BASE}/admin/users`),
    updateUser: (id, userData) => axios.put(`${API_BASE}/admin/users/${id}`, userData),
    deleteUser: (id) => axios.delete(`${API_BASE}/admin/users/${id}`),
};

// =============================================
// ¡API DE PAGO (AQUÍ ESTÁ LA CORRECCIÓN)!
// =============================================
export const paymentAPI = {
    // Asegúrate de que aquí diga /pay (sin la "l" al final)
    executePayment: (paymentData) => axios.post(`${API_BASE}/payment/pay`, paymentData)
};
