import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Paper, Typography, Box, Grid, CircularProgress, TableContainer, Table,
  TableHead, TableRow, TableCell, TableBody, Avatar, Chip, MenuItem,
  Select, InputLabel, FormControl, TextField, Alert, Snackbar, IconButton, Badge
} from '@mui/material';
import { Groups, MonetizationOn, TrendingUp } from '@mui/icons-material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { driverAPI } from '../services/api';

const DriverDashboard = () => {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [routeName, setRouteName] = useState('');
  const [historyPayments, setHistoryPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [todaySummary, setTodaySummary] = useState({ passengers: 0, recaudado: 0, ganancias: 0 });
  const [loadingTodaySummary, setLoadingTodaySummary] = useState(true);
  const [graphData, setGraphData] = useState([]);
  const [selectedDay, setSelectedDay] = useState('hoy');
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [filterName, setFilterName] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifSnack, setShowNotifSnack] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  const lastNotifIdRef = useRef(null);

  function getLastDays() {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const label = dt.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
      days.push({ value: dt.toISOString().slice(0, 10), label });
    }
    return days;
  }
  const lastDays = getLastDays();
  const todayString = new Date().toISOString().slice(0,10);

  const getDateForSelectedDay = (sel) => (sel === 'hoy' ? todayString : sel);

  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      try {
        const [profileRes, paymentsRes, summaryRes, notifRes] = await Promise.all([
          driverAPI.getProfile().catch(() => ({ data: null })),
          driverAPI.getPayments().catch(() => ({ data: [] })),
          driverAPI.getPaymentsSummary(todayString).catch(() => ({ data: { totals: [], total: 0, passengers_count: 0 } })),
          driverAPI.getNotifications(5).catch(() => ({ data: [] }))
        ]);

        if (!mounted) return;

        setProfile(profileRes.data || null);
        setRouteName((profileRes.data && (profileRes.data.route_name || '')) || '');

        const pagos = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
        setHistoryPayments(pagos);
        setLoadingPayments(false);

        const summaryToday = summaryRes.data || {};
        setTodaySummary({
          passengers: summaryToday.passengers_count || 0,
          recaudado: summaryToday.total || 0,
          ganancias: summaryToday.total || 0
        });
        setLoadingTodaySummary(false);

        const dateForGraph = getDateForSelectedDay(selectedDay);
        try {
          const graphRes = await driverAPI.getPaymentsSummary(dateForGraph);
          const gd = Array.isArray(graphRes.data.totals) ? graphRes.data.totals : [];
          if (mounted) {
            setGraphData(gd);
            setLoadingGraph(false);
          }
        } catch (gErr) {
          console.error('Error cargando datos del gráfico:', gErr);
          if (mounted) {
            setGraphData([]);
            setLoadingGraph(false);
          }
        }

        const nots = Array.isArray(notifRes.data) ? notifRes.data : [];
        setNotifications(nots);

        if (nots.length > 0 && (!lastNotifIdRef.current || nots[0].id !== lastNotifIdRef.current)) {
          lastNotifIdRef.current = nots[0].id;
          setNotifMessage(`Nuevo pago recibido de ${nots[0].passenger_name} (${parseFloat(nots[0].amount).toFixed(2)} Bs)`);
          setShowNotifSnack(true);

          try {
            const [freshSummaryRes, freshPaymentsRes] = await Promise.all([
              driverAPI.getPaymentsSummary(todayString).catch(() => ({ data: { totals: [], total: 0, passengers_count: 0 } })),
              driverAPI.getPayments().catch(() => ({ data: [] }))
            ]);
            if (!mounted) return;

            const freshSummary = freshSummaryRes.data || {};
            setTodaySummary({
              passengers: freshSummary.passengers_count || 0,
              recaudado: freshSummary.total || 0,
              ganancias: freshSummary.total || 0
            });

            if (selectedDay === 'hoy') {
              setGraphData(Array.isArray(freshSummary.totals) ? freshSummary.totals : []);
            }

            const freshPayments = Array.isArray(freshPaymentsRes.data) ? freshPaymentsRes.data : [];
            setHistoryPayments(freshPayments);
            setLoadingPayments(false);
          } catch (refreshErr) {
            console.error('Error al refrescar datos tras notificación:', refreshErr);
          }
        }
      } catch (err) {
        console.error('Error fetching driver data:', err);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 8000);
    return () => { mounted = false; clearInterval(interval); };
    // eslint-disable-next-line
  }, [selectedDay, todayString]);

  const filteredPayments = filterName.trim()
    ? historyPayments.filter(p => p.passenger_name && p.passenger_name.toLowerCase().includes(filterName.trim().toLowerCase()))
    : historyPayments;

  return (
    <>
      <Header />
      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton color="inherit">
              <Badge badgeContent={notifications.length > 0 ? notifications.length : 0} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <Typography variant="h5" sx={{ minWidth: 300 }}>
              {routeName || ''}
            </Typography>
          </Box>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" color="error.main">{new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</Typography>
            <Typography variant="caption">Hora actual</Typography>
          </Paper>
        </Box>

        <Snackbar open={showNotifSnack} autoHideDuration={4000} onClose={() => setShowNotifSnack(false)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <Alert severity="success" onClose={() => setShowNotifSnack(false)} sx={{ width: '100%' }}>{notifMessage}</Alert>
        </Snackbar>

        <Paper elevation={1} sx={{ bgcolor: '#0C2946', color: '#fff', p: 3, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Bienvenido, {user?.name || 'Conductor'}</Typography>
            <Box>
              Estado: <Chip label={profile?.is_available ? 'En ruta' : 'Fuera de servicio'} color={profile?.is_available ? 'success' : 'default'} size="small" />
            </Box>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">Placa: {profile?.vehicle_plate || '—'}</Typography>
              <Typography variant="body2">Vehículo: {profile?.vehicle_type || '—'}</Typography>
              <Typography variant="body2">Licencia: {profile?.license_number || '—'}</Typography>
              <Typography variant="body2">Código: {profile?.driver_code || '—'}</Typography>
            </Box>
          </Box>
          <Avatar src={user?.avatar} sx={{ width: 64, height: 64, border: '2px solid #fff' }} />
        </Paper>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ py: 2, px: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Groups sx={{ color: 'error.main', fontSize: 32 }} />
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  {loadingTodaySummary ? <CircularProgress size={20} /> : todaySummary.passengers}
                </Typography>
                <Typography variant="body2" color="text.secondary">Pasajeros hoy</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ py: 2, px: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
              <MonetizationOn sx={{ color: 'error.main', fontSize: 32 }} />
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  {loadingTodaySummary ? <CircularProgress size={20} /> : `${parseFloat(todaySummary.recaudado || 0).toFixed(2)} BS`}
                </Typography>
                <Typography variant="body2" color="text.secondary">Recaudado</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ py: 2, px: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
              <TrendingUp sx={{ color: 'error.main', fontSize: 32 }} />
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  {loadingTodaySummary ? <CircularProgress size={20} /> : `${parseFloat(todaySummary.ganancias || 0).toFixed(2)} BS`}
                </Typography>
                <Typography variant="body2" color="text.secondary">Ganancias (Hoy)</Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" color="primary" fontWeight={700} sx={{ mb: 2 }}>Estadísticas diarias</Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Día</InputLabel>
            <Select label="Día" value={selectedDay} onChange={(e) => { setLoadingGraph(true); setSelectedDay(e.target.value); }}>
              <MenuItem value="hoy">Hoy</MenuItem>
              {lastDays.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ height: 320, background: 'white', borderRadius: 2 }}>
            {loadingGraph ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="route_name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#fa4e48" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Box>

        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} color="primary" sx={{ mb: 2 }}>Historial de Pagos Recibidos</Typography>
          <TextField label="Filtrar por pasajero" variant="outlined" value={filterName} onChange={e => setFilterName(e.target.value)} sx={{ mb: 2, maxWidth: 300 }} />
          {loadingPayments ? <CircularProgress /> : (
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
                  {filteredPayments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.route_name}</TableCell>
                      <TableCell>{p.passenger_name}</TableCell>
                      <TableCell>{parseFloat(p.amount).toFixed(2)} Bs</TableCell>
                      <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Container>
    </>
  );
};

export default DriverDashboard;