import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Paper, Typography, Box, Grid, Alert, CircularProgress,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Avatar, IconButton, Tooltip, Button
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import RefreshIcon from '@mui/icons-material/Refresh';
import SummarizeIcon from '@mui/icons-material/Summarize';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { driverAPI, tripAPI } from '../services/api';
import EarningsChart from '../components/EarningsChart';

const DriverDashboard = () => {
  const { user } = useAuth();

  const [driverProfile, setDriverProfile] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [message, setMessage] = useState('');

  const [driverPayments, setDriverPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);
  const [summaryDate, setSummaryDate] = useState(todayIso);
  const [paymentsSummary, setPaymentsSummary] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryTotal, setSummaryTotal] = useState(0);

  const [chartData, setChartData] = useState([]);

  // setIfDifferent memoizado para ser estable entre renders
  const setIfDifferent = useCallback((setter) => (newValue) => {
    setter((prev) => {
      try {
        const prevStr = JSON.stringify(prev || {});
        const newStr = JSON.stringify(newValue || {});
        return prevStr === newStr ? prev : newValue;
      } catch {
        return newValue;
      }
    });
  }, []);

  const setDriverProfileIfDiff = setIfDifferent(setDriverProfile);
  const setTripsIfDiff = setIfDifferent(setTrips);
  const setDriverPaymentsIfDiff = setIfDifferent(setDriverPayments);
  const setPaymentsSummaryIfDiff = setIfDifferent(setPaymentsSummary);
  const setChartDataIfDiff = setIfDifferent(setChartData);

  // fetch functions (estables)
  const fetchDriverProfile = useCallback(async () => {
    try {
      const res = await driverAPI.getProfile();
      setDriverProfileIfDiff(res.data || null);
    } catch (err) {
      console.error('Error fetching driver profile:', err);
      setMessage('Error cargando perfil');
    }
  }, [setDriverProfileIfDiff]);

  const fetchDriverTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const res = await tripAPI.getDriverTrips();
      setTripsIfDiff(res.data || []);
    } catch (err) {
      console.error('Error fetching trips:', err);
      setMessage('Error al cargar viajes');
    } finally {
      setLoadingTrips(false);
    }
  }, [setTripsIfDiff]);

  const fetchDriverPayments = useCallback(async (opts = { overlay: false }) => {
    // overlay: show overlay spinner if there are existing items
    if (!opts.overlay) setLoadingPayments(true);
    else setLoadingPayments(true);
    try {
      const res = await driverAPI.getPayments();
      setDriverPaymentsIfDiff(res.data || []);
    } catch (err) {
      console.error('Error fetching driver payments:', err);
      setMessage('Error cargando pagos');
    } finally {
      setLoadingPayments(false);
    }
  }, [setDriverPaymentsIfDiff]);

  const fetchPaymentsSummary = useCallback(async (date, opts = { overlay: false }) => {
    if (!opts.overlay) setLoadingSummary(true);
    else setLoadingSummary(true);
    try {
      const res = await driverAPI.getPaymentsSummary(date);
      const totals = res.data?.totals || [];
      setPaymentsSummaryIfDiff(totals);
      setSummaryTotal(res.data?.total || 0);
      const chart = (totals || []).map(r => ({ date: r.route_name || 'Sin ruta', earnings: Number(r.total || 0) }));
      setChartDataIfDiff(chart);
    } catch (err) {
      console.error('Error fetching payments summary:', err);
      setMessage('Error al obtener resumen por ruta');
    } finally {
      setLoadingSummary(false);
    }
  }, [setPaymentsSummaryIfDiff, setChartDataIfDiff]);

  // Inicialización: se ejecuta una sola vez al montar (sin dependencias que cambien cada render)
  useEffect(() => {
    fetchDriverProfile();
    fetchDriverTrips();
    fetchDriverPayments({ overlay: false });
    fetchPaymentsSummary(summaryDate, { overlay: false });
    // intentionally no dependencies -> run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // handlers manuales para evitar polling agresivo
  const onRefreshPayments = () => fetchDriverPayments({ overlay: true });
  const onRefreshSummary = () => fetchPaymentsSummary(summaryDate, { overlay: true });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
        {message && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}><DirectionsCarIcon /></Avatar>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Panel del Conductor</Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%', bgcolor: 'success.light', color: 'white' }}>
              <Typography variant="h6">Tu Saldo (Ganancias)</Typography>
              <Typography variant="h4">{user?.balance ? parseFloat(user.balance).toFixed(2) : '0.00'} Bs</Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6">Mi Vehículo / Perfil</Typography>
              <Typography><strong>Vehículo:</strong> {driverProfile?.vehicle_type || 'No reg.'}</Typography>
              <Typography><strong>Placa:</strong> {driverProfile?.vehicle_plate || 'No reg.'}</Typography>
              <Typography><strong>Código:</strong> {driverProfile?.driver_code || 'N/A'}</Typography>
              <Typography sx={{ mt: 1, color: 'text.secondary' }}>{driverProfile?.name ? `Conductor: ${driverProfile.name}` : ''}</Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
              <Tooltip title="Actualizar pagos"><IconButton color="primary" onClick={onRefreshPayments}><RefreshIcon /></IconButton></Tooltip>
              <Tooltip title="Resumen del día"><IconButton color="primary" onClick={onRefreshSummary}><SummarizeIcon /></IconButton></Tooltip>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3, position: 'relative' }}>
              <Typography variant="h5" gutterBottom>Historial de Pagos Recibidos</Typography>

              <Box sx={{ minHeight: 120 }}>
                {loadingPayments && driverPayments.length === 0 ? (
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
              </Box>

              {loadingPayments && driverPayments.length > 0 && (
                <Box sx={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.6)'
                }}>
                  <CircularProgress />
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3, position: 'relative' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Ganancias por Ruta (por día)</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField type="date" value={summaryDate} onChange={(e) => setSummaryDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
                  <Button variant="contained" onClick={onRefreshSummary}>Ver</Button>
                </Box>
              </Box>

              <Box sx={{ minHeight: 120 }}>
                {loadingSummary && paymentsSummary.length === 0 ? (
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

                    <Box sx={{ mt: 3 }}>
                      <EarningsChart data={chartData} title="Ganancias por Ruta" />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                      <Typography variant="h6">Total del día: <strong>{parseFloat(summaryTotal).toFixed(2)} Bs</strong></Typography>
                    </Box>
                  </>
                )}
              </Box>

              {loadingSummary && paymentsSummary.length > 0 && (
                <Box sx={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.6)'
                }}>
                  <CircularProgress />
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default DriverDashboard;