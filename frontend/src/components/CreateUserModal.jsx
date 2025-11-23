import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, MenuItem, Grid, FormControl, InputLabel, Select
} from '@mui/material';
import { adminAPI } from '../services/api';

const CreateUserModal = ({ open, onClose, onCreated }) => {
  const [role, setRole] = useState('driver');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [balance, setBalance] = useState(0);
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setRole('driver');
      setName(''); setEmail(''); setPassword('');
      setBalance(0); setVehicleType(''); setVehiclePlate(''); setLicenseNumber('');
      setError('');
    }
  }, [open]);

  const isDriver = (r) => {
    if (!r) return false;
    const v = String(r).toLowerCase();
    return v === 'driver' || v === 'conductor' || v === 'chofer';
  };

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setRole(newRole);
    if (!isDriver(newRole)) {
      setBalance(0); setVehicleType(''); setVehiclePlate(''); setLicenseNumber('');
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!name || !email || !password) { setError('Nombre, email y contraseña son requeridos.'); return; }
    setLoading(true);
    try {
      if (isDriver(role)) {
        await adminAPI.createDriver({
          email, password, name,
          vehicle_type: vehicleType || null,
          vehicle_plate: vehiclePlate || null
        });
      } else {
        // crear admin / usuario
        await adminAPI.createUser({ email, password, name, role: 'admin' });
      }
      setLoading(false);
      onCreated && onCreated();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err?.response?.data?.error || 'Error creando usuario');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Crear Nuevo Usuario</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}><TextField label="Nombre *" fullWidth value={name} onChange={e => setName(e.target.value)} /></Grid>
          <Grid item xs={12}><TextField label="Correo Electrónico *" type="email" fullWidth value={email} onChange={e => setEmail(e.target.value)} /></Grid>
          <Grid item xs={12}><TextField label="Contraseña *" type="password" fullWidth value={password} onChange={e => setPassword(e.target.value)} /></Grid>

          <Grid item xs={6}>
            <FormControl fullWidth>
              <InputLabel id="role-select-label">Rol</InputLabel>
              <Select labelId="role-select-label" value={role} label="Rol" onChange={handleRoleChange}>
                <MenuItem value="driver">Conductor</MenuItem>
                <MenuItem value="admin">Administrador</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Solo mostrar campos de conductor */}
          {isDriver(role) && (
            <>
              <Grid item xs={6}><TextField label="Balance (Bs)" type="number" fullWidth value={balance} onChange={e => setBalance(e.target.value)} /></Grid>
              <Grid item xs={6}><TextField label="Tipo de vehículo" fullWidth value={vehicleType} onChange={e => setVehicleType(e.target.value)} /></Grid>
              <Grid item xs={6}><TextField label="Placa (opcional)" fullWidth value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} /></Grid>
              <Grid item xs={6}><TextField label="Número de licencia (opcional)" fullWidth value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} /></Grid>
            </>
          )}

          {error && <Grid item xs={12}><div style={{ color: 'red' }}>{error}</div></Grid>}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary" disabled={loading}>
          {loading ? 'Creando...' : (isDriver(role) ? 'Crear Conductor' : 'Crear Administrador')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateUserModal;