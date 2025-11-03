import React, { useState, useEffect } from 'react';
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  Typography
} from '@mui/material';

// A reusable form for creating or editing users
const UserForm = ({ onSubmit, onCancel, initialData = {}, isSubmitting }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'passenger',
    ...initialData,
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Completa los datos para el nuevo usuario. La contraseña es obligatoria.
      </Typography>
      <TextField
        margin="dense"
        required
        fullWidth
        label="Nombre Completo"
        name="name"
        value={formData.name}
        onChange={handleChange}
      />
      <TextField
        margin="dense"
        required
        fullWidth
        label="Correo Electrónico"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
      />
      <TextField
        margin="dense"
        required
        fullWidth
        label="Contraseña"
        name="password"
        type="password"
        value={formData.password}
        onChange={handleChange}
      />
      <TextField
        margin="dense"
        fullWidth
        label="Teléfono"
        name="phone"
        value={formData.phone}
        onChange={handleChange}
      />
      <FormControl fullWidth margin="dense" required>
        <InputLabel>Rol</InputLabel>
        <Select
          name="role"
          value={formData.role}
          label="Rol"
          onChange={handleChange}
        >
          {/* This form, used by the admin, CAN create other admins */}
          <MenuItem value="admin">Administrador</MenuItem>
          <MenuItem value="driver">Conductor</MenuItem>
          <MenuItem value="passenger">Pasajero</MenuItem>
        </Select>
      </FormControl>
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} sx={{ mr: 1 }}>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? 'Creando...' : 'Crear Usuario'}
        </Button>
      </Box>
    </Box>
  );
};

export default UserForm;