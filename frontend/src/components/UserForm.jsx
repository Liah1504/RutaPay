import React, { useEffect, useState } from 'react';
import {
  Grid,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Typography
} from '@mui/material';

/**
 * UserForm
 * Props:
 *  - initialData: optional object with fields to prefill (used in edit)
 *  - onSubmit(formData): function called with form payload when user submits
 *  - onCancel(): cancel handler
 *  - isSubmitting: boolean
 *  - requirePassword: boolean (if true, password is required)
 *
 * Behavior:
 *  - Shows driver-specific fields (balance, vehicle_type, vehicle_plate, license_number)
 *    only when role corresponds to a driver (role values: 'driver', 'conductor', 'chofer').
 *  - When role switches away from driver, driver-specific fields are cleared.
 *  - On submit, driver-only fields are omitted from payload unless role is driver.
 */
const UserForm = ({ initialData = {}, onSubmit, onCancel, isSubmitting = false, requirePassword = false }) => {
  // Basic user fields
  const [name, setName] = useState(initialData.name ?? '');
  const [email, setEmail] = useState(initialData.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(initialData.role ?? 'driver'); // default driver if creating

  // Driver-specific
  const [balance, setBalance] = useState(initialData.balance ?? 0);
  const [vehicleType, setVehicleType] = useState(initialData.vehicle_type ?? initialData.vehicleType ?? '');
  const [vehiclePlate, setVehiclePlate] = useState(initialData.vehicle_plate ?? initialData.vehiclePlate ?? '');
  const [licenseNumber, setLicenseNumber] = useState(initialData.license_number ?? initialData.licenseNumber ?? '');

  const [error, setError] = useState('');

  useEffect(() => {
    // If initialData.role changes (editing different user), update role locally
    setRole(initialData.role ?? 'driver');
    setName(initialData.name ?? '');
    setEmail(initialData.email ?? '');
    setBalance(initialData.balance ?? 0);
    setVehicleType(initialData.vehicle_type ?? initialData.vehicleType ?? '');
    setVehiclePlate(initialData.vehicle_plate ?? initialData.vehiclePlate ?? '');
    setLicenseNumber(initialData.license_number ?? initialData.licenseNumber ?? '');
    setPassword('');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id]);

  const isDriverRole = (r) => {
    if (!r) return false;
    const v = String(r).toLowerCase();
    return v === 'driver' || v === 'conductor' || v === 'chofer';
  };

  const handleRoleChange = (ev) => {
    const newRole = ev.target.value;
    setRole(newRole);
    // If switching away from driver, clear driver-only fields
    if (!isDriverRole(newRole)) {
      setBalance(0);
      setVehicleType('');
      setVehiclePlate('');
      setLicenseNumber('');
    }
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setError('');

    if (!name || !email || (requirePassword && !password && !initialData?.id)) {
      setError('Nombre, correo y contraseña (si se requiere) son obligatorios.');
      return;
    }

    // Build payload
    const payload = {
      name,
      email,
      role
    };

    // Only include password if provided (for edits)
    if (password) payload.password = password;

    // Include driver-specific fields only when role is driver
    if (isDriverRole(role)) {
      // balance might be number or string -> make number
      payload.balance = Number(balance || 0);
      if (vehicleType) payload.vehicle_type = vehicleType;
      if (vehiclePlate) payload.vehicle_plate = vehiclePlate;
      if (licenseNumber) payload.license_number = licenseNumber;
    }

    try {
      await onSubmit(payload);
    } catch (err) {
      // onSubmit should throw or set errors; show a fallback message
      console.error('UserForm submit error:', err);
      setError(err?.response?.data?.error || err?.message || 'Error al crear/actualizar usuario');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
        </Grid>

        <Grid item xs={12}>
          <TextField label="Correo Electrónico *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
        </Grid>

        <Grid item xs={12}>
          <TextField
            label={initialData?.id ? 'Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required={requirePassword && !initialData?.id}
          />
        </Grid>

        <Grid item xs={6}>
          <FormControl fullWidth>
            <InputLabel id="user-role-select">Rol</InputLabel>
            <Select
              labelId="user-role-select"
              value={role}
              label="Rol"
              onChange={handleRoleChange}
            >
              <MenuItem value="driver">Conductor</MenuItem>
              <MenuItem value="admin">Administrador</MenuItem>
              {/* keep other roles if you have them */}
            </Select>
          </FormControl>
        </Grid>

        {/* Balance often shown regardless in your modal; hide it when not driver */}
        {isDriverRole(role) ? (
          <Grid item xs={6}>
            <TextField
              label="Balance (Bs)"
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              fullWidth
            />
          </Grid>
        ) : (
          // keep grid spacing consistent when balance hidden
          <Grid item xs={6} />
        )}

        {/* Driver-only fields */}
        {isDriverRole(role) && (
          <>
            <Grid item xs={4}>
              <TextField label="Placa (opcional)" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={4}>
              <TextField label="Tipo de vehículo (opcional)" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={4}>
              <TextField label="Número de licencia (opcional)" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} fullWidth />
            </Grid>
          </>
        )}

        {error && (
          <Grid item xs={12}>
            <Typography color="error">{error}</Typography>
          </Grid>
        )}

        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : (initialData?.id ? 'Actualizar' : (isDriverRole(role) ? 'Crear Conductor' : 'Crear Administrador'))}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UserForm;