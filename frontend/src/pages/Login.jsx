import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Estado para "Olvidaste tu contraseña"
  const [forgotDialogOpen, setForgotDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'info' });

  const handleOpenForgot = () => { setForgotDialogOpen(true); setForgotEmail(''); };
  const handleCloseForgot = () => setForgotDialogOpen(false);
  const handleOpenReset = (email = '') => { setResetDialogOpen(true); setResetEmail(email); };
  const handleCloseReset = () => setResetDialogOpen(false);

  const doForgot = async () => {
    if (!forgotEmail) {
      setSnack({ open: true, msg: 'Introduce tu correo', severity: 'warning' });
      return;
    }
    try {
      await authAPI.forgotPassword(forgotEmail);
      setSnack({ open: true, msg: 'Si existe la cuenta, se envió un código al correo.', severity: 'success' });
      setForgotDialogOpen(false);
      // abrir modal de reset (opcional) pre-llenando email
      setTimeout(() => handleOpenReset(forgotEmail), 400);
    } catch (err) {
      console.error('forgot error', err);
      setSnack({ open: true, msg: err?.response?.data?.error || 'Error enviando código', severity: 'error' });
    }
  };

  const doReset = async () => {
    if (!resetEmail || !resetCode || !resetPasswordValue) {
      setSnack({ open: true, msg: 'Completa todos los campos', severity: 'warning' });
      return;
    }
    try {
      await authAPI.resetPassword({ email: resetEmail, code: resetCode, password: resetPasswordValue });
      setSnack({ open: true, msg: 'Contraseña actualizada. Inicia sesión.', severity: 'success' });
      setResetDialogOpen(false);
      // opcional: vaciar campos
      setResetCode(''); setResetPasswordValue('');
    } catch (err) {
      console.error('reset error', err);
      setSnack({ open: true, msg: err?.response?.data?.error || 'Error reestableciendo contraseña', severity: 'error' });
    }
  };

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
      minHeight: '100vh',
      backgroundImage: 'url(/city_background.png)',
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
    }}>
      <Paper elevation={6} sx={{
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 3,
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
      }}>
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
            sx={{ mt: 3, mb: 2, py: 1.5, borderRadius: 2 }}
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </Button>

          <Button fullWidth variant="text" onClick={() => navigate('/register')} sx={{borderRadius: 2}}>
            ¿No tienes cuenta? Regístrate
          </Button>

          <Button fullWidth variant="text" onClick={handleOpenForgot} sx={{ mt: 1, borderRadius: 2 }}>
            ¿Olvidaste tu contraseña?
          </Button>
        </Box>
      </Paper>

      {/* Dialog: solicitar código */}
      <Dialog open={forgotDialogOpen} onClose={handleCloseForgot}>
        <DialogTitle>Recuperar contraseña</DialogTitle>
        <DialogContent>
          <TextField label="Correo" type="email" fullWidth value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Te enviaremos un código al correo para reestablecer tu contraseña.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForgot}>Cancelar</Button>
          <Button variant="contained" onClick={doForgot}>Enviar código</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: reestablecer con código */}
      <Dialog open={resetDialogOpen} onClose={handleCloseReset}>
        <DialogTitle>Reestablecer contraseña</DialogTitle>
        <DialogContent>
          <TextField label="Correo" type="email" fullWidth value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} sx={{ mb: 1 }} />
          <TextField label="Código" fullWidth value={resetCode} onChange={(e) => setResetCode(e.target.value)} sx={{ mb: 1 }} />
          <TextField label="Nueva contraseña" type="password" fullWidth value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReset}>Cancelar</Button>
          <Button variant="contained" onClick={doReset}>Reestablecer</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={4500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Container>
  );
};

export default Login;