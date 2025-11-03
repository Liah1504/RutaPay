import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'passenger'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.password) {
      setError('Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    setError('');

    const result = await register(formData);
    
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
    // Contenedor que centra todo en la página
    <Container component="main" maxWidth="xs" sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      py: 4, // Padding vertical para que no se corte en pantallas pequeñas
    }}>
      {/* La tarjeta (Paper) tomará los bordes redondeados del theme.js */}
      <Paper elevation={6} sx={{
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
      }}>
        {/* Usamos tu logo. Debe estar en /public/logo.png */}
        <img src="/logo.png" alt="RutaPay Logo" style={{ height: '50px', marginBottom: '16px' }} />
        
        <Typography component="h1" variant="h5" gutterBottom>
          Crear Cuenta
        </Typography>
        
        {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
        
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Nombre Completo"
            name="name"
            value={formData.name}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Correo Electrónico"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Contraseña"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            fullWidth
            label="Teléfono"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
          />
          {/* Este es el formulario público, solo permite Pasajero o Conductor */}
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Quiero registrarme como</InputLabel>
            <Select
              name="role"
              value={formData.role}
              label="Quiero registrarme como"
              onChange={handleChange}
            >
              <MenuItem value="passenger">Pasajero</MenuItem>
              <MenuItem value="driver">Conductor</MenuItem>
            </Select>
          </FormControl>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary" // Usará el color primario de tu tema
            sx={{ mt: 3, mb: 2, py: 1.5 }} // Botón más grande
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Registrarse'}
          </Button>
          <Button fullWidth variant="text" onClick={() => navigate('/login')}>
            ¿Ya tienes cuenta? Inicia Sesión
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default Register;