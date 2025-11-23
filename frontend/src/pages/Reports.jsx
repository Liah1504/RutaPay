import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Box, Tabs, Tab, Paper, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Button, Stack, TextField
} from '@mui/material';
import Header from '../components/Header';
import { adminAPI, driverAPI } from '../services/api';
import { useTheme } from '@mui/material/styles';

const formatCurrency = (amount) => {
  const num = Number(amount || 0);
  if (!Number.isFinite(num)) return 'Bs 0,00';
  return `Bs ${num.toFixed(2).replace('.', ',')}`;
};

const toYMD = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Format display date as DD/MM/YYYY (handles ISO strings or Date objects)
const formatDisplayDate = (value) => {
  if (!value) return '';
  let dt;
  if (value instanceof Date) {
    dt = value;
  } else {
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) dt = new Date(parsed);
    else {
      const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) dt = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
      else return String(value);
    }
  }
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDateValue = (v) => {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  const p = Date.parse(v);
  if (!isNaN(p)) return p;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  return 0;
};

const sortByDateDesc = (items = []) => {
  return items.slice().sort((a, b) => parseDateValue(b.date ?? b.period ?? b.label) - parseDateValue(a.date ?? a.period ?? a.label));
};

const buildCSV = (title, total, items = [], cols = ['Fecha', 'Monto']) => {
  const header = [`"${title}"`, `"Total: ${total}"`];
  const rows = items.map(it => {
    const date = it.date ?? it.period ?? it.label ?? '';
    const amount = it.amount ?? it.total ?? it.value ?? 0;
    return [`"${date}"`, `${Number(amount)}`];
  });
  const parts = [];
  parts.push(header.join(','));
  parts.push('');
  parts.push(cols.join(','));
  rows.forEach(r => parts.push(r.join(',')));
  parts.push('');
  parts.push(`"TOTAL",${Number(total)}`);
  return parts.join('\n');
};

