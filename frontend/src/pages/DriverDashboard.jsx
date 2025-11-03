import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Paper, Typography, Button, Switch, FormControlLabel, 
  Box, Card, CardContent, Grid, Alert, CircularProgress,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { driverAPI, tripAPI } from '../services/api';

const DriverDashboard = () => {
  // Usamos 'user' del AuthContext para el saldo
  const { user, fetchAndUpdateUser } = useAuth(); 
  const [driverProfile, setDriverProfile] = useState(null); // Para datos de la tabla 'drivers'
  const [trips, setTrips] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(true); 
  const [message, setMessage] = useState('');

  // Función para obtener los viajes
  const fetchDriverTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const response = await tripAPI.getDriverTrips();
      setTrips(response.data);
    } catch (error) {
      console.error('Error fetching trips:', error);
      setMessage('Error al cargar viajes asignados');
    } finally {
      setLoadingTrips(false);
    }
  }, []); 

  // Función para obtener el perfil (info del vehículo, código, etc.)
  const fetchDriverProfile = useCallback(async () => {
    try {
      const response = await driverAPI.getProfile();
      setDriverProfile(response.data);
    } catch (error) {
      console.error('Error fetching driver status:', error);
    }
  }, []);

  useEffect(() => {
    fetchDriverProfile();
    fetchDriverTrips();

    // Polling para nuevos viajes
    const interval = setInterval(() => {
      fetchDriverTrips();
    }, 10000); 

    return () => clearInterval(interval);
  }, [fetchDriverProfile, fetchDriverTrips]);

  const handleStatusChange = async (event) => {
    const newStatus = event.target.checked;
    setLoadingStatus(true);
    try {
      await driverAPI.updateStatus({ is_available: newStatus, current_location: null });
      setDriverProfile(prev => ({ ...prev, is_available: newStatus }));
      setMessage(`Ahora estás ${newStatus ? 'disponible' : 'no disponible'}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating status:', error);
      setMessage('Error al actualizar estado');
    }
    setLoadingStatus(false);
  };

  // Cuando el conductor completa un viaje
  const updateTripStatus = async (tripId, newStatus) => {
    try {
      await tripAPI.updateStatus({
        trip_id: tripId,
        status: newStatus
      });
      setMessage(`Viaje ${newStatus === 'completed' ? 'completado' : 'iniciado'}`);
      
      // Refrescamos ambas cosas:
      fetchDriverTrips(); 
      fetchAndUpdateUser(); // Refrescamos el saldo del conductor desde el AuthContext

    } catch (error) {
      console.error('Error updating trip:', error);
      setMessage('Error al actualizar viaje');
    }
  };

  // Filtramos los viajes en dos listas
  const pendingTrips = trips.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const completedTrips = trips.filter(t => t.status === 'completed');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
        {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}

        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
          🚗 Panel del Conductor
        </Typography>

        <Grid container spacing={3}>
          {/* Columna 1: Estado */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>Estado</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={driverProfile?.is_available || false}
                    onChange={handleStatusChange}
                    color="primary"
                    disabled={loadingStatus}
                  />
                }
                label={driverProfile?.is_available ? '🟢 Disponible' : '🔴 No Disponible'}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {driverProfile?.is_available 
                  ? 'Estás disponible para recibir solicitudes.' 
                  : 'No recibirás nuevas solicitudes.'
                }
              </Typography>
            </Paper>
          </Grid>
          
          {/* Columna 2: Saldo (Ganancias) */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%', bgcolor: 'success.light', color: 'white' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>Tu Saldo (Ganancias)</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {/* Usamos el 'user.balance' del AuthContext */}
                {user?.balance ? parseFloat(user.balance).toFixed(2) : '0.00'} Bs
              </Typography>
            </Paper>
          </Grid>

          {/* Columna 3: Información del Vehículo */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>Mi Vehículo</Typography>
              <Typography><strong>Vehículo:</strong> {driverProfile?.vehicle_type || 'No reg.'}</Typography>
              <Typography><strong>Placa:</strong> {driverProfile?.vehicle_plate || 'No reg.'}</Typography>
              <Typography><strong>Código:</strong> {driverProfile?.driver_code || 'N/A'}</Typography>
            </Paper>
          </Grid>

          {/* Viajes Pendientes (Acción Requerida) */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom color="primary">Viajes Asignados (Pendientes)</Typography>
              
              {loadingTrips ? (
                 <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
              ) : pendingTrips.length === 0 ? (
                <Typography color="text.secondary">No tienes viajes pendientes.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ruta</TableCell>
                        <TableCell>Pasajero</TableCell>
                        <TableCell>Teléfono</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">Acción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingTrips.map((trip) => (
                        <TableRow key={trip.id}>
                          <TableCell>{trip.route_name}</TableCell>
                          <TableCell>{trip.passenger_name}</TableCell>
                          <TableCell>{trip.passenger_phone || 'N/A'}</TableCell>
                          <TableCell>{trip.status}</TableCell>
                          <TableCell align="right">
                            {trip.status === 'pending' && (
                              <Button 
                                variant="contained" 
                                color="secondary"
                                size="small"
                                onClick={() => updateTripStatus(trip.id, 'in_progress')}
                              >
                                Aceptar Viaje
                              </Button>
                            )}
                            {trip.status === 'in_progress' && (
                              <Button 
                                variant="contained" 
                                color="success"
                                size="small"
                                onClick={() => updateTripStatus(trip.id, 'completed')}
                              >
                                Completar Viaje
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
          
          {/* Historial de Pagos Recibidos (Viajes Completados) */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom color="text.secondary">Historial de Pagos Recibidos</Typography>
              
              {loadingTrips ? (
                 <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
              ) : completedTrips.length === 0 ? (
                <Typography color="text.secondary">No has completado viajes.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ruta</TableCell>
                        <TableCell>Pasajero</TableCell>
                        <TableCell>Monto (Bs)</TableCell>
                        <TableCell>Fecha</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {completedTrips.map((trip) => (
                        <TableRow key={trip.id}>
                          <TableCell>{trip.route_name}</TableCell>
                          <TableCell>{trip.passenger_name}</TableCell>
                          <TableCell>{parseFloat(trip.fare).toFixed(2)}</TableCell>
                          <TableCell>{new Date(trip.updated_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default DriverDashboard;