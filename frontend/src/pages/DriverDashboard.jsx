import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container, Paper, Typography, Button,
  Box, Grid, Alert, CircularProgress,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Avatar
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { driverAPI, tripAPI } from '../services/api';
import EarningsChart from '../components/EarningsChart';

const DriverDashboard = () => {
  const { user, fetchAndUpdateUser } = useAuth();
  const [driverProfile, setDriverProfile] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [message, setMessage] = useState('');

  // Pagos
  const [driverPayments, setDriverPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Resumen por ruta (por día)
  const todayIso = new Date().toISOString().slice(0, 10);
  const [summaryDate, setSummaryDate] = useState(todayIso);
  const [paymentsSummary, setPaymentsSummary] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryTotal, setSummaryTotal] = useState(0);

  // Para evitar actualizar estado si no cambió (reduce re-renders que causan "flicker")
  const setIfDifferent = (setter) => (newValue) => {
    setter(prev => {
      try {
        const prevStr = JSON.stringify(prev || {});
        const newStr = JSON.stringify(newValue || {});
        return prevStr === newStr ? prev : newValue;
      } catch (e) {
        return newValue;
      }
    });
  };

  const setDriverProfileIfDiff = setIfDifferent(setDriverProfile);
  const setTripsIfDiff = setIfDifferent(setTrips);
  const setDriverPaymentsIfDiff = setIfDifferent(setDriverPayments);
  const setPaymentsSummaryIfDiff = setIfDifferent(setPaymentsSummary);

  // Obtener viajes del conductor (para completed etc.)
  const fetchDriverTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const response = await tripAPI.getDriverTrips();
      setTripsIfDiff(response.data || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
      setMessage('Error al cargar viajes');
    } finally {
      setLoadingTrips(false);
    }
  }, [setTripsIfDiff]);

  const fetchDriverProfile = useCallback(async () => {
    try {
      const response = await driverAPI.getProfile();
      // response.data incluye balance desde users y datos del driver
      setDriverProfileIfDiff(response.data || null);
    } catch (error) {
      console.error('Error fetching driver profile:', error);
      setMessage('Error cargando perfil');
    }
  }, [setDriverProfileIfDiff]);

  // Historial de pagos
  const fetchDriverPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const res = await driverAPI.getPayments();
      setDriverPaymentsIfDiff(res.data || []);
    } catch (err) {
      console.error('Error fetching driver payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  }, [setDriverPaymentsIfDiff]);

  // Resumen por ruta para una fecha
  const fetchPaymentsSummary = useCallback(async (date) => {
    setLoadingSummary(true);
    try {
      const res = await driverAPI.getPaymentsSummary(date);
      setPaymentsSummaryIfDiff(res.data.totals || []);
      setSummaryTotal(res.data.total || 0);
    } catch (err) {
      console.error('Error fetching payments summary:', err);
      setPaymentsSummaryIfDiff([]);
      setSummaryTotal(0);
    } finally {
      setLoadingSummary(false);
    }
  }, [setPaymentsSummaryIfDiff]);

  // Polling moderado (30s) para no causar parpadeos frecuentes
  const pollingRef = useRef(null);

  useEffect(() => {
    // Primera carga
    fetchDriverProfile();
    fetchDriverTrips();
    fetchDriverPayments();
    fetchPaymentsSummary(summaryDate);

    // Polling (cada 30 segundos)
    pollingRef.current = setInterval(() => {
      fetchDriverTrips();
      fetchDriverPayments();
      fetchPaymentsSummary(summaryDate);
    }, 30000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchDriverProfile, fetchDriverTrips, fetchDriverPayments, fetchPaymentsSummary, summaryDate]);

  // completed trips (si quieres mantener)
  const completedTrips = trips.filter(t => t.status === 'completed');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
        {message && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}

        {/* Título limpio con icono MUI */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <DirectionsCarIcon />
          </Avatar>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
            Panel del Conductor
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Tarjeta Saldo */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%', bgcolor: 'success.light', color: 'white' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>Tu Saldo (Ganancias)</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {user?.balance ? parseFloat(user.balance).toFixed(2) : '0.00'} Bs
              </Typography>
            </Paper>
          </Grid>

          {/* Tarjeta Perfil conductor (limpia) */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>Mi Vehículo / Perfil</Typography>
              <Typography><strong>Vehículo:</strong> {driverProfile?.vehicle_type || 'No reg.'}</Typography>
              <Typography><strong>Placa:</strong> {driverProfile?.vehicle_plate || 'No reg.'}</Typography>
              <Typography><strong>Código:</strong> {driverProfile?.driver_code || 'N/A'}</Typography>
              <Typography sx={{ mt: 1, color: 'text.secondary' }}>{driverProfile?.name ? `Conductor: ${driverProfile.name}` : ''}</Typography>
            </Paper>
          </Grid>

          {/* Atajos */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>Atajos</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button variant="contained" onClick={() => fetchDriverPayments()}>Actualizar Pagos</Button>
                <Button variant="outlined" onClick={() => fetchPaymentsSummary(summaryDate)}>Resumen Día</Button>
              </Box>
            </Paper>
          </Grid>

          {/* Historial de Pagos Recibidos */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>Historial de Pagos Recibidos</Typography>
              {loadingPayments ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
              ) : driverPayments.length === 0 ? (
                <Typography color="text.secondary">No hay pagos registrados.</Typography>
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
                      {driverPayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.route_name}</TableCell>
                          <TableCell>{p.passenger_name}</TableCell>
                          <TableCell>{parseFloat(p.amount).toFixed(2)}</TableCell>
                          <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>

          {/* Ganancias por Ruta - Selector de Fecha */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Ganancias por Ruta (por día)</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField
                    type="date"
                    value={summaryDate}
                    onChange={(e) => setSummaryDate(e.target.value)}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                  <Button variant="contained" onClick={() => fetchPaymentsSummary(summaryDate)}>Ver</Button>
                </Box>
              </Box>

              {loadingSummary ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress /></Box>
              ) : paymentsSummary.length === 0 ? (
                <Typography color="text.secondary">No hay movimientos para la fecha seleccionada.</Typography>
              ) : (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Ruta</TableCell>
                          <TableCell align="right">Total (Bs)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paymentsSummary.map((r) => (
                          <TableRow key={r.route_id}>
                            <TableCell>{r.route_name}</TableCell>
                            <TableCell align="right">{parseFloat(r.total).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* ——— Aquí: mostramos el gráfico si hay data ——— */}
                  <Box sx={{ mt: 3 }}>
                    {paymentsSummary.length > 0 && <EarningsChart data={paymentsSummary} />}
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Typography variant="h6">Total del día: <strong>{parseFloat(summaryTotal).toFixed(2)} Bs</strong></Typography>
                  </Box>
                </>
              )}
            </Paper>
          </Grid>

          {/* Viajes Completados (opcional) */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>Viajes Completados</Typography>
              {loadingTrips ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
              ) : completedTrips.length === 0 ? (
                <Typography color="text.secondary">No hay viajes completados.</Typography>
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