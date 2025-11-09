import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Paper, Typography, Box, Grid, CircularProgress, TableContainer, Table,
  TableHead, TableRow, TableCell, TableBody, Avatar, Chip, TextField, Alert, Snackbar
} from '@mui/material';
import { Groups, MonetizationOn, TrendingUp } from '@mui/icons-material';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { driverAPI } from '../services/api';

/**
 * DriverDashboard — visual-only fixes for chart labels and avatar fallback.
 * Works with the AuthContext you provided (it expects useAuth() -> { user, ... }).
 *
 * - Wrapped X axis ticks (1-2 lines) with larger font so long route names read well.
 * - Increased chart container height and reduced bottom whitespace.
 * - Area fill to remove "big white hole" under the line.
 * - Forcing ResponsiveContainer remount when data arrives (chartKey) + small window.resize.
 * - Avatar resolution: prefer user.avatar then profile.avatar then inline DEFAULT_AVATAR.
 */

// Inline SVG fallback avatar (no external files)
const DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 24 24'>
     <rect width='100%' height='100%' fill='#eef3f5' rx='6'/>
     <g transform='translate(3,2)' fill='#3a4850'>
       <circle cx='9' cy='6' r='4'/>
       <path d='M0 18c0-3.3 6.9-5 9-5s9 1.7 9 5v1H0v-1z'/>
     </g>
  </svg>`
)}`;

const wrapLabel = (text = '', maxLen = 32) => {
  const t = String(text || '');
  if (t.length <= maxLen) return [t, null];
  const before = t.slice(0, maxLen).trim();
  const rest = t.slice(maxLen).trim();
  const idx = rest.indexOf(' ');
  if (idx > 0 && idx < 18) {
    const add = rest.slice(0, idx);
    const first = `${before} ${add}`.trim();
    const second = rest.slice(idx + 1).trim();
    return [first, second || null];
  }
  const second = rest.length > maxLen ? `${rest.slice(0, maxLen - 3)}...` : rest;
  return [before, second || null];
};

const WrappedTick = ({ x, y, payload, maxLen = 32 }) => {
  const value = payload?.value ?? '';
  if (!value) return null;
  const [first, second] = wrapLabel(value, maxLen);
  return (
    <g transform={`translate(${x},${y + 12})`}>
      <text x={0} y={0} textAnchor="middle" fill="#666" style={{ fontSize: 13 }}>
        <tspan x={0} dy="0">{first}</tspan>
        {second ? <tspan x={0} dy="16" style={{ fontSize: 12 }}>{second}</tspan> : null}
      </text>
    </g>
  );
};

const niceMax = (value) => {
  if (!value || value <= 10) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  if (n <= 2) return 2 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
};

