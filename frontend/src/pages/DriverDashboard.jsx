import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Box, Grid, CircularProgress, TableContainer, Table,
  TableHead, TableRow, TableCell, TableBody, Avatar, Chip, MenuItem,
  Select, InputLabel, FormControl, TextField, Alert, Snackbar
} from '@mui/material';
import { Groups, MonetizationOn, TrendingUp } from '@mui/icons-material';
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
  const [prevLength, setPrevLength] = useState(0);
  const [showPaymentNotif, setShowPaymentNotif] = useState(false);

  // Tarjetas superiores hoy
  const [todaySummary, setTodaySummary] = useState({
    passengers: 0, recaudado: 0, ganancias: 0,
  });
  const [loadingTodaySummary, setLoadingTodaySummary] = useState(true);

  // Gráfica/filtro por día
  const [graphData, setGraphData] = useState([]);
  const [selectedDay, setSelectedDay] = useState('hoy');
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [graphFirstLoad, setGraphFirstLoad] = useState(true);

  // Filtro por pasajero
  const [filterName, setFilterName] = useState('');

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

  // Polling refrescos
  useEffect(() => {
    let isMounted = true;
    const fetchEverything = async () => {
      try {
        const profileRes = await driverAPI.getProfile();
        if (isMounted) {
          setProfile(profileRes.data || null);
          setRouteName(profileRes.data?.route_name || "");
        }
      } catch {
        if (isMounted) {
          setProfile(null);
          setRouteName("");
        }
      }
      try {
        const paymentsRes = await driverAPI.getPayments();
        const pagos = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
        if (isMounted) {
          setLoadingPayments(false);
          if (pagos.length > prevLength && prevLength !== 0) {
            setShowPaymentNotif(true);
            setTimeout(() => setShowPaymentNotif(false), 3500);
          }
          setPrevLength(pagos.length);
          setHistoryPayments(pagos);
        }
      } catch { if (isMounted) setLoadingPayments(false); }
      try {
        const summaryRes = await driverAPI.getPaymentsSummary(todayString);
        const pasajeros = Array.isArray(summaryRes.data.totals)
          ? summaryRes.data.totals.filter(item => parseFloat(item.total) > 0).length
          : 0;
        if (isMounted) {
          setTodaySummary({
            passengers: pasajeros,
            recaudado: parseFloat(summaryRes.data.total) || 0,
            ganancias: parseFloat(summaryRes.data.total) || 0
          });
          setLoadingTodaySummary(false);
        }
      } catch { if (isMounted) setLoadingTodaySummary(false); }
      try {
        const date = selectedDay === "hoy" ? todayString : selectedDay;
        const graphRes = await driverAPI.getPaymentsSummary(date);
        if (isMounted) {
          if (Array.isArray(graphRes.data.totals)) setGraphData(graphRes.data.totals);
          else if (Array.isArray(graphRes.data)) setGraphData(graphRes.data);
          else setGraphData([]);
          setLoadingGraph(false);
          setGraphFirstLoad(false);
        }
      } catch { if (isMounted) setLoadingGraph(false); }
    };

    fetchEverything();
    const interval = setInterval(fetchEverything, 10000);
    return () => { isMounted = false; clearInterval(interval); };
    // eslint-disable-next-line
  }, [selectedDay]);

  // Filtro por nombre pasajero
  const filteredPayments = filterName.trim()
    ? historyPayments.filter(
        p =>
          p.passenger_name &&
          p.passenger_name.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : historyPayments;

  return (
    <>
      <Header />
      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        <Snackbar
          open={showPaymentNotif}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          autoHideDuration={3500}
          onClose={() => setShowPaymentNotif(false)}
        >
          <Alert severity="success" variant="filled" sx={{ fontSize: 16 }}>
            ¡Nuevo pago recibido!
          </Alert>
        </Snackbar>

        {/* Cabecera principal */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 3, justifyContent: 'space-between' }}>
          <Paper elevation={2} sx={{ p: 3, flex: 1, minWidth: 270 }}>
            <Typography variant="h5" fontWeight={700}>
              {routeName}
            </Typography>
          </Paper>
          <Paper elevation={2} sx={{
            p: 3, flex: 1, maxWidth: 250, bgcolor: 'white', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <Typography align="center" variant="h4" color="error.main" fontWeight={700}>
              {new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
            <Typography variant="caption">Hora actual</Typography>
          </Paper>
        </Box>

        <Paper elevation={1} sx={{ bgcolor: '#0C2946', color: '#fff', p: 3, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Bienvenido, {user?.name || 'Conductor'}
            </Typography>
            <Box>
              Estado: <Chip label="En ruta" color="success" size="small" />
            </Box>
          </Box>
          <Avatar src={user?.avatar} sx={{ width: 64, height: 64, border: '2px solid #fff' }} />
        </Paper>

        {/* Tarjetas estadísticas DINÁMICAS Y REACTIVAS */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ py: 2, px: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Groups sx={{ color: 'error.main', fontSize: 32 }} />
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  {loadingTodaySummary ? <CircularProgress size={24} /> : todaySummary.passengers}
                </Typography>
                <Typography variant="body2" color="text.secondary">Pasajeros hoy</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ py: 2, px: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
              <MonetizationOn sx={{ color: 'error.main', fontSize: 32 }} />
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  {loadingTodaySummary ? <CircularProgress size={24} /> : `${todaySummary.recaudado} BS`}
                </Typography>
                <Typography variant="body2" color="text.secondary">Recaudado</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ py: 2, px: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
              <TrendingUp sx={{ color: 'error.main', fontSize: 32 }} />
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  {loadingTodaySummary ? <CircularProgress size={24} /> : `${todaySummary.ganancias} BS`}
                </Typography>
                <Typography variant="body2" color="text.secondary">Ganancias (Hoy)</Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
        
        {/* Estadísticas diarias - ocupa TODO el ancho */}
        <Box sx={{ mb: 7 }}>
          <Typography variant="h6" color="primary" fontWeight={700} sx={{ mb: 2 }}>Estadísticas diarias</Typography>
          <Grid container spacing={0}>
            <Grid item xs={12}>
              <Box sx={{ maxWidth: '100vw', mb: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Día</InputLabel>
                  <Select
                    label="Día"
                    value={selectedDay}
                    onChange={e => {
                      setLoadingGraph(true);
                      setSelectedDay(e.target.value);
                    }}
                  >
                    <MenuItem value="hoy">Hoy</MenuItem>
                    {lastDays.map((d) => (
                      <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ height: 260, background: 'white', borderRadius: 2, width: "100%" }}>
                {loadingGraph && graphFirstLoad ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={Array.isArray(graphData) ? graphData : []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="route_name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="total" stroke="#fa4e48" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Historial de pagos recibidos con filtro por nombre */}
        <Paper elevation={1} sx={{ mt: 2, p: 3 }}>
          <Typography variant="h6" fontWeight={700} color="primary" sx={{ mb: 2 }}>Historial de Pagos Recibidos</Typography>
          <TextField
            label="Filtrar por pasajero"
            variant="outlined"
            fullWidth
            sx={{ mb: 2, maxWidth: 280 }}
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
          />
          {loadingPayments ? (
            <CircularProgress />
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
                  {filteredPayments.map((p) => (
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