import React, { useState } from 'react';
import {
  Box, Button, TextField, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Typography
} from '@mui/material';
import api from '../services/api'; // tu instancia axios

/**
 * DriverDailyBalances (UI)
 * Muestra solo: Nombre, código, Teléfono, Total de pagos recibidos (por día)
 */
const DriverDailyBalances = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const fetchBalances = async () => {
    if (!from || !to) return alert('Selecciona rango de fechas');
    setLoading(true);
    try {
      const resp = await api.get('/admin/reports/driver-daily-balances', { params: { from, to } });
      const data = (resp && (resp.data?.data || resp.data)) || [];
      const normalized = data.map(r => ({
        driver_name: r.driver_name ?? 'Desconocido',
        driver_code: r.driver_code ?? '',
        driver_phone: r.driver_phone ?? '-',
        day: r.day,
        payments_count: r.payments_count ?? 0,
        total_received: Number(r.total_received ?? 0)
      }));
      setRows(normalized);
    } catch (err) {
      console.error('DriverDailyBalances fetch error:', err);
      alert('Error al obtener balances. Revisa la consola del navegador y los logs del backend.');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!rows.length) return;
    const header = ['driver_name', 'driver_code', 'driver_phone', 'day', 'payments_count', 'total_received'];
    const csv = [
      header.join(','),
      ...rows.map(r => header.map(h => `"${(r[h] ?? '').toString().replace(/"/g,'""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver_daily_totals_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Balance diario por Conductor</Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
        <TextField type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
        <Button variant="contained" onClick={fetchBalances} disabled={loading}>
          {loading ? <CircularProgress size={18} /> : 'Consultar'}
        </Button>
        <Button variant="outlined" onClick={exportCSV} disabled={!rows.length}>Exportar CSV</Button>
      </Box>

      <TableContainer component={Paper}>
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
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.driver_name}</TableCell>
                <TableCell>{r.driver_code}</TableCell>
                <TableCell>{r.driver_phone}</TableCell>
                <TableCell>{r.day}</TableCell>
                <TableCell align="right">{r.payments_count}</TableCell>
                <TableCell align="right">{r.total_received.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No hay datos. Selecciona un rango y presiona "Consultar".
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default DriverDailyBalances;