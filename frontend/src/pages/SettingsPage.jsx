// frontend/src/pages/SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { Container, Paper, Typography, TextField, Button, Box, Avatar, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { userAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const SettingsPage = () => {
  const { user, fetchAndUpdateUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: 'info' });

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setPhone(user.phone || '');
      const tmpAvatar = localStorage.getItem('tmpAvatarUrl');
      setAvatarPreview(tmpAvatar || user.avatar || null);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: 'info' });

    try {
      let response;
      if (avatarFile) {
        const form = new FormData();
        form.append('email', email);
        form.append('phone', phone);
        form.append('avatar', avatarFile);
        response = await userAPI.updateProfileForm(form);
      } else {
        response = await userAPI.updateProfile({ email, phone });
      }

      const data = response.data || {};

      // Si backend devolvió avatarUrl absoluto, refrescamos el perfil desde backend
      if (data.avatarUrl) {
        // limpiar tmp y forzar fetch del perfil actualizado
        localStorage.removeItem('tmpAvatarUrl');
        try { await fetchAndUpdateUser(); } catch (err) { /* no crítico */ }
        setAvatarPreview(data.avatarUrl);
      } else {
        // si no devolvió avatar persistente, guardamos preview temporal para Header
        if (avatarPreview) localStorage.setItem('tmpAvatarUrl', avatarPreview);
        try { await fetchAndUpdateUser(); } catch (err) { /* ignore */ }
      }

      setMsg({ text: 'Perfil actualizado correctamente', type: 'success' });
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Error actualizando perfil';
      setMsg({ text: errorMsg, type: 'error' });
      console.error('Error al actualizar perfil:', error);
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

          {msg.text && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Avatar src={avatarPreview} sx={{ width: 64, height: 64 }} />
              <Button variant="contained" component="label">
                Subir foto
                <input hidden accept="image/*" type="file" onChange={handleFile} />
              </Button>
            </Box>

            <TextField label="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? <CircularProgress size={20} /> : 'Guardar cambios'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </>
  );
};

export default SettingsPage;