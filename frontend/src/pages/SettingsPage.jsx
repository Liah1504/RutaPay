import React, { useEffect, useState, useRef } from 'react';
import {
  Container, Paper, Typography, TextField, Button, Box, Avatar, Grid, Stack
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

/**
 * SettingsPage
 * - Permite cambiar foto y editar email/phone.
 * - Si se sube imagen, se envía multipart/form-data; si no, se envía JSON.
 * - Campos de vehículo se muestran solo para conductores.
 * - Revoca objectURL al desmontar.
 */

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    email: '',
    phone: '',
    vehicle: '',
    plate: '',
    license_number: ''
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        email: user.email || '',
        phone: user.phone || user.telefono || '',
        vehicle: user.vehicle || '',
        plate: user.placa || '',
        license_number: user.license_number || user.license || ''
      });
      setAvatarPreview(user?.avatar || null);
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (avatarPreview && typeof avatarPreview === 'string' && avatarPreview.startsWith('blob:')) {
        try { URL.revokeObjectURL(avatarPreview); } catch (e) { /* ignore */ }
      }
    };
  }, [avatarPreview]);

  const handleChange = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const getHomeForRole = () => {
    const role = (user?.role || 'passenger').toString().toLowerCase();
    if (role === 'driver') return '/driver';
    if (role === 'admin') return '/admin';
    return '/passenger';
  };

  const onSelectFile = (file) => {
    if (!file) return;
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const handleFileInput = (e) => {
    const f = e.target.files?.[0];
    if (f) onSelectFile(f);
  };

  const handleClickChangePhoto = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        fd.append('email', form.email);
        fd.append('phone', form.phone);

        if ((user?.role || '').toString().toLowerCase() === 'driver') {
          fd.append('vehicle', form.vehicle);
          fd.append('plate', form.plate);
          fd.append('license_number', form.license_number);
        }

        const res = await userAPI.updateProfileForm(fd);
        if (res?.data) {
          setUser && setUser(res.data);
        }
      } else {
        const payload = { email: form.email, phone: form.phone };
        if ((user?.role || '').toString().toLowerCase() === 'driver') {
          payload.vehicle = form.vehicle;
          payload.plate = form.plate;
          payload.license_number = form.license_number;
        }
        const res = await userAPI.updateProfile(payload);
        if (res?.data) {
          setUser && setUser(res.data);
        }
      }

      const homePath = getHomeForRole();
      navigate(homePath, { state: { successMessage: 'Guardado correctamente' } });
    } catch (err) {
      console.error('Error actualizando perfil:', err);
      const text = err?.response?.data?.error || err?.response?.data?.message || err.message || 'Error';
      setMsg({ type: 'error', text });
    } finally {
      setLoading(false);
      // revoke created objectURL after upload to free memory
      if (avatarPreview && typeof avatarPreview === 'string' && avatarPreview.startsWith('blob:')) {
        try { URL.revokeObjectURL(avatarPreview); } catch (e) { /* ignore */ }
      }
    }
  };

  const handleCancel = () => {
    const homePath = getHomeForRole();
    navigate(homePath);
  };

  const showVehicleFields = (user?.role || '').toString().toLowerCase() === 'driver';

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>Ajustes de perfil</Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar src={avatarPreview || undefined} sx={{ width: 72, height: 72 }}>
            {(user?.name || '').charAt(0)}
          </Avatar>
          <Box>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleClickChangePhoto} disabled={loading}>
                {loading ? 'Procesando...' : 'Cambiar foto'}
              </Button>
              <Button variant="outlined" onClick={() => { setAvatarFile(null); setAvatarPreview(user?.avatar || null); }} disabled={loading}>
                Eliminar
              </Button>
            </Stack>
            <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
              JPG/PNG, máximo recomendado 2MB.
            </Typography>
          </Box>
        </Box>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField label="Correo electrónico" fullWidth value={form.email} onChange={handleChange('email')} />
            </Grid>

            <Grid item xs={12}>
              <TextField label="Teléfono" fullWidth value={form.phone} onChange={handleChange('phone')} />
            </Grid>

            {showVehicleFields && (
              <>
                <Grid item xs={12}>
                  <TextField label="Unidad / Tipo de vehículo" fullWidth value={form.vehicle} onChange={handleChange('vehicle')} />
                </Grid>

                <Grid item xs={12}>
                  <TextField label="Placa" fullWidth value={form.plate} onChange={handleChange('plate')} />
                </Grid>

                <Grid item xs={12}>
                  <TextField label="Número de licencia" fullWidth value={form.license_number} onChange={handleChange('license_number')} />
                </Grid>
              </>
            )}

            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
              <Button variant="outlined" onClick={handleCancel} disabled={loading}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </Grid>

            {msg && (
              <Grid item xs={12}>
                <Typography color={msg.type === 'error' ? 'error' : 'success.main'} sx={{ mt: 1 }}>
                  {msg.text}
                </Typography>
              </Grid>
            )}
          </Grid>
        </form>
      </Paper>
    </Container>
  );
}