import React from 'react';
import { AppBar, Toolbar, Button, Box, Chip } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    // window.location.href = '/login'; // El logout en AuthContext ya maneja esto
  };

  return (
    // Esta AppBar ahora tomará los estilos de theme.js (fondo blanco)
    <AppBar position="static">
      <Toolbar>
        {/* --- ESTE ES EL CAMBIO --- */}
        {/* Usamos tu logo. Debe estar en /public/logo.png */}
        <Box sx={{ flexGrow: 1 }}>
          <img src="/logo.png" alt="RutaPay Logo" style={{ height: '40px', verticalAlign: 'middle' }} />
        </Box>
        {/* --- FIN DEL CAMBIO --- */}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {user ? (
            <>
              <Chip
                label={`👤 ${user.name}`}
                variant="outlined"
                sx={{ 
                  color: 'text.secondary', 
                  borderColor: 'grey.300',
                  fontWeight: 500 
                }}
              />
              <Chip
                label={`${user.role === 'driver' ? '🚗' : user.role === 'admin' ? '👨‍💼' : '👥'} ${user.role}`}
                sx={{ 
                  color: 'primary.contrastText', 
                  bgcolor: 'primary.light',
                  fontWeight: 600
                }}
              />
              <Button
                color="primary"
                onClick={handleLogout}
                variant="outlined"
              >
                Cerrar Sesión
              </Button>
            </>
          ) : (
            <>
              <Button color="primary" href="/login">
                Iniciar Sesión
              </Button>
              <Button 
                color="primary" 
                href="/register" 
                variant="outlined"
              >
                Registrarse
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;