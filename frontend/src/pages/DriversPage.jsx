import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Box, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, Button, Alert
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import Header from '../components/Header';
import { adminAPI } from '../services/api';
import UserForm from '../components/UserForm';

/**
 * DriversPage (columna Driver Code eliminada)
 * - Intenta /admin/drivers primero, luego /drivers, luego /admin/users, luego /users
 * - Mantiene modal para crear/editar conductores
 */

const getArrayFromResponse = (res) => {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.users)) return payload.users;
  return [];
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1) try /admin/drivers
      try {
        const resDrivers = await adminAPI.getDrivers();
        const arr = getArrayFromResponse(resDrivers);
        console.debug('DriversPage: /admin/drivers', resDrivers?.data ?? resDrivers);
        if (arr.length) { setDrivers(arr); setLoading(false); return; }
      } catch (errDrivers) {
        console.warn('/admin/drivers failed', errDrivers?.response?.status);
      }

      // 2) try /drivers (public)
      try {
        const resPublic = await adminAPI.getDrivers(); // reuse, backend might map /drivers -> /admin/drivers internally
        const arr = getArrayFromResponse(resPublic);
        console.debug('DriversPage: /drivers (via getDrivers)', resPublic?.data ?? resPublic);
        if (arr.length) { setDrivers(arr); setLoading(false); return; }
      } catch (errPublic) {
        console.warn('/drivers failed', errPublic?.response?.status);
      }

      // 3) fallback /admin/users and filter role === 'driver'
      try {
        const resUsers = await adminAPI.getAllUsers();
        const all = getArrayFromResponse(resUsers);
        console.debug('DriversPage: /admin/users', resUsers?.data ?? resUsers);
        const onlyDrivers = (all || []).filter(u => ((u.role || '').toString().toLowerCase() === 'driver'));
        if (onlyDrivers.length) { setDrivers(onlyDrivers); setLoading(false); return; }
      } catch (errUsers) {
        console.warn('/admin/users failed', errUsers?.response?.status);
      }

      // 4) final fallback /users
      try {
        const resUsersPublic = await adminAPI.getAllUsers(); // reuse if /users not available separately
        const all = getArrayFromResponse(resUsersPublic);
        const onlyDrivers = (all || []).filter(u => ((u.role || '').toString().toLowerCase() === 'driver'));
        setDrivers(onlyDrivers);
      } catch (errFinal) {
        console.warn('/users final fallback failed', errFinal?.response?.status);
        setErrorMsg('No se pudo obtener la lista de conductores. Revisa los endpoints del backend.');
        setDrivers([]);
      }
    } catch (err) {
      console.error('DriversPage fetchAll error', err);
      setErrorMsg(err?.response?.data?.error || err?.message || 'Error cargando conductores');
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => { setEditing(null); setOpenForm(true); };
  const openEdit = (u) => { setEditing(u); setOpenForm(true); };
  const closeForm = () => { setEditing(null); setOpenForm(false); };

  const handleFormSubmit = async (payload) => {
    setSubmitting(true);
    try {
      if (editing && editing.id) {
        await adminAPI.updateUser(editing.id, payload);
      } else {
        if (adminAPI.createDriver) {
          await adminAPI.createDriver(payload);
        } else {
          await adminAPI.createUser(payload);
        }
      }
      await fetchAll();
      closeForm();
    } catch (err) {
      console.error('DriversPage save error', err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (u) => {
    if (!u || !u.id) return;
    if (!window.confirm(`¿Eliminar conductor ${u.name || u.email}? Esta acción es irreversible.`)) return;
    try {
      await adminAPI.deleteUser(u.id);
      await fetchAll();
    } catch (err) {
      console.error('DriversPage delete error', err);
      alert(err?.response?.data?.error || err?.message || 'Error eliminando conductor');
    }
  };

  return (
    <div>
      <Header />
      <Container maxWidth="xl" sx={{ pt: 4, pb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" gutterBottom>Conductores</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Crear conductor</Button>
        </Box>

        <Paper>
          {loading ? (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : errorMsg ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="error">{errorMsg}</Alert>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Balance</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {drivers.map(u => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.id}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{Number(u.balance || 0).toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar conductor">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(u); }} aria-label={`editar-${u.id}`}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Eliminar conductor">
                          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(u); }} aria-label={`eliminar-${u.id}`}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Container>

      <Dialog open={openForm} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Editar conductor' : 'Crear conductor'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <UserForm
              initialData={editing || {}}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
              isSubmitting={submitting}
              requirePassword={!editing}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </div>
  );
}