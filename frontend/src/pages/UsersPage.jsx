import React, { useEffect, useState, useCallback } from 'react';
import {
  Container, Typography, Box, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, Button, Snackbar, Alert
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import Header from '../components/Header';
import UserForm from '../components/UserForm';
import { adminAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * UsersPage
 * - Muestra la lista de usuarios con acciones Editar / Eliminar.
 * - Los botones están envueltos en IconButton con onClick activos.
 * - Abre un modal con UserForm para crear/editar usuarios.
 * - Evita que el usuario autenticado pueda eliminarse a sí mismo.
 */
const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState({ open: false, severity: 'success', message: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await adminAPI.getAllUsers();
      const list = Array.isArray(res?.data) ? res.data : (res?.data?.items ?? []);
      setUsers(list);
    } catch (err) {
      console.error('UsersPage fetchAll', err);
      setFetchError(err?.response?.data?.error || err?.message || 'Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openCreate = () => {
    setEditingUser(undefined);
    setOpenDialog(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setOpenDialog(true);
  };

  const closeDialog = () => {
    setEditingUser(undefined);
    setOpenDialog(false);
  };

  const handleDelete = async (id, name) => {
    if (!id) return;
    if (!window.confirm(`¿Seguro que deseas eliminar al usuario "${name}"? Esta acción es irreversible.`)) return;
    try {
      setSubmitting(true);
      await adminAPI.deleteUser(id);
      setSnack({ open: true, severity: 'success', message: `Usuario ${name} eliminado.` });
      await fetchAll();
    } catch (err) {
      console.error('Error deleting user:', err);
      setSnack({ open: true, severity: 'error', message: err?.response?.data?.error || 'Error eliminando usuario' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = async (payload) => {
    setSubmitting(true);
    try {
      if (editingUser && editingUser.id) {
        await adminAPI.updateUser(editingUser.id, payload);
        setSnack({ open: true, severity: 'success', message: 'Usuario actualizado.' });
      } else {
        await adminAPI.createUser(payload);
        setSnack({ open: true, severity: 'success', message: 'Usuario creado.' });
      }
      await fetchAll();
      closeDialog();
    } catch (err) {
      console.error('Error saving user:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Error guardando usuario';
      setSnack({ open: true, severity: 'error', message: msg });
      // rethrow if the form expects thrown errors
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    const num = Number(amount || 0);
    if (!Number.isFinite(num)) return 'Bs 0,00';
    return `Bs ${num.toFixed(2).replace('.', ',')}`;
  };

  return (
    <div>
      <Header />
      <Container maxWidth="xl" sx={{ pt: 4, pb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>Usuarios</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Crear Usuario</Button>
        </Box>

        <Paper>
          {loading ? (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : fetchError ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="error">{fetchError}</Alert>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Rol</TableCell>
                    <TableCell>Balance</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.id}</TableCell>
                      <TableCell>{u.name || u.username || u.fullname}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{(u.role || '').toString()}</TableCell>
                      <TableCell>{formatCurrency(u.balance ?? u.wallet ?? 0)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar Usuario">
                          <IconButton
                            size="small"
                            aria-label={`Editar ${u.name}`}
                            onClick={(e) => { e.stopPropagation(); openEdit(u); }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Eliminar Usuario">
                          <IconButton
                            size="small"
                            aria-label={`Eliminar ${u.name}`}
                            onClick={(e) => { e.stopPropagation(); handleDelete(u.id, u.name); }}
                            color="error"
                            disabled={currentUser && u.id === currentUser.id}
                          >
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

      <Dialog open={openDialog} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingUser ? 'Editar Usuario' : 'Crear Usuario'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <UserForm
              initialData={editingUser || {}}
              onSubmit={handleFormSubmit}
              onCancel={closeDialog}
              isSubmitting={submitting}
              requirePassword={!editingUser}
            />
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default UsersPage;