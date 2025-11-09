import React, { useState, useEffect } from 'react';
import { Container, Paper, Typography, TextField, Button, Box, Avatar, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { userAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { getAvatarSrc } from '../utils/getAvatarSrc';

const SettingsPage = () => {
  const { user, fetchAndUpdateUser, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [plate, setPlate] = useState('');
  const [license, setLicense] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: 'info' });

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setPhone(user.phone || user.telefono || '');
      setVehicle(user.vehicle || user.vehicle_type || '');
      setPlate(user.plate || user.vehicle_plate || '');
      setLicense(user.license_number || '');
      // usar tmp por usuario (no una key global)
      const tmpKey = `tmpAvatarUrl_${user.id}`;
      const tmpAvatar = localStorage.getItem(tmpKey);
      setAvatarPreview(tmpAvatar || getAvatarSrc(user) || null);
    }
  }, [user]);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setAvatarFile(f);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleCancel = () => {
    if (!user) return navigate('/login');
    if (user.role === 'driver') return navigate('/driver');
    if (user.role === 'admin') return navigate('/admin');
    return navigate('/passenger');
  };

  // Actualiza localmente y guarda tmp por userId
  const persistAvatarPreviewForUser = (userId, url) => {
    const key = `tmpAvatarUrl_${userId}`;
    try {
      if (url) localStorage.setItem(key, url);
      else localStorage.removeItem(key);
    } catch (err) { /* ignore */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: 'info' });

    const prevUser = user;

    try {
      let response;
      if (avatarFile) {
        const form = new FormData();
        form.append('email', email);
        form.append('phone', phone);
        form.append('vehicle_type', vehicle);
        form.append('vehicle_plate', plate);
        form.append('license_number', license);
        form.append('avatar', avatarFile);
        response = await userAPI.updateProfileForm(form);
      } else {
        response = await userAPI.updateProfile({ email, phone, vehicle_type: vehicle, vehicle_plate: plate, license_number: license });
      }

      const data = response?.data;
      // extraer usuario según shape (user o directamente)
      const userObj = data?.user && typeof data.user === 'object' ? data.user : (data && typeof data === 'object' ? data : null);

      if (userObj) {
        // actualizar contexto y localStorage con lo que devuelve el backend (clave: avatar_url)
        setUser(userObj);
        try { localStorage.setItem('rutapay_user', JSON.stringify(userObj)); } catch (err) {}
        if (userObj.avatar_url || userObj.avatar) {
          const avatarUrl = userObj.avatar_url || userObj.avatar;
          setAvatarPreview(avatarUrl);
          persistAvatarPreviewForUser(userObj.id, avatarUrl);
        } else if (avatarPreview) {
          // si no devolvió URL, mantener preview local (base64) solo para este usuario
          persistAvatarPreviewForUser(userObj.id, avatarPreview);
        }
      } else {
        // fallback: intentar fetch seguro
        const updated = await fetchAndUpdateUser();
        if (updated) {
          setAvatarPreview(updated.avatar_url || updated.avatar || avatarPreview);
          persistAvatarPreviewForUser(updated.id, updated.avatar_url || updated.avatar || avatarPreview);
        } else {
          // restaurar prevUser para evitar blanqueo
          setUser(prevUser);
          try { localStorage.setItem('rutapay_user', JSON.stringify(prevUser)); } catch (err) {}
        }
      }

      setMsg({ text: 'Perfil actualizado correctamente', type: 'success' });
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      setUser(prevUser);
      try { localStorage.setItem('rutapay_user', JSON.stringify(prevUser)); } catch (err) {}
      const errorMsg = error.response?.data?.error || error.message || 'Error actualizando perfil';
      setMsg({ text: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>Ajustes de perfil</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Avatar src={avatarPreview || '/images/default-avatar.png'} sx={{ width: 80, height: 80 }} />
          </Box>
          <Box component="form" onSubmit={handleSubmit}>
            <TextField label="Correo electrónico" variant="outlined" fullWidth value={email} onChange={e => setEmail(e.target.value)} sx={{ mb: 2 }} />
            <TextField label="Teléfono" variant="outlined" fullWidth value={phone} onChange={e => setPhone(e.target.value)} sx={{ mb: 2 }} />
            <TextField label="Unidad/Tipo de vehículo" variant="outlined" fullWidth value={vehicle} onChange={e => setVehicle(e.target.value)} sx={{ mb: 2 }} />
            <TextField label="Placa" variant="outlined" fullWidth value={plate} onChange={e => setPlate(e.target.value)} sx={{ mb: 2 }} />
            <TextField label="Número de licencia" variant="outlined" fullWidth value={license} onChange={e => setLicense(e.target.value)} sx={{ mb: 2 }} />
            <Button variant="contained" component="label" color="info" size="small" sx={{ mb: 2 }}>
              Cambiar foto
              <input hidden type="file" accept="image/*" onChange={handleFile} />
            </Button>
            <Box sx={{ mt: 2, display: 'flex', gap:2 }}>
              <Button variant="contained" color="primary" type="submit" disabled={loading}>
                {loading ? <CircularProgress size={24}/> : 'Guardar cambios'}
              </Button>
              <Button variant="outlined" color="inherit" onClick={handleCancel}>Cancelar</Button>
            </Box>
            {msg.text && <Alert severity={msg.type} sx={{ mt: 2 }}>{msg.text}</Alert>}
          </Box>
        </Paper>
      </Container>
    </>
  );
};

export default SettingsPage;