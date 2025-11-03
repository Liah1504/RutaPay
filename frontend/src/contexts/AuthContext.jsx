import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { userAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_BASE = 'http://localhost:5002/api';

  // FIX 1: Se envuelve la función logout en useCallback para hacerla estable
  const logout = useCallback(() => {
    localStorage.removeItem('rutapay_token');
    localStorage.removeItem('rutapay_user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    
    // --- ESTA ES LA LÍNEA MÁGICA ---
    // Forzamos una recarga completa de la aplicación al ir a /login
    // Esto detiene cualquier "polling" (como el de /trips/driver) que se esté ejecutando.
    window.location.href = '/login'; 
  }, []);

  // Esta función obtiene el perfil más reciente del usuario desde el backend
  const fetchAndUpdateUser = useCallback(async () => {
    try {
      const response = await userAPI.getProfile();
      const updatedUser = response.data;
      setUser(updatedUser);
      // Actualizamos también la copia local para mantener la consistencia
      localStorage.setItem('rutapay_user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error) {
      console.error("Falló la actualización del usuario, cerrando sesión.", error);
      logout(); // Si no podemos obtener el perfil, cerramos sesión por seguridad
    }
  }, [logout]); // FIX 2: Se añade 'logout' como dependencia, ya que se usa adentro

  useEffect(() => {
    const token = localStorage.getItem('rutapay_token');
    if (token) {
      // Configuramos el token para todas las futuras peticiones
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Buscamos la información más reciente del usuario al cargar la app
      fetchAndUpdateUser().finally(() => setLoading(false));
    } else {
      setLoading(false); // Si no hay token, terminamos de cargar
    }
  }, [fetchAndUpdateUser]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
      const { token } = response.data;
      
      localStorage.setItem('rutapay_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Después de un login exitoso, obtenemos el perfil completo (incluyendo el saldo)
      await fetchAndUpdateUser(); 
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error en login:', error);
      return { success: false, error: error.response?.data?.error || 'Error de conexión' };
    }
  };
  
  // La función de registro que corregimos antes
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

  const value = {
    user,
    login,
    logout,
    register, 
    loading,
    fetchAndUpdateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

