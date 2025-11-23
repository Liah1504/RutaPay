import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Snackbar
} from '@mui/material';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'info' });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    setError('');
    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      setError('Por favor completa nombre, correo y contraseña.');
      return false;
    }
    // validación simple de email
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(formData.email)) {
      setError('Ingresa un correo válido.');
      return false;
    }
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!validate()) return;

    setLoading(true);
    try {
      await authAPI.register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim()
      });

      setSuccess('Cuenta creada correctamente. Redirigiendo al login...');
      setSnack({ open: true, msg: 'Cuenta creada correctamente', severity: 'success' });
      setTimeout(() => navigate('/login'), 1400);
    } catch (err) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message || null;
      setError(serverMsg || 'Error registrando usuario. Inténtalo de nuevo.');
      setSnack({ open: true, msg: serverMsg || 'Error registrando usuario', severity: 'error' });
      // eslint-disable-next-line no-console
      console.error('Register error', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Contenedor con el mismo fondo/dimensiones que tu Login
    <Container component="main" maxWidth={false} disableGutters sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      // Ajusta esta ruta si tu imagen se llama distinto o está en otra carpeta
      backgroundImage: 'url(/city_background.png)',
      // las propiedades coinciden con las del Login que compartiste
      backgroundSize: 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'repeat',
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      backdropFilter: 'blur(8px)',
      position: 'relative',
      zIndex: 1,
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(230, 235, 240, 0.4)',
        zIndex: -1,
      },
      p: 2
    }}>
      <Paper elevation={6} sx={{
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '480px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 3,
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
      }}>
        <img src="/logo.png" alt="RutaPay Logo" style={{ height: '50px', marginBottom: '16px' }} />

        <Typography component="h1" variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
          Crear Cuenta
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2, width: '100%' }}>{success}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }} noValidate>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Nombre completo"
            name="name"
            value={formData.name}
            onChange={handleChange}
            autoComplete="name"
            autoFocus
          />

          <TextField
            margin="normal"
            required
            fullWidth
            label="Correo electrónico"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
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
            autoComplete="new-password"
            helperText="Al menos 6 caracteres"
          />

          <TextField
            margin="normal"
            fullWidth
            label="Teléfono (opcional)"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            autoComplete="tel"
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            sx={{ mt: 3, mb: 2, py: 1.5, borderRadius: 2 }}
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Registrarse'}
          </Button>

          <Button fullWidth variant="text" onClick={() => navigate('/login')} sx={{ borderRadius: 2 }}>
            ¿Ya tienes cuenta? Inicia sesión
          </Button>
        </Box>
      </Paper>

      <Snackbar open={snack.open} autoHideDuration={4500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Container>
  );
};

export default Register;