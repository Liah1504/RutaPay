// src/contexts/AuthContext.jsx
// AuthContext que aplica el token sobre la instancia `api` exportada en src/services/api.js
// MODIFICADO POR MÍ: usa `api` (misma instancia que adminAPI) para asegurar que Authorization viaje en todas las llamadas.

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios'; // fallback global
import api, { userAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback((token) => {
    if (token) {
      try { localStorage.setItem('rutapay_token', token); } catch (e) {}
      // Aplicar sobre la instancia central `api`
      if (api && api.defaults && api.defaults.headers) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      // También aplicar sobre axios global por compatibilidad
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      try { localStorage.removeItem('rutapay_token'); } catch (e) {}
      if (api && api.defaults && api.defaults.headers) {
        delete api.defaults.headers.common['Authorization'];
      }
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  const logout = useCallback(() => {
    applyToken(null);
    try { localStorage.removeItem('rutapay_user'); } catch (e) {}
    setUser(null);
    window.location.href = '/login';
  }, [applyToken]);

  const fetchAndUpdateUser = useCallback(async () => {
    try {
      let response;
      if (typeof userAPI.getProfileNoCache === 'function') {
        response = await userAPI.getProfileNoCache();
      } else {
        response = await userAPI.getProfile();
      }

      console.log('DEBUG fetchAndUpdateUser: response.data =', response?.data);
      const updatedUser = response?.data;

      if (!updatedUser || (typeof updatedUser === 'object' && Object.keys(updatedUser).length === 0)) {
        console.warn('fetchAndUpdateUser: perfil vacío, no se actualizará contexto.');
        return null;
      }

      setUser(updatedUser);
      try { localStorage.setItem('rutapay_user', JSON.stringify(updatedUser)); } catch (err) {}
      return updatedUser;
    } catch (error) {
      console.error('Falló la actualización del usuario:', error);
      if (error.response?.status === 401) {
        console.error('Token inválido o expirado. Cerrando sesión.');
        logout();
      }
      return null;
    }
  }, [logout]);

  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem('rutapay_token');
        if (token) {
          applyToken(token);
          await fetchAndUpdateUser();
        }
      } catch (err) {
        console.error('Error iniciando auth:', err);
        applyToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchAndUpdateUser, applyToken]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password }); // usa la instancia `api`
      const token = response?.data?.token || response?.data?.accessToken;
      if (!token) throw new Error('No se recibió token del servidor');
      applyToken(token);
      await fetchAndUpdateUser();
      return { success: true };
    } catch (error) {
      console.error('❌ Error en login:', error);
      return { success: false, error: error.response?.data?.error || error.message || 'Error de conexión' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const token = response?.data?.token || response?.data?.accessToken;
      if (!token) throw new Error('No se recibió token del servidor');
      applyToken(token);
      await fetchAndUpdateUser();
      return { success: true };
    } catch (error) {
      console.error('❌ Error en registro:', error);
      return { success: false, error: error.response?.data?.error || error.message || 'Error de conexión' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, register, loading, fetchAndUpdateUser, applyToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;