import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { userAPI } from '../services/api';

// AuthContext centralizado: aplica token, refresca perfil y expone login/logout
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Usa import.meta.env.VITE_API_URL en Vite; si no existe, usa localhost por defecto
  const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_URL)
    ? `${import.meta.env.VITE_API_URL}/api`
    : 'http://localhost:5002/api';

  // centralizar aplicar/remover token en axios + localStorage
  const applyToken = useCallback((token) => {
    if (token) {
      localStorage.setItem('rutapay_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('rutapay_token');
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  const logout = useCallback(() => {
    applyToken(null);
    localStorage.removeItem('rutapay_user');
    setUser(null);
    window.location.href = '/login';
  }, [applyToken]);

  // Reemplazamos la implementación para forzar no-cache si existe getProfileNoCache,
  // y para proteger contra respuestas vacías (no hacer setUser con objeto vacío).
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

      // Protegemos contra respuestas vacías o inesperadas:
      if (!updatedUser || (typeof updatedUser === 'object' && Object.keys(updatedUser).length === 0)) {
        console.warn('fetchAndUpdateUser: perfil obtenido vacío/no válido, no se actualizará el contexto.');
        return null;
      }

      setUser(updatedUser);
      try { localStorage.setItem('rutapay_user', JSON.stringify(updatedUser)); } catch (err) {}
      return updatedUser;
    } catch (error) {
      console.error('Falló la actualización del usuario:', error);
      // Solo cerrar sesión si la respuesta es 401 (token inválido/expirado)
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
      const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
      const { token } = response.data;
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
      const response = await axios.post(`${API_BASE}/auth/register`, userData);
      const { token } = response.data;
      if (!token) throw new Error('No se recibió token del servidor');
      applyToken(token);
      await fetchAndUpdateUser();
      return { success: true };
    } catch (error) {
      console.error('❌ Error en registro:', error);
      return { success: false, error: error.response?.data?.error || error.message || 'Error de conexión' };
    }
  };

  const contextValue = {
    user,
    setUser,                 // ahora expongo setUser para actualizar localmente sin forzar fetch
    login,
    logout,
    register,
    loading,
    fetchAndUpdateUser,
    applyToken
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// Hook estable para consumir el contexto
export const useAuth = () => useContext(AuthContext);

export default AuthContext;
