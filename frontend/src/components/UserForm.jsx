import React, { useState, useEffect } from 'react';
import {
  Box, TextField, Button, MenuItem, Select, InputLabel, FormControl, Grid, CircularProgress
} from '@mui/material';

// Props: isSubmitting, onCancel, onSubmit, initialData = {}, requirePassword = true
const UserForm = ({ isSubmitting, onCancel, onSubmit, initialData = {}, requirePassword = true }) => {
  // Normalizar initialData por si viene null/undefined
  const data = initialData || {};

  const [name, setName] = useState(data.name || '');
  const [email, setEmail] = useState(data.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(data.role || 'driver'); // por defecto driver
  const [balance, setBalance] = useState(data.balance != null ? String(data.balance) : '0.00');

  // Campos específicos de conductor (opcionales)
  const [vehicle_plate, setVehiclePlate] = useState(data.vehicle_plate || '');
  const [license_number, setLicenseNumber] = useState(data.license_number || '');
  const [vehicle_type, setVehicleType] = useState(data.vehicle_type || '');

  // Inicializar solo cuando cambie realmente el user (por ejemplo id o email)
  useEffect(() => {
    const d = initialData || {};
    setName(d.name || '');
    setEmail(d.email || '');
    setPassword('');
    setRole(d.role || 'driver');
    setBalance(d.balance != null ? String(d.balance) : '0.00');
    setVehiclePlate(d.vehicle_plate || '');
    setLicenseNumber(d.license_number || '');
    setVehicleType(d.vehicle_type || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id, initialData?.email]); // dependencias estables: evita reinicios por referencia de objeto

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validaciones básicas
    if (!name || !email || (requirePassword && !password)) {
      return;
    }
    const payload = {
      name: name.trim(),
      email: email.trim(),
      ...(password ? { password } : {}),
      role,
      balance: balance ? parseFloat(balance) : 0,
      vehicle_plate: vehicle_plate ? vehicle_plate.trim() : undefined,
      license_number: license_number ? license_number.trim() : undefined,
      vehicle_type: vehicle_type ? vehicle_type.trim() : undefined
    };
    onSubmit(payload);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
        </Grid>
        <Grid item xs={12}>
          <TextField label="Correo Electrónico" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required />
        </Grid>
        {requirePassword && (
          <Grid item xs={12}>
            <TextField label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth required />
          </Grid>
        )}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Rol</InputLabel>
            <Select value={role} label="Rol" onChange={(e) => setRole(e.target.value)}>
              <MenuItem value="driver">Conductor</MenuItem>
              <MenuItem value="admin">Administrador</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField label="Balance (Bs)" value={balance} onChange={(e) => setBalance(e.target.value)} fullWidth />
        </Grid>

        {/* Campos de conductor */}
        <Grid item xs={12} sm={4}>
          <TextField label="Placa (opcional)" value={vehicle_plate} onChange={(e) => setVehiclePlate(e.target.value)} fullWidth />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField label="Tipo de vehículo (opcional)" value={vehicle_type} onChange={(e) => setVehicleType(e.target.value)} fullWidth />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField label="Número de licencia (opcional)" value={license_number} onChange={(e) => setLicenseNumber(e.target.value)} fullWidth />
        </Grid>

        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} color="inherit" /> : (data && data.id ? 'Guardar' : (role === 'admin' ? 'Crear Administrador' : 'Crear Conductor'))}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UserForm;