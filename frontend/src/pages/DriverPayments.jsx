import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Paper, Typography, Box, CircularProgress, TableContainer, Table,
  TableHead, TableRow, TableCell, TableBody, TextField, Button, TablePagination
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import Header from '../components/Header';
import { driverAPI } from '../services/api';

/**
 * DriverPayments page: historial separado (mismo table + filtro + export CSV)
 * - Ruta sugerida: /driver/payments (añadir en el router)
 */

export default function DriverPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterName, setFilterName] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await driverAPI.getPayments();
        setPayments(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        console.error('DriverPayments load error', err);
        setPayments([]);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    load();
    return () => { mountedRef.current = false; };
  }, []);

  const filtered = filterName.trim()
    ? payments.filter(p => (p.passenger_name || p.user_name || '').toLowerCase().includes(filterName.trim().toLowerCase()))
    : payments;

  const handleChangePage = (e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); };

  const exportCSV = () => {
    const rows = filtered;
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
    a.download = `historial_pagos_driver.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const paymentsPage = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <>
      <Header />
      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6">Historial de Pagos Recibidos</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                label="Filtrar por pasajero"
                variant="outlined"
                value={filterName}
                onChange={e => { setFilterName(e.target.value); setPage(0); }}
              />
              <Button startIcon={<FileDownloadIcon />} onClick={exportCSV} size="small" variant="outlined">Exportar CSV</Button>
            </Box>
          </Box>

          {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box> : (
            <>
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
                    {paymentsPage.map(p => (
                      <TableRow key={p.id || `${p.passenger_name}-${p.created_at || Math.random()}`}>
                        <TableCell>{p.route_name || p.route?.name || '-'}</TableCell>
                        <TableCell>{p.passenger_name || p.user_name || '-'}</TableCell>
                        <TableCell>{parseFloat(p.amount || p.monto || 0).toFixed(2)} Bs</TableCell>
                        <TableCell>{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={filtered.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5,10,25]}
              />
            </>
          )}
        </Paper>
      </Container>
    </>
  );
}