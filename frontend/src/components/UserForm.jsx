import React, { useState, useEffect } from 'react';
import {
  Box, TextField, Button, MenuItem, Select, InputLabel, FormControl, Grid, CircularProgress, Typography
} from '@mui/material';

// Formulario para crear/editar usuarios desde admin.
// Nota: ahora ofrece solo opciones de rol 'driver' y 'admin' (no passenger)
// Evita reinicializar inputs a menos que initialData cambie significativamente.
const UserForm = ({ isSubmitting, onCancel, onSubmit, initialData = undefined, requirePassword = true }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(initialData?.role || 'driver'); // por defecto driver
  const [balance, setBalance] = useState(initialData?.balance != null ? String(initialData.balance) : '0.00');

  // Campos específicos de conductor (opcionales)
  const [vehicle_plate, setVehiclePlate] = useState(initialData?.vehicle_plate || '');
  const [license_number, setLicenseNumber] = useState(initialData?.license_number || '');
  const [vehicle_type, setVehicleType] = useState(initialData?.vehicle_type || '');

  // Inicializar solo cuando initialData cambia de entidad (por ejemplo abre modal o cambia editingUser.id)
  useEffect(() => {
    // Si initialData es undefined (modal creación), iniciamos valores por defecto
    setName(initialData?.name || '');
    setEmail(initialData?.email || '');
    setPassword('');
    setRole(initialData?.role || 'driver');
    setBalance(initialData?.balance != null ? String(initialData.balance) : '0.00');
    setVehiclePlate(initialData?.vehicle_plate || '');
    setLicenseNumber(initialData?.license_number || '');
    setVehicleType(initialData?.vehicle_type || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id, initialData?.email]); // dependencias limitadas para evitar reinicios en cada render

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email || (requirePassword && !password)) {
      // podrías setear un error local; aquí simplemente no submit
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
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Crear/Editar usuario (roles disponibles: DRIVER, ADMIN)
      </Typography>
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
            {isSubmitting ? <CircularProgress size={20} color="inherit" /> : (initialData?.id ? 'Guardar' : (role === 'admin' ? 'Crear Administrador' : 'Crear Conductor'))}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UserForm;