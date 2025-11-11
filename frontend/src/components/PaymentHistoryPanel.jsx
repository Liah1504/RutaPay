import React, { useEffect, useState } from 'react';
import {
  Paper, Typography, Box, TextField, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress
} from '@mui/material';
import { paymentAPI } from '../services/api';

/*
  PaymentHistoryPanel
  - Input date para filtrar por día (YYYY-MM-DD)
  - Llama a paymentAPI.getHistory(date)
  - Si date vacío, carga recientes
  - Encaja visualmente en tu UI existente
*/

export default function PaymentHistoryPanel() {
  const [date, setDate] = useState('');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = async (d = '') => {
    setLoading(true);
    setMessage('');
    try {
      const res = await paymentAPI.getHistory(d || undefined);
      const rows = Array.isArray(res?.data) ? res.data : [];
      setPayments(rows);
      if (!rows || rows.length === 0) {
        setMessage(d ? 'No hay pagos registrados para la fecha seleccionada.' : 'No has realizado ningún pago todavía.');
      }
    } catch (err) {
      console.error('Error cargando historial de pagos:', err);
      setMessage(err?.response?.data?.error || 'Error cargando historial de pagos');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // carga inicial (sin filtro)
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = () => {
    if (!date) {
      load();
      return;
    }
    load(date);
  };

  const clearFilter = () => {
    setDate('');
    load();
  };

  return (
    <Paper sx={{ p: 2, mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6">📜 Historial de Pagos</Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            label="Filtrar por día"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <Button variant="outlined" onClick={applyFilter}>Aplicar</Button>
          <Button variant="contained" color="inherit" onClick={clearFilter}>Borrar filtro</Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
      ) : message ? (
        <Typography color="text.secondary" sx={{ p: 1 }}>{message}</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Referencia / Método</TableCell>
                <TableCell align="right">Monto (Bs)</TableCell>
                <TableCell>Detalle</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</TableCell>
                  <TableCell>{p.reference || p.method || `#${p.id}`}</TableCell>
                  <TableCell align="right">{parseFloat(p.amount || 0).toFixed(2)}</TableCell>
                  <TableCell style={{ maxWidth: 300, whiteSpace: 'normal' }}>{p.note || (p.data ? JSON.stringify(p.data) : '')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}