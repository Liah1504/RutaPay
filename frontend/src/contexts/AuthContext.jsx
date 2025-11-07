import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { userAPI } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_BASE = 'http://localhost:5002/api';

  const logout = useCallback(() => {
    localStorage.removeItem('rutapay_token');
    localStorage.removeItem('rutapay_user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    window.location.href = '/login';
  }, []);

  const fetchAndUpdateUser = useCallback(async () => {
    try {
      const response = await userAPI.getProfile();
      const updatedUser = response.data;
      setUser(updatedUser);
      localStorage.setItem('rutapay_user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error) {
      console.error("Falló la actualización del usuario, cerrando sesión.", error);
      logout();
    }
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem('rutapay_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchAndUpdateUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchAndUpdateUser]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
      const { token } = response.data;
      localStorage.setItem('rutapay_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      await fetchAndUpdateUser();
      return { success: true };
    } catch (error) {
      console.error('❌ Error en login:', error);
      return { success: false, error: error.response?.data?.error || 'Error de conexión' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/register`, userData);
      const { token } = response.data;
      localStorage.setItem('rutapay_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      await fetchAndUpdateUser();
      return { success: true };
    } catch (error) {
      console.error('❌ Error en registro:', error);
      return { success: false, error: error.response?.data?.error || 'Error de conexión' };
    }
  };

  const contextValue = {
    user,
    login,
    logout,
    register, 
    loading,
    fetchAndUpdateUser
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;

