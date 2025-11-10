import React, { useEffect, useState } from 'react';
import { Container, Paper, Typography, TextField, Button, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { user, setUser } = useAuth(); // asumo que tu AuthContext provee user y setUser
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    phone: '',
    vehicle: '',
    plate: '',
    license_number: ''
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        email: user.email || '',
        phone: user.phone || user.telefono || '',
        vehicle: user.vehicle || '',
        plate: user.plate || user.placa || '',
        license_number: user.license_number || user.license || ''
      });
    }
  }, [user]);

  const handleChange = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const goHomeForRole = () => {
    const role = user?.role || 'passenger';
    const path = role === 'driver' ? '/driver' : role === 'admin' ? '/admin' : '/passenger';
    return path;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    // Preparamos payload: si el usuario es pasajero, removemos campos de vehículo
    const payload = {
      email: form.email,
      phone: form.phone
    };

    if (user?.role && user.role !== 'passenger') {
      // admin o driver -> enviar también los campos de vehículo
      payload.vehicle = form.vehicle;
      payload.plate = form.plate;
      payload.license_number = form.license_number;
    }

    try {
      const res = await userAPI.updateProfile(payload);
      // Actualizar user en contexto si procede
      if (res?.data) {
        try { setUser && setUser(res.data); } catch {}
      }
      // Navegar al inicio según rol y enviar state con mensaje de éxito
      const homePath = goHomeForRole();
      navigate(homePath, { state: { successMessage: 'Guardado correctamente' } });
    } catch (err) {
      console.error('Error actualizando perfil:', err);
      const text = err?.response?.data?.error || err?.response?.data?.message || err.message || 'Error';
      setMsg({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // navegar al inicio según rol sin mensaje
    const homePath = goHomeForRole();
    navigate(homePath);
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>Ajustes de perfil</Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Correo electrónico"
            fullWidth
            sx={{ mb: 2 }}
            value={form.email}
            onChange={handleChange('email')}
          />

          <TextField
            label="Teléfono"
            fullWidth
            sx={{ mb: 2 }}
            value={form.phone}
            onChange={handleChange('phone')}
          />

          {/* Mostrar campos de vehículo SOLO si el rol no es 'passenger' */}
          {user?.role && user.role !== 'passenger' && (
            <>
              <TextField
                label="Unidad/Tipo de vehículo"
                fullWidth
                sx={{ mb: 2 }}
                value={form.vehicle}
                onChange={handleChange('vehicle')}
              />

              <TextField
                label="Placa"
                fullWidth
                sx={{ mb: 2 }}
                value={form.plate}
                onChange={handleChange('plate')}
              />

              <TextField
                label="Número de licencia"
                fullWidth
                sx={{ mb: 2 }}
                value={form.license_number}
                onChange={handleChange('license_number')}
              />
            </>
          )}

          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
            <Button variant="outlined" onClick={handleCancel}>
              Cancelar
            </Button>
          </Box>

          {msg && (
            <Typography color={msg.type === 'error' ? 'error' : 'success.main'} sx={{ mt: 2 }}>
              {msg.text}
            </Typography>
          )}
        </form>
      </Paper>
    </Container>
  );
}