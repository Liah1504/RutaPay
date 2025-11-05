import React, { useState } from 'react';
import { Box, TextField, Button, Paper, Typography, Alert } from '@mui/material';
import { adminAPI } from '../services/api';

const DriverForm = ({ onCreated }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !name) {
      setError('Email, nombre y contraseña son requeridos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.createDriver({ email, password, name, phone, vehicle_type: vehicleType, vehicle_plate: vehiclePlate });
      if (onCreated) onCreated(res.data);
      // limpiar
      setEmail(''); setName(''); setPhone(''); setPassword(''); setVehicleType(''); setVehiclePlate('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error creando conductor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Crear Conductor</Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 1 }}>
        <TextField label="Nombre" value={name} onChange={e => setName(e.target.value)} required />
        <TextField label="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <TextField label="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} />
        <TextField label="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required type="password" />
        <TextField label="Tipo Vehículo" value={vehicleType} onChange={e => setVehicleType(e.target.value)} />
        <TextField label="Placa" value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} />
        <Button variant="contained" type="submit" disabled={loading}>
          {loading ? 'Creando...' : 'Crear Conductor'}
        </Button>
      </Box>
    </Paper>
  );
};

export default DriverForm;