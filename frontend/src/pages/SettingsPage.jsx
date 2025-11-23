import React, { useEffect, useRef, useState } from 'react';
import {
  Container, Paper, Typography, TextField, Button, Box, Avatar, Grid, Stack, CircularProgress, Alert
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, driverAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

/**
 * SettingsPage (actualizado)
 * - Carga perfil desde userAPI.getProfile()
 * - Inicializa form.vehicle <- profile.vehicle_type || profile.vehicle
 * - Inicializa form.plate <- profile.vehicle_plate || profile.plate
 * - Al enviar construye payload que incluye aliases (vehicle + vehicle_type + unit, plate + vehicle_plate + placa, license_number + license)
 * - Si existe endpoint driverAPI.updateProfile, lo llama como fallback (intenta actualizar drivers directamente)
 */

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [form, setForm] = useState({
    email: '',
    phone: '',
    vehicle: '',
    plate: '',
    license_number: ''
  });

  // Load profile on mount and when user changes
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingProfile(true);
      try {
        const res = await userAPI.getProfile();
        // userAPI.getProfile() usually returns res.data or res.data.data depending on API; normalize:
        const profile = res?.data?.data ?? res?.data ?? res;
        if (!mounted) return;

        // Map profile fields to the form. Backend returns vehicle_type/vehicle_plate from drivers table.
        setForm({
          email: profile?.email ?? '',
          phone: profile?.phone ?? profile?.telefono ?? '',
          vehicle: profile?.vehicle_type ?? profile?.vehicle ?? '',
          plate: profile?.vehicle_plate ?? profile?.plate ?? '',
          license_number: profile?.license_number ?? profile?.license ?? profile?.driver?.license_number ?? ''
        });

        setAvatarPreview(profile?.avatar || null);
        // Update auth context user if needed
        setUser && setUser(profile);
      } catch (err) {
        console.error('Error cargando perfil en SettingsPage', err);
        setMsg({ type: 'error', text: 'Error cargando perfil' });
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [setUser]);

  useEffect(() => {
    return () => {
      // revoke preview if blob
      if (avatarPreview && typeof avatarPreview === 'string' && avatarPreview.startsWith('blob:')) {
        try { URL.revokeObjectURL(avatarPreview); } catch (e) { /* ignore */ }
      }
    };
  }, [avatarPreview]);

  const onChange = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleFileInput = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (avatarPreview && typeof avatarPreview === 'string' && avatarPreview.startsWith('blob:')) {
      try { URL.revokeObjectURL(avatarPreview); } catch (err) { /* ignore */ }
    }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const handleClickChangePhoto = () => fileInputRef.current?.click();

  const getHomeForRole = () => {
    const role = (user?.role || 'passenger').toString().toLowerCase();
    if (role === 'driver') return '/driver';
    if (role === 'admin') return '/admin';
    return '/passenger';
  };

  const handleCancel = () => navigate(getHomeForRole());

  // Build payload including aliases to ensure backend receives some name it expects
  const buildPayloadWithAliases = () => {
    const p = {
      email: form.email,
      phone: form.phone,
      // primary keys
      vehicle: form.vehicle,
      plate: form.plate,
      license_number: form.license_number
    };

    // duplicates / aliases
    if (form.vehicle) {
      p.vehicle_type = form.vehicle;
      p.unit = form.vehicle;
    }
    if (form.plate) {
      p.vehicle_plate = form.plate;
      p.placa = form.plate;
    }
    if (form.license_number) {
      p.license = form.license_number;
    }

    // remove undefined or empty string keys (backend may treat empty string as value)
    Object.keys(p).forEach(k => {
      if (p[k] === undefined || p[k] === null) delete p[k];
      if (typeof p[k] === 'string' && p[k].trim() === '') delete p[k];
    });

    return p;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setMsg(null);
    setSaving(true);

    try {
      // If there is an avatar file, use FormData so upload works
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        // append all payload keys (including aliases)
        const payload = buildPayloadWithAliases();
        Object.keys(payload).forEach(k => fd.append(k, payload[k]));
        // send multipart
        await userAPI.updateProfileForm(fd);
      } else {
        // send JSON
        const payload = buildPayloadWithAliases();
        await userAPI.updateProfile(payload);
      }

      // Fallback: also attempt drivers endpoint if available, to ensure drivers table is updated (some backends expect driver-scoped endpoint)
      try {
        // only send driver keys to driver endpoint
        const driverPayload = {};
        if (form.vehicle) driverPayload.vehicle_type = form.vehicle;
        if (form.plate) driverPayload.vehicle_plate = form.plate;
        if (form.license_number) driverPayload.license_number = form.license_number;

        // call driverAPI.updateProfile (if exists) but don't fail the whole flow if it errors
        if (Object.keys(driverPayload).length > 0) {
          await driverAPI.updateProfile(driverPayload).catch(err => {
            // log but don't block
            console.warn('driverAPI.updateProfile fallback failed (non-fatal)', err?.response?.data || err?.message || err);
          });
        }
      } catch (e) {
        console.warn('driver fallback error', e);
      }

      // reload profile from server to refresh app state
      const refreshed = await userAPI.getProfile();
      const profileData = refreshed?.data?.data ?? refreshed?.data ?? refreshed;
      setUser && setUser(profileData);
      // update form fields from returned profile (normalize keys)
      setForm({
        email: profileData?.email ?? '',
        phone: profileData?.phone ?? '',
        vehicle: profileData?.vehicle_type ?? profileData?.vehicle ?? '',
        plate: profileData?.vehicle_plate ?? profileData?.plate ?? '',
        license_number: profileData?.license_number ?? profileData?.license ?? ''
      });
      setAvatarPreview(profileData?.avatar || null);

      setMsg({ type: 'success', text: 'Perfil actualizado correctamente.' });

      // navigate back after a short delay so user sees message
      setTimeout(() => navigate(getHomeForRole(), { state: { successMessage: 'Guardado correctamente' } }), 800);
    } catch (err) {
      console.error('Error guardando perfil desde SettingsPage:', err);
      const serverData = err?.response?.data;
      let text = err?.message || 'Error al guardar cambios';
      if (serverData) {
        if (typeof serverData === 'string') text = serverData;
        else if (serverData.message) text = serverData.message;
        else if (serverData.error) text = serverData.error;
        else if (serverData.errors) {
          const vals = Object.values(serverData.errors).flat();
          text = Array.isArray(vals) ? vals.join(' — ') : String(vals);
        }
      }
      setMsg({ type: 'error', text });
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const showVehicleFields = (user?.role || '').toString().toLowerCase() === 'driver';

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>Ajustes de perfil</Typography>

        {msg && (
          <Alert severity={msg.type === 'error' ? 'error' : 'success'} sx={{ mb: 2 }}>
            {msg.text}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar src={avatarPreview || undefined} sx={{ width: 72, height: 72 }}>
            {(user?.name || '').charAt(0) || 'U'}
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
              <Button variant="contained" onClick={handleClickChangePhoto} disabled={saving}>
                {saving ? 'Procesando...' : 'Cambiar foto'}
              </Button>
              <Button variant="outlined" onClick={() => { setAvatarFile(null); setAvatarPreview(user?.avatar || null); }} disabled={saving}>Eliminar</Button>
            </Stack>

            <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
              JPG/PNG, máximo recomendado 2MB.
            </Typography>
          </Box>
        </Box>

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Correo electrónico"
                fullWidth
                value={form.email}
                onChange={onChange('email')}
                disabled={saving}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Teléfono"
                fullWidth
                value={form.phone}
                onChange={onChange('phone')}
                disabled={saving}
              />
            </Grid>

            {showVehicleFields && (
              <>
                <Grid item xs={12}>
                  <TextField
                    label="Unidad / Tipo de vehículo"
                    fullWidth
                    value={form.vehicle}
                    onChange={onChange('vehicle')}
                    disabled={saving}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Placa"
                    fullWidth
                    value={form.plate}
                    onChange={onChange('plate')}
                    disabled={saving}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Número de licencia"
                    fullWidth
                    value={form.license_number}
                    onChange={onChange('license_number')}
                    disabled={saving}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
              <Button variant="outlined" onClick={handleCancel} disabled={saving}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
}