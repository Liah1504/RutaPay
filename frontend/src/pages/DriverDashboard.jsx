import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Paper, Typography, Box, Grid, CircularProgress, Avatar, Chip, Alert,
  List, ListItem, ListItemText, Divider, Stack, IconButton
} from '@mui/material';
import { MonetizationOn, FileDownload } from '@mui/icons-material';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { driverAPI, adminAPI } from '../services/api';

/* Inline fallback avatar */
const DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 24 24'>
     <rect width='100%' height='100%' fill='#eef3f5' rx='6'/>
     <g transform='translate(3,2)' fill='#3a4850'>
       <circle cx='9' cy='6' r='4'/>
       <path d='M0 18c0-3.3 6.9-5 9-5s9 1.7 9 5v1H0v-1z'/>
     </g>
  </svg>`
)}`;

/* Helpers */
const formatCurrency = (v) => {
  const n = Number(v || 0);
  return `${n.toFixed(2)} BS`;
};

/* Palette for pie slices */
const PIE_COLORS = ['#1976d2', '#ef5350', '#ffa726', '#66bb6a', '#ab47bc', '#29b6f6', '#8d6e63', '#ff7043'];

export default function DriverDashboard() {
  const { user } = useAuth();
  const location = useLocation();

  const [profile, setProfile] = useState(null);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [summary, setSummary] = useState({ passengers: 0, total: 0 });

  const [loadingGraph, setLoadingGraph] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [filterName, setFilterName] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  // pagination state (for the separate payments page)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const mountedRef = useRef(false);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const getLocalISODate = (d = new Date()) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // load once on mount or when user.id changes
  useEffect(() => {
    const loadOnce = async () => {
      if (!mountedRef.current) return;
      setLoadingGraph(true);
      setLoadingPayments(true);
      setLoadingSummary(true);
      setErrorMsg(null);

      try {
        const date = getLocalISODate();

        // profile + payments
        const [profileRes, paymentsRes] = await Promise.all([
          driverAPI.getProfile().catch(err => ({ error: err })),
          driverAPI.getPayments().catch(err => ({ error: err, data: [] }))
        ]);

        if (!mountedRef.current) return;

        if (profileRes && profileRes.data && !profileRes.error) setProfile(profileRes.data);
        else setProfile(null);

        const pagos = Array.isArray(paymentsRes?.data) ? paymentsRes.data : [];
        setHistoryPayments(pagos);
        setLoadingPayments(false);

        // summary (driver endpoint preferred, fallback admin on 404)
        let summaryRes;
        try {
          summaryRes = await driverAPI.getPaymentsSummary({ date, period: 'day' });
        } catch (err) {
          const status = err?.response?.status;
          if (status === 404) {
            summaryRes = await adminAPI.getDriverPaymentsSummary({ date, period: 'day' }).catch(e => { throw e; });
          } else {
            throw err;
          }
        }

        if (!mountedRef.current) return;

        const rawSummary = summaryRes?.data ?? {};
        const summaryBody = (rawSummary && typeof rawSummary === 'object' && rawSummary.data) ? rawSummary.data : rawSummary;

        const passengers_count = Number(summaryBody.passengers_count ?? summaryBody.passengers ?? summaryBody.passenger_count ?? 0) || 0;
        const total_amount = parseFloat(summaryBody.total ?? summaryBody.total_amount ?? summaryBody.amount ?? 0) || 0;
        setSummary({ passengers: passengers_count, total: total_amount });
        setLoadingSummary(false);

        // Normalize and aggregate totals by route_name
        let rawTotals = [];
        if (Array.isArray(summaryBody.totals)) rawTotals = summaryBody.totals;
        else if (Array.isArray(rawSummary?.totals)) rawTotals = rawSummary.totals;
        else if (Array.isArray(rawSummary?.data)) rawTotals = rawSummary.data;
        else if (Array.isArray(summaryRes?.data)) rawTotals = summaryRes.data;
        else rawTotals = [];

        const map = new Map();
        rawTotals.forEach(item => {
          const name = item.route_name || item.name || (item.route && item.route.name) || `Ruta ${item.route_id ?? item.id ?? ''}`;
          const val = Number(item.total ?? item.amount ?? item.value) || 0;
          map.set(name, (map.get(name) || 0) + val);
        });

        const aggregated = Array.from(map.entries()).map(([route_name, total]) => ({ route_name, total }));
        const visuallyOrdered = aggregated.sort((a, b) => b.total - a.total);

        setGraphData(visuallyOrdered);
        setLoadingGraph(false);
      } catch (err) {
        console.error('DriverDashboard load error:', err);
        const status = err?.response?.status;
        if (status === 401 || status === 403) setErrorMsg('No autorizado para ver resúmenes. Revisa tu sesión/permisos.');
        else setErrorMsg('No se pudieron cargar los datos del dashboard.');

        // best-effort payments
        try {
          const paymentsOnly = await driverAPI.getPayments().catch(() => ({ data: [] }));
          if (mountedRef.current) setHistoryPayments(Array.isArray(paymentsOnly?.data) ? paymentsOnly.data : []);
        } catch (e) {
          console.warn('payments fetch after error failed', e);
        }

        setGraphData([]);
        setSummary({ passengers: 0, total: 0 });
        setLoadingGraph(false);
        setLoadingPayments(false);
        setLoadingSummary(false);
      }
    };

    loadOnce();
  }, [user?.id]);

  // filtered payments for export/table
  const filteredPayments = filterName.trim()
    ? historyPayments.filter(p => (p.passenger_name || p.user_name || '').toLowerCase().includes(filterName.trim().toLowerCase()))
    : historyPayments;
  const paymentsPage = filteredPayments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // pie data: top N + Otros
  const preparePieData = (data, topN = 6) => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const top = data.slice(0, topN);
    const rest = data.slice(topN);
    const othersSum = rest.reduce((s, r) => s + Number(r.total || 0), 0);
    const pie = top.map(d => ({ name: d.route_name, value: Number(d.total || 0) }));
    if (othersSum > 0) pie.push({ name: 'Otros', value: othersSum });
    return pie;
  };
  const pieData = preparePieData(graphData, 6);
  const totalForPie = pieData.reduce((s, r) => s + (Number(r.value) || 0), 0);

  // export CSV
  const exportCSV = async () => {
    try {
      const res = await driverAPI.getPayments();
      const rows = Array.isArray(res?.data) ? res.data : [];
      const headers = ['Ruta', 'Pasajero', 'Monto (Bs)', 'Fecha'];
      const csvRows = [headers.join(',')];
      rows.forEach(r => {
        const ruta = `"${(r?.route_name || r?.route?.name || '').replace(/"/g, '""')}"`;
        const pas = `"${(r?.passenger_name || r?.user_name || '').replace(/"/g, '""')}"`;
        const monto = parseFloat(r?.amount ?? r?.monto ?? 0).toFixed(2);
        const fecha = `"${(r?.created_at ? new Date(r.created_at).toLocaleString() : '')}"`;
        csvRows.push([ruta, pas, monto, fecha].join(','));
      });
      const csv = csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeUser = (user?.name || 'conductor').replace(/\s+/g, '_').toLowerCase();
      // use fixed suffix to avoid undefined variable
      a.download = `pagos_${safeUser}_day.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('Error exportando CSV', err);
    }
  };

  const resolvedAvatar = (user?.avatar && String(user.avatar).trim()) ||
    (profile?.avatar && String(profile.avatar).trim()) ||
    DEFAULT_AVATAR;

  const topRoutes = graphData.slice(0, 5);
  const periodLabel = 'Hoy';
  const hideBottomHistory = location?.pathname === '/driver';

  // Render: no slice labels around chart (legend only)
  return (
    <>
      <Header />

      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        {errorMsg && <Alert severity="warning" sx={{ mb: 2 }}>{errorMsg}</Alert>}

        <Paper elevation={1} sx={{ bgcolor: '#0C2946', color: '#fff', p: 3, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Bienvenido, {profile?.name || user?.name || 'Conductor'}</Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                Estado:&nbsp;
                <Chip label={profile?.is_available ? 'En ruta' : 'Fuera de servicio'} color={profile?.is_available ? 'success' : 'default'} size="small" />
              </Typography>
            </Box>
          </Box>

          <Avatar
            src={resolvedAvatar}
            alt={profile?.name || user?.name || 'Conductor'}
            imgProps={{ onError: (e) => { try { if (e && e.currentTarget) e.currentTarget.src = DEFAULT_AVATAR; } catch {} } }}
            sx={{ width: 64, height: 64, border: '2px solid #fff' }}
          />
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#f5f6f7' }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6">Distribución por Ruta</Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 320 }}>
                <Box sx={{ flex: 1, minWidth: 320, height: 320 }}>
                  {loadingGraph ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    pieData.length === 0 ? (
                      <Typography color="text.secondary">No hay datos para mostrar</Typography>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={70}
                            outerRadius={120}
                            paddingAngle={4}
                            // labels removed to keep chart clean (legend shows names)
                            label={null}
                            labelLine={false}
                            isAnimationActive={false}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>

                          <Tooltip formatter={(value, name) => [`Bs ${Number(value).toFixed(2)}`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    )
                  )}
                </Box>

                <Box sx={{ width: 240, p: 1 }}>
                  <Paper sx={{ bgcolor: '#fff', p: 1.25, borderRadius: 1, boxShadow: 0 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontSize: 13 }}>Leyenda</Typography>
                    <List dense sx={{ p: 0 }}>
                      {pieData.map((d, i) => {
                        const percent = totalForPie ? (Number(d.value) / totalForPie) * 100 : 0;
                        return (
                          <ListItem key={d.name} sx={{ py: 0.6, alignItems: 'flex-start' }}>
                            <Box sx={{ width: 10, height: 10, bgcolor: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 1, mr: 1, mt: 0.8 }} />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ fontSize: 11, lineHeight: '1.05' }}>{d.name}</Typography>
                              <Typography variant="caption" sx={{ display: 'block', fontSize: 10, color: 'text.secondary', mt: 0.3 }}>{`${formatCurrency(d.value)} • ${percent.toFixed(0)}%`}</Typography>
                            </Box>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Paper>
                </Box>
              </Box>
            </Paper>

            {!hideBottomHistory && (
              <Paper elevation={1} sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" fontWeight={700} color="primary">Historial de Pagos Recibidos</Typography>
                  <Box>
                    <Box component="span" sx={{ mr: 1 }}>
                      <input
                        placeholder="Filtrar por pasajero"
                        value={filterName}
                        onChange={(e) => { setFilterName(e.target.value); setPage(0); }}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d0d7da' }}
                      />
                    </Box>
                    <IconButton size="small" onClick={() => exportCSV(true)} title="Exportar CSV"><FileDownload /></IconButton>
                  </Box>
                </Box>

                <Box>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                        <th style={{ padding: '10px 8px' }}>Ruta</th>
                        <th style={{ padding: '10px 8px' }}>Pasajero</th>
                        <th style={{ padding: '10px 8px' }}>Monto (Bs)</th>
                        <th style={{ padding: '10px 8px' }}>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsPage.map(p => (
                        <tr key={p?.id ?? `${p?.passenger_name}-${p?.created_at ?? Math.random()}`} style={{ borderBottom: '1px solid #f4f6f7' }}>
                          <td style={{ padding: '10px 8px' }}>{p?.route_name || p?.route?.name || '-'}</td>
                          <td style={{ padding: '10px 8px' }}>{p?.passenger_name || p?.user_name || '-'}</td>
                          <td style={{ padding: '10px 8px' }}>{(parseFloat(p?.amount ?? p?.monto ?? 0) || 0).toFixed(2)} Bs</td>
                          <td style={{ padding: '10px 8px' }}>{p?.created_at ? new Date(p.created_at).toLocaleString() : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </Paper>
            )}
          </Grid>

          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" color="text.secondary">Total recaudado</Typography>
                  <IconButton size="small" onClick={() => exportCSV(true)} title="Exportar historial CSV"><FileDownload /></IconButton>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                  <Avatar sx={{ bgcolor: 'transparent' }}><MonetizationOn color="error" /></Avatar>
                  <Box>
                    <Typography variant="h5">{loadingSummary ? <CircularProgress size={18} /> : formatCurrency(summary.total)}</Typography>
                    <Typography variant="body2" color="text.secondary">{periodLabel}</Typography>
                    <Typography variant="caption" color="text.secondary">{totalForPie ? `Total mostrado: ${formatCurrency(totalForPie)}` : ''}</Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2">Pasajeros</Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>{loadingSummary ? <CircularProgress size={18} /> : summary.passengers}</Typography>
              </Paper>

              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Top rutas</Typography>
                <List dense>
                  {topRoutes.length === 0 && <ListItem><ListItemText primary="No hay datos" /></ListItem>}
                  {topRoutes.map((r, idx) => (
                    <ListItem key={`${r.route_name}-${idx}`} secondaryAction={<Typography variant="body2" color="text.secondary">{formatCurrency(r.total)}</Typography>}>
                      <ListItemText primary={r.route_name} />
                    </ListItem>
                  ))}
                </List>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">Valores según periodo por defecto.</Typography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}