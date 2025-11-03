import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(email, password);
    
    if (result.success) {
      // Redirección por rol
      const user = JSON.parse(localStorage.getItem('rutapay_user'));
      switch (user.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'driver':
          navigate('/driver');
          break;
        case 'passenger':
          navigate('/passenger');
          break;
        default:
          navigate('/');
      }
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    // Contenedor que centra todo Y APLICA LA IMAGEN DE FONDO
    <Container component="main" maxWidth={false} disableGutters sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh', // Ocupa toda la altura de la pantalla
      // --- CAMBIOS PARA LA IMAGEN DE FONDO ---
      backgroundImage: 'url(/city_background.png)',
      backgroundSize: 'contain', // <-- CAMBIO CLAVE: 'contain' para que no se estire
      backgroundPosition: 'center',
      backgroundRepeat: 'repeat', // <-- CAMBIO CLAVE: 'repeat' para duplicar si es necesario
      // --- CAPA SEMI-TRANSPARENTE SOBRE LA IMAGEN ---
      backgroundColor: 'rgba(255, 255, 255, 0.6)', // Un poco más de blanco para que el blur se note más
      backdropFilter: 'blur(8px)', // <-- AUMENTA EL EFECTO DE BLUR
      position: 'relative', // Necesario para el backdrop-filter
      zIndex: 1, // Asegura que el backdrop-filter funcione correctamente
      '&::before': { // Una capa extra de color para el fondo
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(230, 235, 240, 0.4)', // Color base más claro para el fondo
        zIndex: -1, // Detrás de todo lo demás
      },
    }}>
      {/* La tarjeta (Paper) con un fondo blanco semi-transparente */}
      <Paper elevation={6} sx={{
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '400px', // Límite de ancho para el formulario
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // Sigue siendo el fondo del formulario
        borderRadius: 3, // Bordes más redondeados
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)', // Sombra más suave
      }}>
        {/* Usamos tu logo. Debe estar en /public/logo.png */}
        <img src="/logo.png" alt="RutaPay Logo" style={{ height: '50px', marginBottom: '16px' }} />
        
        <Typography component="h1" variant="h5" gutterBottom sx={{color: 'primary.main', fontWeight: 600}}>
          Iniciar Sesión
        </Typography>
        
        {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
        
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Correo Electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary" 
            sx={{ mt: 3, mb: 2, py: 1.5, borderRadius: 2 }} // Bordes más redondeados para el botón
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </Button>
          <Button fullWidth variant="text" onClick={() => navigate('/register')} sx={{borderRadius: 2}}>
            ¿No tienes cuenta? Regístrate
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login;