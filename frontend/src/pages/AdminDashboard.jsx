import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Paper, Typography, Box, Grid, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Button, CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  IconButton, Tooltip, Card, CardContent
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Close as CloseIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { rechargeAPI, routeAPI, adminAPI } from '../services/api';
import UserForm from '../components/UserForm';
import RouteForm from '../components/RouteForm';
import { useNavigate } from 'react-router-dom';
import axios from '../services/api'; // axios default export

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Estadísticas
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDrivers: 0,
    totalTrips: 0,
    activeTrips: 0,
    totalRevenue: '0.00'
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Recargas
  const [pendingRecharges, setPendingRecharges] = useState([]);
  const [loadingRecharges, setLoadingRecharges] = useState(true);
  const [loadingRechargeAction, setLoadingRechargeAction] = useState(null);

  // Rutas
  const [routes, setRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [openRouteForm, setOpenRouteForm] = useState(false);
  const [isSubmittingRoute, setIsSubmittingRoute] = useState(false);
  const [routeFormError, setRouteFormError] = useState('');
  const [editingRoute, setEditingRoute] = useState(null);

  // Usuarios
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [openUserForm, setOpenUserForm] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  // Mensaje global
  const [message, setMessage] = useState({ text: '', type: 'info' });

  // Formato de moneda
  const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return 'Bs 0,00';
    const formatted = num.toFixed(2).replace('.', ',');
    return `Bs ${formatted}`;
  };

  // Carga de estadísticas
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const response = await adminAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setMessage({ text: 'Error al cargar las estadísticas.', type: 'error' });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Carga recargas
  const fetchPendingRecharges = useCallback(async () => {
    setLoadingRecharges(true);
    try {
      const response = await rechargeAPI.getPending();
      setPendingRecharges(response.data);
    } catch (error) {
      setMessage({ text: 'Error al cargar recargas pendientes', type: 'error' });
      console.error(error);
    } finally {
      setLoadingRecharges(false);
    }
  }, []);

  // Carga rutas
  const fetchRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const response = await routeAPI.getAll();
      setRoutes(response.data);
    } catch (error) {
      setMessage({ text: 'Error al cargar las rutas', type: 'error' });
      console.error(error);
    } finally {
      setLoadingRoutes(false);
    }
  }, []);

  // Carga usuarios
  const fetchAllUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const response = await adminAPI.getAllUsers();
      setUsers(response.data);
    } catch (error) {
      setMessage({ text: 'Error al cargar la lista de usuarios. Asegúrate de tener permisos.', type: 'error' });
      console.error(error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Carga inicial y polling
  useEffect(() => {
    fetchAllUsers();
    fetchRoutes();
    fetchStats();
    fetchPendingRecharges();
    const pollRechargesInterval = setInterval(() => {
      fetchPendingRecharges();
    }, 15000);
    return () => clearInterval(pollRechargesInterval);
  }, [fetchAllUsers, fetchRoutes, fetchPendingRecharges, fetchStats]);

  // Handlers recargas
  const handleConfirmRecharge = async (rechargeId) => {
    setLoadingRechargeAction(rechargeId);
    try {
      await rechargeAPI.confirm(rechargeId);
      setMessage({ text: 'Recarga aprobada y saldo sumado exitosamente.', type: 'success' });
      setPendingRecharges(prev => prev.filter(r => r.id !== rechargeId));
      fetchStats();
    } catch (error) {
      setMessage({ text: error.response?.data?.error || 'Error al aprobar la recarga. Verifique la conexión.', type: 'error' });
    } finally {
      setLoadingRechargeAction(null);
    }
  };

  // Handlers usuarios
  const handleOpenUserModal = (user = null) => {
    setEditingUser(user); // pasar null o el usuario, sin crear objetos nuevos
    setUserFormError('');
    setOpenUserForm(true);
  };
  const handleCloseUserModal = () => {
    setOpenUserForm(false);
    setEditingUser(null);
  };

  // Crear/Actualizar usuario: mostrar mensaje y cerrar modal tras éxito
  const handleUserSubmit = async (formData) => {
    setIsSubmittingUser(true);
    setUserFormError('');
    try {
      if (editingUser && editingUser.id) {
        // Actualizar usuario existente por su id
        await adminAPI.updateUser(editingUser.id, formData);
        setMessage({ text: 'Usuario actualizado exitosamente', type: 'success' });
        // refrescar lista y stats
        await fetchAllUsers();
        await fetchStats();
        // cerrar modal de edición
        handleCloseUserModal();
      } else {
        // Nuevo usuario: llamar al endpoint correspondiente según role
        const roleToCreate = formData.role || 'driver';
        // aseguramos role en payload
        const payload = { ...formData, role: roleToCreate };

        let response = null;
        try {
          if (roleToCreate === 'admin') {
            // createUser intentará endpoints administrativos y alternativos
            response = await adminAPI.createUser(payload);
          } else {
            response = await adminAPI.createDriver(payload);
          }
        } catch (err) {
          // si createUser lanzó por 404 u otro motivo, se maneja abajo
          throw err;
        }

        const created = response?.data;
        // extraer id y role devuelto del body (varía según backend)
        const createdId = created?.id || created?.user?.id || created?.userId || created?.data?.id || null;
        const createdRole = created?.role || created?.user?.role || created?.data?.role || null;

        // Si pedimos admin pero backend devolvió otro role, intentar corregir si tenemos permisos
        if (roleToCreate === 'admin' && createdRole && createdRole !== 'admin') {
          // Chequear si tenemos token/authorization configurada
          const authHeader = axios.defaults.headers.common['Authorization'];
          if (!authHeader) {
            setMessage({ text: 'Usuario creado, pero no hay token para asignar role admin automáticamente. Revisa sesión.', type: 'warning' });
          } else if (createdId) {
            // Intentar actualizar role vía adminAPI.updateUser
            try {
              await adminAPI.updateUser(createdId, { role: 'admin' });
              // si éxito, informar claramente
              setMessage({ text: 'Administrador creado y role actualizado correctamente.', type: 'success' });
            } catch (updateErr) {
              console.warn('No se pudo actualizar role a admin:', updateErr);
              setMessage({ text: 'Usuario creado, pero el backend devolvió role distinto (no admin). No se pudo reasignar role automáticamente.', type: 'warning' });
            }
          } else {
            setMessage({ text: 'Usuario creado, pero backend devolvió role distinto y no se obtuvo id para actualizar.', type: 'warning' });
          }
        } else {
          // todo bien o no pedimos admin
          setMessage({ text: roleToCreate === 'admin' ? 'Administrador creado exitosamente' : 'Conductor creado exitosamente', type: 'success' });
        }

        // refrescar datos y cerrar modal
        await fetchAllUsers();
        await fetchStats();
        handleCloseUserModal();
      }
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Error al guardar el usuario';
      setUserFormError(errMsg);
      setMessage({ text: errMsg, type: 'error' });

      // Si el error es 404 en createUser, avisar explícitamente que falta endpoint admin
      if (error?.response?.status === 404) {
        setUserFormError('Endpoint administrativo no encontrado (404). El backend no tiene POST /admin/users.');
      }
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (window.confirm(`¿Estás seguro de ELIMINAR al usuario ${userName}? Esta acción es irreversible.`)) {
      try {
        await adminAPI.deleteUser(userId);
        setMessage({ text: `Usuario ${userName} eliminado.`, type: 'success' });
        fetchAllUsers();
        fetchStats();
      } catch (error) {
        setMessage({ text: error.response?.data?.error || 'Error al eliminar usuario', type: 'error' });
      }
    }
  };

  // Handlers rutas
  const handleOpenRouteModal = (route = null) => {
    setEditingRoute(route);
    setRouteFormError('');
    setOpenRouteForm(true);
  };
  const handleCloseRouteModal = () => {
    setOpenRouteForm(false);
    setEditingRoute(null);
  };
  const handleRouteSubmit = async (formData) => {
    setIsSubmittingRoute(true);
    setRouteFormError('');
    try {
      if (editingRoute) {
        await routeAPI.update(editingRoute.id, formData);
        setMessage({ text: 'Ruta actualizada exitosamente', type: 'success' });
      } else {
        await routeAPI.create(formData);
        setMessage({ text: 'Ruta creada exitosamente', type: 'success' });
      }
      handleCloseRouteModal();
      fetchRoutes();
      fetchStats();
    } catch (error) {
      setRouteFormError(error.response?.data?.error || 'Error al guardar la ruta');
    } finally {
      setIsSubmittingRoute(false);
    }
  };
  const handleDeleteRoute = async (routeId, isActive) => {
    const actionText = isActive ? 'desactivar' : 'activar';
    if (window.confirm(`¿Seguro que quieres ${actionText} esta ruta?`)) {
      try {
        await routeAPI.update(routeId, { is_active: !isActive });
        setMessage({ text: `Ruta ${actionText} exitosamente.`, type: 'success' });
        fetchRoutes();
        fetchStats();
      } catch (error) {
        setMessage({ text: error.response?.data?.error || `Error al ${actionText} la ruta`, type: 'error' });
      }
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Container maxWidth="xl" sx={{ pt: 4, pb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
            👨‍💼 Panel de Administración
          </Typography>
        </Box>
        {message.text && <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage({ text: '', type: 'info' })}>{message.text}</Alert>}
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h5" gutterBottom color="primary">💰 Recargas de Saldo Pendientes ({pendingRecharges.length})</Typography>
              {loadingRecharges ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
              ) : pendingRecharges.length === 0 ? (
                <Typography color="text.secondary">No hay recargas pendientes.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Usuario</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Monto (Bs)</TableCell>
                        <TableCell>Referencia</TableCell>
                        <TableCell align="right">Acción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingRecharges.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.user_name}</TableCell>
                          <TableCell>{r.user_email}</TableCell>
                          <TableCell>{parseFloat(r.amount).toFixed(2)}</TableCell>
                          <TableCell>{r.reference}</TableCell>
                          <TableCell align="right">
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              disabled={loadingRechargeAction === r.id}
                              onClick={() => handleConfirmRecharge(r.id)}
                            >
                              {loadingRechargeAction === r.id ? <CircularProgress size={20} color="inherit" /> : 'Aprobar'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" color="primary">🛣️ Gestión de Rutas</Typography>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenRouteModal(null)}
                >
                  Crear Ruta
                </Button>
              </Box>
              {loadingRoutes ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
              ) : routes.length === 0 ? (
                <Typography color="text.secondary">No hay rutas creadas.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ruta</TableCell>
                        <TableCell>Tarifa (Bs)</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">Acción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {routes.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{parseFloat(r.fare).toFixed(2)}</TableCell>
                          <TableCell>
                            <Chip
                              label={r.is_active ? 'Activa' : 'Inactiva'}
                              color={r.is_active ? 'success' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Editar Ruta">
                              <IconButton size="small" onClick={() => handleOpenRouteModal(r)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={r.is_active ? "Desactivar Ruta" : "Activar Ruta"}>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteRoute(r.id, r.is_active)}
                              >
                                {r.is_active ? <CloseIcon fontSize="small" color="error" /> : <AddIcon fontSize="small" color="success" />}
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
          </Grid>

          {loadingStats ? (
            <Grid item xs={12}><Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box></Grid>
          ) : (
            <>
              <Grid item xs={12}>
                <Card sx={{ bgcolor: '#4caf50', display: 'flex', alignItems: 'center', p: 2, height: '100px' }}>
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <AttachMoneyIcon sx={{ color: 'white', mr: 1, fontSize: '1.8rem' }} />
                      <Typography variant="body2" color="white" sx={{ fontWeight: 'bold' }}>INGRESOS TOTALES</Typography>
                    </Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: 'white' }}>{formatCurrency(stats.totalRevenue)}</Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4} md={2.4}><Card><CardContent><Typography color="textSecondary">Total Usuarios</Typography><Typography variant="h4">{stats.totalUsers}</Typography></CardContent></Card></Grid>
                  <Grid item xs={12} sm={4} md={2.4}><Card><CardContent><Typography color="textSecondary">Conductores</Typography><Typography variant="h4">{stats.totalDrivers}</Typography></CardContent></Card></Grid>
                  <Grid item xs={12} sm={4} md={2.4}><Card><CardContent><Typography color="textSecondary">Total Viajes</Typography><Typography variant="h4">{stats.totalTrips}</Typography></CardContent></Card></Grid>
                  <Grid item xs={12} sm={4} md={2.4}><Card><CardContent><Typography color="textSecondary">Viajes Activos</Typography><Typography variant="h4">{stats.activeTrips}</Typography></CardContent></Card></Grid>
                  <Grid item xs={12} sm={4} md={2.4}><Card><CardContent><Typography color="textSecondary">Rutas Activas</Typography><Typography variant="h4">{routes.filter(r => r.is_active).length}</Typography></CardContent></Card></Grid>
                </Grid>
              </Grid>
            </>
          )}

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" gutterBottom color="primary">👥 Gestión de Usuarios</Typography>
                <Button variant="contained" color="primary" onClick={() => handleOpenUserModal(null)} startIcon={<AddIcon />}>
                  Crear Usuario
                </Button>
              </Box>
              {loadingUsers ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
              ) : users.length === 0 ? (
                <Typography color="text.secondary">No hay usuarios registrados.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Nombre</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Rol</TableCell>
                        <TableCell>Balance (Bs)</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>{u.id}</TableCell>
                          <TableCell>{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            <Chip
                              label={u.role.toUpperCase()}
                              color={u.role === 'admin' ? 'secondary' : u.role === 'driver' ? 'warning' : 'info'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{parseFloat(u.balance).toFixed(2)}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Editar Usuario">
                              <IconButton size="small" onClick={() => handleOpenUserModal(u)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {u.id !== user.id && (
                              <Tooltip title="Eliminar Usuario">
                                <IconButton size="small" onClick={() => handleDeleteUser(u.id, u.name)} color="error">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Dialog open={openRouteForm} onClose={handleCloseRouteModal} maxWidth="sm" fullWidth>
          <DialogTitle>{editingRoute ? 'Editar Ruta' : 'Crear Nueva Ruta'}</DialogTitle>
          <DialogContent>
            {routeFormError && <Alert severity="error" sx={{ mb: 2 }}>{routeFormError}</Alert>}
            <RouteForm
              isSubmitting={isSubmittingRoute}
              onCancel={handleCloseRouteModal}
              onSubmit={handleRouteSubmit}
              initialData={editingRoute || {}}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={openUserForm} onClose={handleCloseUserModal} maxWidth="sm" fullWidth>
          <DialogTitle>{editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
          <DialogContent>
            {userFormError && <Alert severity="error" sx={{ mb: 2 }}>{userFormError}</Alert>}
            <UserForm
              isSubmitting={isSubmittingUser}
              onCancel={handleCloseUserModal}
              onSubmit={handleUserSubmit}
              initialData={editingUser || undefined}
              requirePassword={!editingUser}
            />
          </DialogContent>
        </Dialog>
      </Container>
    </Box>
  );
};

export default AdminDashboard;