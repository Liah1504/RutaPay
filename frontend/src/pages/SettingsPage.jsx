import React, { useEffect, useState, useRef } from 'react';
import { Container, Paper, Typography, TextField, Button, Box, Avatar } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

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

  // local state para la imagen preview (NO se guarda en localStorage)
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
      // preview inicial = avatar público (si existe)
      setAvatarPreview(user?.avatar || null);
    }
  }, [user]);

  useEffect(() => {
    // liberar objectURL si creamos uno
    return () => {
      if (avatarPreview && typeof avatarPreview === 'string' && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleChange = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const goHomeForRole = () => {
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
    // NO guardar blob URL en localStorage
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
      // 1) Si hay avatarFile -> subir con multipart/form-data
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        fd.append('email', form.email);
        fd.append('phone', form.phone);

        // Solo incluir campos de vehículo para drivers (no para admin)
        if ((user?.role || '').toString().toLowerCase() === 'driver') {
          fd.append('vehicle', form.vehicle);
          fd.append('plate', form.plate);
          fd.append('license_number', form.license_number);
        }

        // Esperamos la respuesta del servidor que debe devolver el perfil actualizado
        const res = await userAPI.updateProfileForm(fd);

        // backend debe devolver el usuario actualizado con 'avatar' = URL pública
        if (res?.data) {
          setUser && setUser(res.data);
          // opcional: guardar avatar pública en localStorage si quieres persistencia
          try {
            if (res.data.avatar) localStorage.setItem('rutapay_avatar', res.data.avatar);
          } catch (err) { /* ignore */ }
        }
      } else {
        // 2) Sin avatar -> envío normal JSON
        const payload = {
          email: form.email,
          phone: form.phone
        };
        // Solo incluir campos de vehículo para drivers (no para admin)
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

      // Navegar al inicio y mostrar mensaje
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
    // no usamos localStorage para preview, así que sólo navegar
    const homePath = goHomeForRole();
    navigate(homePath);
  };

  // Mostrar campos de vehículo SOLO para conductores
  const showVehicleFields = (user?.role || '').toString().toLowerCase() === 'driver';

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>Ajustes de perfil</Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar src={avatarPreview || undefined} sx={{ width: 72, height: 72 }}>{(user?.name || '').charAt(0)}</Avatar>
          <Box>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            <Button variant="contained" onClick={handleClickChangePhoto} disabled={loading}>Cambiar foto</Button>
            <Button sx={{ ml: 1 }} variant="outlined" onClick={() => {
              setAvatarFile(null);
              setAvatarPreview(user?.avatar || null);
            }} disabled={loading}>Eliminar</Button>
            <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
              JPG/PNG, máximo recomendado 2MB.
            </Typography>
          </Box>
        </Box>

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

          {showVehicleFields && (
            <>
              <TextField label="Unidad/Tipo de vehículo" fullWidth sx={{ mb: 2 }} value={form.vehicle} onChange={handleChange('vehicle')} />
              <TextField label="Placa" fullWidth sx={{ mb: 2 }} value={form.plate} onChange={handleChange('plate')} />
              <TextField label="Número de licencia" fullWidth sx={{ mb: 2 }} value={form.license_number} onChange={handleChange('license_number')} />
            </>
          )}

          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Guardando...' : 'Guardar cambios'}</Button>
            <Button variant="outlined" onClick={handleCancel} disabled={loading}>Cancelar</Button>
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