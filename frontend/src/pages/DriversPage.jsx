import React, { useEffect, useState, useCallback } from 'react';
import {
  Container, Typography, Box, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip, CircularProgress
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import Header from '../components/Header';
import { adminAPI } from '../services/api';

const DriversPage = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getAllUsers();
      const all = Array.isArray(res?.data) ? res.data : [];
      setDrivers(all.filter(u => ((u.role || '').toString().toLowerCase() === 'driver')));
    } catch (err) {
      console.error('DriversPage fetchAll', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div>
      <Header />
      <Container maxWidth="xl" sx={{ pt: 4, pb: 4 }}>
        <Typography variant="h4" gutterBottom>Conductores</Typography>

        <Paper>
          {loading ? (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Driver Code</TableCell>
                    <TableCell>Balance</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {drivers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.id}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.driver_code || '-'}</TableCell>
                      <TableCell>{parseFloat(u.balance || 0).toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar Usuario"><IconButton size="small"><EditIcon /></IconButton></Tooltip>
                        <Tooltip title="Eliminar Usuario"><IconButton size="small"><DeleteIcon /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Container>
    </div>
  );
};

export default DriversPage;