const downloadCSV = (filename, csvContent) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const Reports = () => {
  const theme = useTheme();

  const [tab, setTab] = useState(0); // 0=day,1=week,2=month
  const [loadingIncome, setLoadingIncome] = useState(false);
  const [incomeData, setIncomeData] = useState({ total: 0, items: [] });
  const [incomeMsg, setIncomeMsg] = useState('');

  const [driverStart, setDriverStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toYMD(d);
  });
  const [driverEnd, setDriverEnd] = useState(() => toYMD(new Date()));
  const [driverBalances, setDriverBalances] = useState([]);
  const [loadingDriverBalances, setLoadingDriverBalances] = useState(false);
  const [driverMsg, setDriverMsg] = useState('');

  const periodFromTab = (t) => (t === 0 ? 'day' : t === 1 ? 'week' : 'month');

  const fetchIncome = useCallback(async (period) => {
    setLoadingIncome(true);
    setIncomeMsg('');
    try {
      const res = await adminAPI.getRevenue(period);
      const payload = res?.data ?? res ?? { total: 0, items: [] };
      const items = payload.items ?? payload.data ?? payload.rows ?? [];
      // sort income items so today's entries (or latest) appear first
      const sorted = sortByDateDesc(items);
      setIncomeData({ total: Number(payload.total ?? 0), items: sorted });
      if (!items || items.length === 0) setIncomeMsg('No hay datos detallados para este periodo.');
    } catch (err) {
      console.error('Error fetching income report:', err);
      setIncomeData({ total: 0, items: [] });
      setIncomeMsg('Error al cargar el reporte de ingresos.');
    } finally {
      setLoadingIncome(false);
    }
  }, []);

  // Fetch driver balances (calls admin endpoint that groups by driver/day)
  const fetchDriverBalances = useCallback(async (start, end) => {
    setLoadingDriverBalances(true);
    setDriverMsg('');
    try {
      const params = { start, end };
      if (adminAPI.getDriverPaymentsSummary) {
        const res = await adminAPI.getDriverPaymentsSummary(params);
        const payload = res?.data ?? res ?? { items: [] };
        const items = payload.items ?? payload;
        const sorted = sortByDateDesc(items);
        setDriverBalances(sorted);
        if (!items || items.length === 0) setDriverMsg('No hay datos para el rango seleccionado.');
        setLoadingDriverBalances(false);
        return;
      }

      if (adminAPI.getDriverBalancesRange) {
        const res = await adminAPI.getDriverBalancesRange(start, end, null);
        const payload = res?.data ?? res ?? { items: [] };
        const items = payload.items ?? payload;
        const sorted = sortByDateDesc(items);
        setDriverBalances(sorted);
        if (!items || items.length === 0) setDriverMsg('No hay datos para el rango seleccionado.');
        setLoadingDriverBalances(false);
        return;
      }

      // Fallback to driverAPI per-day (best-effort)
      const s = new Date(start);
      const e = new Date(end);
      const days = [];
      for (let dt = new Date(s); dt <= e; dt.setDate(dt.getDate() + 1)) days.push(new Date(dt));
      const results = [];
      for (const d of days) {
        const dayYmd = toYMD(d);
        try {
          const summary = await driverAPI.getPaymentsSummary(dayYmd);
          const items = summary?.data ?? summary ?? [];
          results.push(...items.map(it => ({
            name: it.driver_name ?? it.name ?? it.driver ?? 'N/A',
            driver_code: it.driver_code ?? it.code ?? '',
            phone: it.driver_phone ?? it.phone ?? '',
            date: it.date ?? dayYmd,
            payments: it.count ?? it.payments ?? 1,
            total_received: Number(it.amount ?? it.total ?? 0)
          })));
        } catch (err) {
          console.warn('driver summary fetch error for', dayYmd, err);
        }
      }
      const sorted = sortByDateDesc(results);
      setDriverBalances(sorted);
      if (results.length === 0) setDriverMsg('No hay datos para el rango seleccionado (fallback).');
    } catch (err) {
      console.error('Error fetching driver balances:', err);
      setDriverBalances([]);
      setDriverMsg('Error al consultar balances por conductor.');
    } finally {
      setLoadingDriverBalances(false);
    }
  }, []);

  const handleExportIncome = () => {
    const period = periodFromTab(tab);
    const filename = `incomes_${period}_${toYMD(new Date())}.csv`;
    const csv = buildCSV(`Ingresos (${period.toUpperCase()})`, incomeData.total, incomeData.items, ['Fecha', 'Monto']);
    downloadCSV(filename, csv);
  };

  const handleExportDrivers = () => {
    const filename = `driver_balances_${driverStart}_${driverEnd}.csv`;
    const cols = ['Nombre', 'Código', 'Teléfono', 'Fecha', 'Pagos', 'Total recibido (Bs)'];
    const rows = driverBalances.map(d => [
      `"${d.name ?? ''}"`,
      `"${d.driver_code ?? d.code ?? ''}"`,
      `"${d.phone ?? ''}"`,
      `"${formatDisplayDate(d.date) ?? ''}"`,
      `${d.payments ?? 0}`,
      `${Number(d.total_received ?? 0)}`
    ]);
    const parts = [];
    parts.push(`"Balance Por Conductor"`);
    parts.push('');
    parts.push(cols.join(','));
    rows.forEach(r => parts.push(r.join(',')));
    downloadCSV(filename, parts.join('\n'));
  };

  useEffect(() => { const period = periodFromTab(tab); fetchIncome(period); }, [tab, fetchIncome]);

  const handleConsultarDrivers = async () => {
    setDriverMsg('');
    // Query all drivers in the selected range (now sorted newest-first)
    await fetchDriverBalances(driverStart, driverEnd);
  };

  return (
    <>
      <Header />
      <Container maxWidth="xl" sx={{ pt: 4, pb: 4 }}>
        <Typography variant="h4" gutterBottom>📊 Reportes de Ingresos</Typography>

        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.2, m: 0, color: 'text.primary' }}>
              Reporte de Recargas Recibidas
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ flex: '1 1 auto' }}>
              <Tab label="Diario" />
              <Tab label="Semanal" />
              <Tab label="Mensual" />
            </Tabs>

            <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
              <Button variant="contained" color="primary" onClick={handleExportIncome} disabled={!(incomeData.items && incomeData.items.length > 0)}>
                Exportar CSV
              </Button>
            </Stack>
          </Box>

          <Box sx={{ p: 2 }}>
            {loadingIncome ? (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
            ) : (
              <>
                <Typography variant="h6" sx={{ mb: 1 }}>Total: {formatCurrency(incomeData.total)}</Typography>
                {incomeMsg && <Typography color="text.secondary" sx={{ mb: 1 }}>{incomeMsg}</Typography>}
                {incomeData.items && incomeData.items.length > 0 && (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Fecha</TableCell>
                          <TableCell align="right">Monto (Bs)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {incomeData.items.map((it, idx) => (
                          <TableRow key={it.date ?? it.period ?? idx}>
                            <TableCell>{formatDisplayDate(it.date ?? it.period ?? it.label)}</TableCell>
                            <TableCell align="right">{formatCurrency(it.amount ?? it.total ?? 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Box>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.2, m: 0, color: 'text.primary' }}>
              Balance Por Conductor
            </Typography>

            <TextField
              label="Desde"
              type="date"
              size="small"
              variant="outlined"
              value={driverStart}
              onChange={(e) => setDriverStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
            <TextField
              label="Hasta"
              type="date"
              size="small"
              variant="outlined"
              value={driverEnd}
              onChange={(e) => setDriverEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />

            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button variant="outlined" onClick={handleConsultarDrivers} disabled={loadingDriverBalances}>
                {loadingDriverBalances ? <CircularProgress size={18} /> : 'CONSULTAR'}
              </Button>

              <Button variant="contained" color="primary" onClick={handleExportDrivers} disabled={!(driverBalances && driverBalances.length > 0)}>
                EXPORTAR CSV
              </Button>
            </Box>
          </Box>

          <Box>
            {loadingDriverBalances ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
            ) : driverMsg ? (
              <Typography color="text.secondary">{driverMsg}</Typography>
            ) : (
              <>
                { (driverBalances && driverBalances.length > 0) ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nombre</TableCell>
                          <TableCell>Código</TableCell>
                          <TableCell>Teléfono</TableCell>
                          <TableCell>Fecha</TableCell>
                          <TableCell align="right">Pagos</TableCell>
                          <TableCell align="right">Total recibido (Bs)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {driverBalances.map((d, i) => (
                          <TableRow key={i}>
                            <TableCell>{d.name}</TableCell>
                            <TableCell>{d.driver_code ?? d.code}</TableCell>
                            <TableCell>{d.phone}</TableCell>
                            <TableCell>{formatDisplayDate(d.date)}</TableCell>
                            <TableCell align="right">{d.payments ?? d.count ?? 0}</TableCell>
                            <TableCell align="right">{formatCurrency(d.total_received ?? d.amount ?? 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography color="text.secondary">No hay datos. Selecciona un rango y presiona "Consultar".</Typography>
                )}
              </>
            )}
          </Box>
        </Paper>
      </Container>
    </>
  );
};

export default Reports;