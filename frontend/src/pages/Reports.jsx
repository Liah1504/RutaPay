import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Box, Tabs, Tab, Paper, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Button, Stack
} from '@mui/material';
import Header from '../components/Header';
import DriverDailyBalances from '../components/DriverDailyBalances';
import { adminAPI } from '../services/api';

/**
 * Reports page
 * - Pestañas: Diario / Semanal / Mensual
 * - Llama adminAPI.getRevenue(period) y si viene vacío intenta adminAPI.getRevenueRange(start,end)
 * - Botón "Exportar CSV" para descargar el desglose (si hay items) o al menos el total
 */

const formatCurrency = (amount) => {
  const num = Number(amount || 0);
  if (!Number.isFinite(num)) return 'Bs 0,00';
  return `Bs ${num.toFixed(2).replace('.', ',')}`;
};

const formatDateLabel = (raw) => {
  if (!raw) return '';
  // raw puede ser Date, ISO string, or pg timestamp object - tratamos de normalizar
  try {
    const d = (raw instanceof Date) ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString(); // formato local con fecha y hora
  } catch {
    return String(raw);
  }
};

const toYMD = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getRangeForPeriod = (period) => {
  const today = new Date();
  if (period === 'day') {
    const s = toYMD(today);
    return { start: s, end: s };
  }
  if (period === 'week') {
    const first = new Date(today);
    const day = first.getDay(); // 0..6 (Sun..Sat)
    const diff = (day + 6) % 7; // convert so week starts Monday
    first.setDate(first.getDate() - diff);
    return { start: toYMD(first), end: toYMD(today) };
  }
  // month
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  return { start: toYMD(firstDay), end: toYMD(today) };
};

const buildCSV = (periodLabel, total, items = []) => {
  // Header info
  const header = [`"Reporte de ingresos: ${periodLabel}"`, `"Total: ${total}"`];
  // Columns: Fecha, Monto
  const cols = ['Fecha', 'Monto'];
  const rows = items.map(it => {
    const date = it.date ?? it.period ?? it.label ?? '';
    const amount = it.amount ?? it.total ?? it.value ?? 0;
    // ensure decimal point as dot for CSV numeric (we keep raw)
    return [`"${date}"`, `${Number(amount)}`];
  });
  // join
  const parts = [];
  parts.push(header.join(','));
  parts.push(''); // blank line
  parts.push(cols.join(','));
  rows.forEach(r => parts.push(r.join(',')));
  // final total row
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
  const [tab, setTab] = useState(0); // 0=day,1=week,2=month
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ total: 0, items: [] });
  const [message, setMessage] = useState('');

  const periodFromTab = (t) => (t === 0 ? 'day' : t === 1 ? 'week' : 'month');

  const normalizePayload = (payload) => {
    // payload can be array, or { total, items } or { items } etc.
    if (!payload) return { total: 0, items: [] };
    if (Array.isArray(payload)) {
      const total = payload.reduce((s, it) => s + Number(it.amount ?? it.total ?? 0), 0);
      return { total, items: payload };
    }
    const total = payload.total ?? payload.amount ?? 0;
    const items = payload.items ?? payload.data ?? payload.rows ?? [];
    return { total: Number(total || 0), items };
  };

  const tryFallbackRange = async (period) => {
    // If getRevenue returned no items, attempt to fetch range for last 1/7/30 days
    const { start, end } = getRangeForPeriod(period);
    try {
      const res = await adminAPI.getRevenueRange(start, end);
      const pl = res?.data ?? res;
      const normalized = normalizePayload(pl);
      return normalized;
    } catch (err) {
      console.warn('Fallback range failed:', err);
      return { total: 0, items: [] };
    }
  };

  const fetchFor = useCallback(async (period) => {
    setLoading(true);
    setMessage('');
    setData({ total: 0, items: [] });
    try {
      // primary call
      const res = await adminAPI.getRevenue(period);
      const payload = res?.data ?? res;
      let normalized = normalizePayload(payload);

      // If no items returned, try fallback range endpoint
      if ((!normalized.items || normalized.items.length === 0) && (period === 'week' || period === 'month' || period === 'day')) {
        const fallback = await tryFallbackRange(period);
        if (fallback.items && fallback.items.length > 0) {
          normalized = fallback;
        }
      }

      setData(normalized);
      if (!normalized.items || normalized.items.length === 0) {
        setMessage('No hay datos detallados para este periodo.');
      } else {
        setMessage('');
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      setMessage('Error al cargar el reporte. Revisa la consola o el endpoint /api/admin/revenue.');
      setData({ total: 0, items: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const period = periodFromTab(tab);
    fetchFor(period);
  }, [tab, fetchFor]);

  const handleExport = () => {
    const period = periodFromTab(tab);
    const filenameBase = (period === 'day') ? `incomes_day_${toYMD(new Date())}`
      : (period === 'week') ? `incomes_week_${getRangeForPeriod('week').start}_to_${getRangeForPeriod('week').end}`
      : `incomes_month_${new Date().getFullYear()}_${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const periodLabel = period.toUpperCase();
    const csv = buildCSV(periodLabel, data.total, data.items);
    downloadCSV(`${filenameBase}.csv`, csv);
  };

  return (
    <>
      <Header />
      <Container maxWidth="xl" sx={{ pt: 4, pb: 4 }}>
        <Typography variant="h4" gutterBottom>📊 Reportes de Ingresos</Typography>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2, flexWrap: 'wrap' }}>
            <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ flex: '1 1 auto' }}>
              <Tab label="Diario" />
              <Tab label="Semanal" />
              <Tab label="Mensual" />
            </Tabs>

            <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
              <Button variant="outlined" onClick={() => { /* allow refresh */ const p = periodFromTab(tab); fetchFor(p); }}>
                Consultar
              </Button>
              <Button
                variant="contained"
                onClick={handleExport}
                disabled={!(data.items && data.items.length > 0)}
              >
                Exportar CSV
              </Button>
            </Stack>
          </Box>

          <Box sx={{ p: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
            ) : (
              <>
                <Typography variant="h6" sx={{ mb: 1 }}>Total: {formatCurrency(data.total)}</Typography>
                {message && <Typography color="text.secondary" sx={{ mb: 1 }}>{message}</Typography>}

                {data.items && data.items.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Fecha</TableCell>
                          <TableCell align="right">Monto (Bs)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.items.map((it, idx) => (
                          <TableRow key={it.date ?? it.period ?? idx}>
                            <TableCell>{formatDateLabel(it.date ?? it.period ?? it.label)}</TableCell>
                            <TableCell align="right">{formatCurrency(it.amount ?? it.total ?? 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : null}
              </>
            )}
          </Box>
        </Paper>

        {/* Reusar balance de conductores */}
        <Box sx={{ mt: 2 }}>
          <DriverDailyBalances />
        </Box>
      </Container>
    </>
  );
};

export default Reports;