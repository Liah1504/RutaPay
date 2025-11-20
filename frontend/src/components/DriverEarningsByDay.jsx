import React, { useState } from 'react';
import {
  Box, TextField, Button, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import { driverAPI } from '../services/api';

/**
 * Componente pequeño para consultar ganancia diaria de un conductor
 * - driverCode: código del conductor (driver_code en la tabla drivers)
 * - date: YYYY-MM-DD
 *
 * Uso: incluir en AdminDashboard para que el admin consulte ganancias por día.
 */
export default function DriverEarningsByDay({ initialDriverCode = '' }) {
  const [driverCode, setDriverCode] = useState(initialDriverCode);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(null);
  const [totalsByRoute, setTotalsByRoute] = useState([]);
  const [error, setError] = useState(null);

  const fetchEarnings = async () => {
    setError(null);
    setTotal(null);
    setTotalsByRoute([]);
    if (!driverCode) {
      setError('Ingresa el código del conductor (driver_code)');
      return;
    }
    setLoading(true);
    try {
      const res = await driverAPI.getPaymentsSummary(date, driverCode);
      // El backend (getDriverPaymentsSummary) devuelve:
      // { totals: [...], total: '123.45', passengers_count, unique_passengers }
      const data = res.data || {};
      setTotal(data.total ?? 0);
      setTotalsByRoute(data.totals || []);
    } catch (err) {
      console.error('fetchEarnings error', err);
      setError(err?.response?.data?.error || 'Error obteniendo las ganancias');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 3, p: 2, borderRadius: 1, border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Ganancias por día (Conductor)</Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <TextField
          label="Código del conductor (driver_code)"
          value={driverCode}
          onChange={(e) => setDriverCode(e.target.value)}
          size="small"
        />
        <TextField
          label="Fecha"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          size="small"
        />
        <Button variant="contained" onClick={fetchEarnings} disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
        {error && <Typography color="error" sx={{ ml: 2 }}>{error}</Typography>}
      </Box>

      {total !== null && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Total del día: <strong>Bs {parseFloat(total).toFixed(2)}</strong></Typography>
        </Box>
      )}

      {totalsByRoute && totalsByRoute.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ruta</TableCell>
                <TableCell align="right">Total (Bs)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {totalsByRoute.map((t) => (
                <TableRow key={t.route_id || t.route_name}>
                  <TableCell>{t.route_name || 'Sin ruta'}</TableCell>
                  <TableCell align="right">{parseFloat(t.total).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}