export default function DriverDashboard() {
  const { user } = useAuth(); // uses your AuthContext

  const [profile, setProfile] = useState(null);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [todaySummary, setTodaySummary] = useState({ passengers: 0, total: 0 });
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingTodaySummary, setLoadingTodaySummary] = useState(true);
  const [filterName, setFilterName] = useState('');
  const [showNotifSnack, setShowNotifSnack] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  const lastNotifIdRef = useRef(null);

  // force remount of ResponsiveContainer so Recharts recalculates dims
  const [chartKey, setChartKey] = useState(0);

  const getLocalISODate = (d = new Date()) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      setLoadingGraph(true);
      setLoadingPayments(true);
      setLoadingTodaySummary(true);

      try {
        const date = getLocalISODate();
        const [profileRes, paymentsRes, summaryRes, notifRes] = await Promise.all([
          driverAPI.getProfile().catch(() => ({ data: null })),
          driverAPI.getPayments().catch(() => ({ data: [] })),
          driverAPI.getPaymentsSummary(date).catch(() => ({ data: { totals: [], total: 0, passengers_count: 0 } })),
          (user && user.role === 'driver') ? driverAPI.getNotifications(6).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
        ]);

        if (!mounted) return;

        setProfile(profileRes?.data ?? null);

        const pagos = Array.isArray(paymentsRes?.data) ? paymentsRes.data : [];
        setHistoryPayments(pagos);
        setLoadingPayments(false);

        const rawSummary = summaryRes?.data ?? {};
        const summaryBody = rawSummary?.data && typeof rawSummary.data === 'object' ? rawSummary.data : rawSummary;
        const passengers_count = Number(summaryBody.passengers_count ?? summaryBody.passengers) || 0;
        const total_today = parseFloat(summaryBody.total ?? summaryBody.total_amount) || 0;
        setTodaySummary({ passengers: passengers_count, total: total_today });
        setLoadingTodaySummary(false);

        // normalize totals from various shapes
        let rawTotals = [];
        if (Array.isArray(summaryRes?.data?.totals)) rawTotals = summaryRes.data.totals;
        else if (Array.isArray(summaryRes?.data)) rawTotals = summaryRes.data;
        else if (Array.isArray(summaryRes?.totals)) rawTotals = summaryRes.totals;
        else rawTotals = [];

        const normalized = rawTotals.map(item => ({
          route_name: item.route_name || item.name || (item.route && item.route.name) || `Ruta ${item.route_id ?? item.id ?? ''}`,
          total: Number(item.total ?? item.amount ?? item.value) || 0,
        }));

        // Visual-only sorting: place larger totals first (left) for easier reading
        const visuallyOrdered = [...normalized].sort((a, b) => b.total - a.total);

        setGraphData(visuallyOrdered);
        setChartKey(k => k + 1);
        setLoadingGraph(false);

        const nots = Array.isArray(notifRes?.data) ? notifRes.data : [];
        if (nots.length > 0 && (!lastNotifIdRef.current || nots[0].id !== lastNotifIdRef.current)) {
          lastNotifIdRef.current = nots[0].id;
          setNotifMessage(`Nuevo pago: ${nots[0].passenger_name || 'usuario'} - Bs ${parseFloat(nots[0].amount || 0).toFixed(2)}`);
          setShowNotifSnack(true);
        }

        // small delayed resize so Recharts picks up the final size
        setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch {} }, 80);
      } catch (err) {
        console.error('DriverDashboard fetch error:', err);
        setGraphData([]);
        setHistoryPayments([]);
        setTodaySummary({ passengers: 0, total: 0 });
        setLoadingGraph(false);
        setLoadingPayments(false);
        setLoadingTodaySummary(false);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [user?.id]);

  const filteredPayments = filterName.trim()
    ? historyPayments.filter(p => p.passenger_name && p.passenger_name.toLowerCase().includes(filterName.trim().toLowerCase()))
    : historyPayments;

  const yMax = graphData.length ? Math.max(...graphData.map(d => Number(d.total || 0))) : 0;
  const domainMax = niceMax(yMax);

  // avatar: prefer user.avatar (from AuthContext) then profile.avatar then fallback
  const resolvedAvatar = (user?.avatar && String(user.avatar).trim()) ||
                         (profile?.avatar && String(profile.avatar).trim()) ||
                         DEFAULT_AVATAR;

  return (
    <>
      <Header />

      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        <Snackbar open={showNotifSnack} autoHideDuration={3500} onClose={() => setShowNotifSnack(false)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <Alert severity="success">{notifMessage}</Alert>
        </Snackbar>

        <Paper elevation={1} sx={{ bgcolor: '#0C2946', color: '#fff', p: 3, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Bienvenido, {profile?.name || user?.name || 'Conductor'}</Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">Estado: <Chip label={profile?.is_available ? 'En ruta' : 'Fuera de servicio'} color={profile?.is_available ? 'success' : 'default'} size="small" /></Typography>
            </Box>
          </Box>

          <Avatar
            src={resolvedAvatar}
            alt={profile?.name || user?.name || 'Conductor'}
            imgProps={{
              onError: (e) => { try { if (e && e.currentTarget) { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_AVATAR; } } catch {} },
              crossOrigin: 'anonymous',
              style: { objectFit: 'cover' }
            }}
            sx={{ width: 64, height: 64, border: '2px solid #fff' }}
          />
        </Paper>

        {/* Chart */}
        <Box sx={{ height: 420, minHeight: 320, background: 'white', borderRadius: 2, p: 2, mb: 3, overflow: 'visible' }}>
          {loadingGraph ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : (
            <ResponsiveContainer key={chartKey} width="100%" height="100%">
              <LineChart data={graphData} margin={{ top: 8, right: 18, left: 36, bottom: 64 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fa4e48" stopOpacity={0.12}/>
                    <stop offset="100%" stopColor="#fa4e48" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="route_name"
                  interval={0}
                  height={92}
                  tick={<WrappedTick maxLen={36} />}
                  tickLine={false}
                  axisLine={{ stroke: '#e0e0e0' }}
                  padding={{ left: 16, right: 16 }}
                />
                <YAxis allowDecimals={false} domain={[0, domainMax]} width={56} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value, name, props) => [`Bs ${Number(value).toFixed(2)}`, props && props.payload ? props.payload.route_name : 'Recaudado']} />
                <Area type="monotone" dataKey="total" stroke="none" fill="url(#areaGrad)" />
                <Line type="monotone" dataKey="total" stroke="#fa4e48" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>

        {/* cards */}
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
                  {loadingTodaySummary ? <CircularProgress size={20} /> : `${parseFloat(todaySummary.total || 0).toFixed(2)} BS`}
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
                  {loadingTodaySummary ? <CircularProgress size={20} /> : `${parseFloat(todaySummary.total || 0).toFixed(2)} BS`}
                </Typography>
                <Typography variant="body2" color="text.secondary">Ganancias (Hoy)</Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} color="primary" sx={{ mb: 2 }}>Historial de Pagos Recibidos</Typography>
          <TextField label="Filtrar por pasajero" variant="outlined" value={filterName} onChange={e => setFilterName(e.target.value)} sx={{ mb: 2, maxWidth: 360 }} />
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
                    <TableRow key={p.id || `${p.passenger_name}-${p.created_at || Math.random()}`}>
                      <TableCell>{p.route_name}</TableCell>
                      <TableCell>{p.passenger_name}</TableCell>
                      <TableCell>{parseFloat(p.amount || 0).toFixed(2)} Bs</TableCell>
                      <TableCell>{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</TableCell>
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
}