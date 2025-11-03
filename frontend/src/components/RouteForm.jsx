// frontend/src/components/RouteForm.jsx

import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Grid,
  Box,
  CircularProgress,
  Switch,
  FormControlLabel,
  Typography
} from '@mui/material';

const RouteForm = ({ onSubmit, onCancel, isSubmitting, initialData = {} }) => {
  // Inicializamos el estado con los datos de initialData (si estamos editando) o valores vacíos
  const [formData, setFormData] = useState({
    name: '',
    start_point: '',
    end_point: '',
    fare: '',
    estimated_time: '',
    distance: '',
    is_active: true,
  });

  // Cargar datos iniciales si estamos editando
  useEffect(() => {
    if (initialData.id) {
      setFormData({
        name: initialData.name || '',
        start_point: initialData.start_point || '',
        end_point: initialData.end_point || '',
        // Los valores numéricos vienen como string desde el backend, los cargamos como string
        fare: initialData.fare || '', 
        estimated_time: initialData.estimated_time || '',
        distance: initialData.distance || '',
        is_active: initialData.is_active !== undefined ? initialData.is_active : true,
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      // Manejamos el switch (checkbox) y los inputs de texto
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Convertimos los campos numéricos (fare, time, distance) a números para el backend
    const dataToSubmit = {
        ...formData,
        fare: parseFloat(formData.fare),
        estimated_time: parseInt(formData.estimated_time, 10),
        distance: parseFloat(formData.distance),
        // No enviamos password si no existe (al editar)
        // ... (Tu backend debería ignorar waypoints y demás si no se envían)
    };
    
    onSubmit(dataToSubmit);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ py: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Define los puntos y costos de la nueva ruta del sistema.
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            name="name"
            label="Nombre de la Ruta (ej. Propatria - Chacaíto)"
            value={formData.name}
            onChange={handleChange}
            fullWidth
            required
            margin="dense"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            name="start_point"
            label="Punto de Inicio"
            value={formData.start_point}
            onChange={handleChange}
            fullWidth
            required
            margin="dense"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            name="end_point"
            label="Punto Final"
            value={formData.end_point}
            onChange={handleChange}
            fullWidth
            required
            margin="dense"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            name="fare"
            label="Tarifa (Bs.)"
            type="number"
            value={formData.fare}
            onChange={handleChange}
            fullWidth
            required
            margin="dense"
            inputProps={{ step: "0.01" }} // Permite decimales
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            name="estimated_time"
            label="Tiempo Est. (minutos)"
            type="number"
            value={formData.estimated_time}
            onChange={handleChange}
            fullWidth
            margin="dense"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            name="distance"
            label="Distancia (km)"
            type="number"
            value={formData.distance}
            onChange={handleChange}
            fullWidth
            margin="dense"
            inputProps={{ step: "0.01" }} // Permite decimales
          />
        </Grid>
        <Grid item xs={12}>
           <FormControlLabel
              control={
                <Switch
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
              }
              label={formData.is_active ? "Ruta Activa (Recibirá viajes)" : "Ruta Inactiva (Solo gestión)"}
            />
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ ml: 2 }}>
          {isSubmitting ? <CircularProgress size={24} /> : (initialData.id ? 'Actualizar Ruta' : 'Crear Ruta')}
        </Button>
      </Box>
    </Box>
  );
};

export default RouteForm;