import React, { useState } from 'react';
import {
  Box, Button, TextField, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Typography
} from '@mui/material';
import axios from '../services/api'; // tu instancia axios configurada (baseURL)

const DriverDailyBalances = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const fetchBalances = async () => {
    if (!from || !to) return alert('Selecciona rango de fechas');
    setLoading(true);
    try {
      const resp = await axios.get('/admin/reports/driver-daily-balances', { params: { from, to } });
      setRows(resp.data.data || []);
    } catch (err) {
      console.error(err);
      alert('Error al obtener balances. Revisa la consola.');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!rows.length) return;
    const header = ['driver_code', 'day', 'trips_count', 'total_fare', 'total_tips', 'total_discounts', 'gross_amount', 'driver_earning'];
    const csv = [
      header.join(','),
      ...rows.map(r => header.map(h => `"${(r[h] ?? '').toString().replace(/"/g,'""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver_daily_balances_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Balance diario por conductor (driver_code)</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="contained" onClick={fetchBalances} disabled={loading}>
          {loading ? <CircularProgress size={18} /> : 'Consultar'}
        </Button>
        <Button variant="outlined" onClick={exportCSV} disabled={!rows.length}>Exportar CSV</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Driver Code</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell align="right">Viajes</TableCell>
              <TableCell align="right">Tarifas</TableCell>
              <TableCell align="right">Propinas</TableCell>
              <TableCell align="right">Descuentos</TableCell>
              <TableCell align="right">Bruto</TableCell>
              <TableCell align="right">Ganancia conductor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.driver_code}</TableCell>
                <TableCell>{r.day}</TableCell>
                <TableCell align="right">{r.trips_count}</TableCell>
                <TableCell align="right">{parseFloat(r.total_fare || 0).toFixed(2)}</TableCell>
                <TableCell align="right">{parseFloat(r.total_tips || 0).toFixed(2)}</TableCell>
                <TableCell align="right">{parseFloat(r.total_discounts || 0).toFixed(2)}</TableCell>
                <TableCell align="right">{parseFloat(r.gross_amount || 0).toFixed(2)}</TableCell>
                <TableCell align="right">{parseFloat(r.driver_earning || 0).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default DriverDailyBalances;