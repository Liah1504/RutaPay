import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Paper, Typography, Box, Grid, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Button, CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  IconButton, Tooltip, Card, CardContent, TextField, Tabs, Tab
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Close as CloseIcon,
  AttachMoney as AttachMoneyIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { rechargeAPI, routeAPI, adminAPI } from '../services/api';
import UserForm from '../components/UserForm';
import RouteForm from '../components/RouteForm';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api'; // instancia centralizada axios

// Nuevo: componente de reporte (asegúrate de tener src/components/DriverDailyBalances.jsx)
import DriverDailyBalances from '../components/DriverDailyBalances';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  // UI: pestañas del admin (null = nada mostrado hasta click)
  // 0 = Conductores, 1 = Pasajeros, 2 = Administradores, 3 = Rutas Activas
  const [selectedTab, setSelectedTab] = useState(null);

  // Rechazo recarga: dialog
  const [openRejectDialog, setOpenRejectDialog] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

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
      // response.data expected to be the stats object
      setStats(response.data);
      setMessage({ text: '', type: 'info' });
    } catch (error) {
      console.error('Error fetching stats:', error);
      if (error?.response?.status === 404) {
        setMessage({ text: 'El endpoint /api/admin/stats no está disponible en el servidor.', type: 'error' });
      } else if (error?.response?.status === 401 || error?.response?.status === 403) {
        setMessage({ text: 'No autorizado para ver estadísticas. Revisa token/roles.', type: 'error' });
      } else {
        setMessage({ text: 'Error al cargar las estadísticas.', type: 'error' });
      }
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
      console.error('Error fetching pending recharges:', error);
      setMessage({ text: 'Error al cargar recargas pendientes', type: 'error' });
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
      console.error('Error fetching routes:', error);
      setMessage({ text: 'Error al cargar las rutas', type: 'error' });
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
      console.error('Error fetching users:', error);
      setMessage({ text: 'Error al cargar la lista de usuarios. Asegúrate de tener permisos.', type: 'error' });
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

  // Detectar location.state.tab o query param ?tab=#
  useEffect(() => {
    // preferimos state.tab (puesto por el Header) y luego fallback a search param
    const sTab = location?.state?.tab;
    if (typeof sTab !== 'undefined' && sTab !== null) {
      const idx = Number(sTab);
      if (!Number.isNaN(idx)) {
        gotoTabAndScroll(idx);
        // limpiar state para evitar re-trigger al recargar
        navigate(location.pathname, { replace: true, state: {} });
        return;
      }
    }
    const params = new URLSearchParams(location.search);
    const q = params.get('tab');
    if (q) {
      const idx = Number(q);
      if (!Number.isNaN(idx)) gotoTabAndScroll(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.key]);

  // Handlers recargas
  const handleConfirmRecharge = async (rechargeId) => {
    setLoadingRechargeAction(rechargeId);
    try {
      await rechargeAPI.confirm(rechargeId);
      setMessage({ text: 'Recarga aprobada y saldo sumado exitosamente.', type: 'success' });
      setPendingRecharges(prev => prev.filter(r => r.id !== rechargeId));
      fetchStats();
    } catch (error) {
      console.error('Error confirming recharge:', error);
      setMessage({ text: error.response?.data?.error || 'Error al aprobar la recarga. Verifique la conexión.', type: 'error' });
    } finally {
      setLoadingRechargeAction(null);
    }
  };

  // ABRIR DIALOG RECHAZAR
  const handleOpenReject = (rechargeId) => {
    setRejectingId(rechargeId);
    setRejectReason('');
    setOpenRejectDialog(true);
  };
  const handleCloseReject = () => {
    setOpenRejectDialog(false);
    setRejectingId(null);
    setRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectReason || !rejectingId) {
      setMessage({ text: 'Agrega una razón para el rechazo.', type: 'warning' });
      return;
    }
    setRejectLoading(true);
    try {
      await rechargeAPI.reject(rejectingId, rejectReason);
      setPendingRecharges(prev => prev.filter(r => r.id !== rejectingId));
      setMessage({ text: 'Recarga rechazada y usuario notificado.', type: 'success' });
      await fetchStats();
      handleCloseReject();
    } catch (error) {
      console.error('Error rechazando recarga:', error);
      const serverMsg = error?.response?.data?.error || error?.response?.data?.message || error.message;
      setMessage({ text: serverMsg || 'Error al rechazar la recarga', type: 'error' });
    } finally {
      setRejectLoading(false);
    }
  };

  // Handlers usuarios
  const handleOpenUserModal = (user = null) => {
    setEditingUser(user);
    setUserFormError('');
    setOpenUserForm(true);
  };
  const handleCloseUserModal = () => {
    setOpenUserForm(false);
    setEditingUser(null);
  };

  // Crear/Actualizar usuario
  const handleUserSubmit = async (formData) => {
    setIsSubmittingUser(true);
    setUserFormError('');
    try {
      if (editingUser && editingUser.id) {
        await adminAPI.updateUser(editingUser.id, formData);
        setMessage({ text: 'Usuario actualizado exitosamente', type: 'success' });
        await fetchAllUsers();
        await fetchStats();
        handleCloseUserModal();
      } else {
        const roleToCreate = formData.role || 'driver';
        const payload = { ...formData, role: roleToCreate };
        let response = null;
        try {
          if (roleToCreate === 'admin') {
            response = await adminAPI.createUser(payload);
          } else {
            response = await adminAPI.createDriver(payload);
          }
        } catch (err) {
          throw err;
        }

        const created = response?.data;
        const createdId = created?.id || created?.user?.id || created?.userId || created?.data?.id || null;
        const createdRole = created?.role || created?.user?.role || created?.data?.role || null;

        // Usar la instancia `api` para comprobar header Authorization si es necesario
        const authHeader = api.defaults?.headers?.common?.['Authorization'];

        if (roleToCreate === 'admin' && createdRole && createdRole !== 'admin') {
          if (!authHeader) {
            setMessage({ text: 'Usuario creado, pero no hay token para asignar role admin automáticamente. Revisa sesión.', type: 'warning' });
          } else if (createdId) {
            try {
              await adminAPI.updateUser(createdId, { role: 'admin' });
              setMessage({ text: 'Administrador creado y role actualizado correctamente.', type: 'success' });
            } catch (updateErr) {
              console.warn('No se pudo actualizar role a admin:', updateErr);
              setMessage({ text: 'Usuario creado, pero el backend devolvió role distinto (no admin). No se pudo reasignar role automáticamente.', type: 'warning' });
            }
          } else {
            setMessage({ text: 'Usuario creado, pero backend devolvió role distinto y no se obtuvo id para actualizar.', type: 'warning' });
          }
        } else {
          setMessage({ text: roleToCreate === 'admin' ? 'Administrador creado exitosamente' : 'Conductor creado exitosamente', type: 'success' });
        }

        await fetchAllUsers();
        await fetchStats();
        handleCloseUserModal();
      }
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Error al guardar el usuario';
      setUserFormError(errMsg);
      setMessage({ text: errMsg, type: 'error' });
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
        console.error('Error deleting user:', error);
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
      console.error('Error al guardar ruta:', error);
      setRouteFormError(error.response?.data?.error || error.response?.data?.message || 'Error al guardar la ruta');
      setMessage({ text: error.response?.data?.error || 'Error al guardar la ruta', type: 'error' });
    } finally {
      setIsSubmittingRoute(false);
    }
  };

  // Helpers para filtrar por pestaña
  const drivers = users.filter(u => (u.role || '').toString().toLowerCase() === 'driver');
  const passengers = users.filter(u => {
    const r = (u.role || '').toString().toLowerCase();
    return r === 'passenger' || r === 'passengers' || r === 'user' || r === 'passenger_user';
  });
  const admins = users.filter(u => (u.role || '').toString().toLowerCase() === 'admin');
  const activeRoutes = routes.filter(r => r.is_active);

  // IMPORTANT: compute counts from current users/routes to avoid relying on potentially stale stats from backend
  const totalUsersCount = users.length;
  const driversCount = drivers.length;
  const passengersCount = passengers.length;
  const adminsCount = admins.length;
  const activeRoutesCount = activeRoutes.length;

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  // Navegar a sección de usuarios y abrir la pestaña adecuada
  const gotoTabAndScroll = (tabIndex) => {
    setSelectedTab(tabIndex);
    // hacer scroll suave al área de gestión de usuarios
    setTimeout(() => {
      const el = document.getElementById('user-management');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // RENDER
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Container maxWidth="xl" sx={{ pt: 4, pb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
            👨‍💼 Panel de Administración
          </Typography>

          {/* Botones principales (creación) separados y visibles */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenRouteModal(null)}>
              Crear Ruta
            </Button>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenUserModal(null)}>
              Crear Usuario
            </Button>
          </Box>
        </Box>

        {message.text && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage({ text: '', type: 'info' })}>
            {message.text}
          </Alert>
        )}

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
                              sx={{ mr: 1 }}
                            >
                              {loadingRechargeAction === r.id ? <CircularProgress size={20} color="inherit" /> : 'Aprobar'}
                            </Button>

                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              onClick={() => handleOpenReject(r.id)}
                            >
                              Rechazar
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
                {/* removed duplicate Crear Ruta button here (creation available on top) */}
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
                          <TableCell>{parseFloat(r.fare || 0).toFixed(2)}</TableCell>
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
                                onClick={() => {
                                  routeAPI.update(r.id, { ...r, is_active: !r.is_active })
                                    .then(() => { setMessage({ text: `Ruta ${r.is_active ? 'desactivada' : 'activada'}.`, type: 'success' }); fetchRoutes(); fetchStats(); })
                                    .catch(err => {
                                      console.error('Error updating route:', err);
                                      setMessage({ text: err?.response?.data?.error || 'Error al actualizar ruta', type: 'error' });
                                    });
                                }}
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
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Card sx={{ cursor: 'pointer' }} onClick={() => gotoTabAndScroll(1)}>
                      <CardContent>
                        <Typography color="textSecondary">Total Usuarios</Typography>
                        <Typography variant="h4">{totalUsersCount}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 },
                        transition: 'transform 0.15s ease'
                      }}
                      onClick={() => gotoTabAndScroll(0)}
                    >
                      <CardContent>
                        <Typography color="textSecondary">Conductores</Typography>
                        <Typography variant="h4">{driversCount}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 },
                        transition: 'transform 0.15s ease'
                      }}
                      onClick={() => gotoTabAndScroll(1)}
                    >
                      <CardContent>
                        <Typography color="textSecondary">Pasajeros</Typography>
                        <Typography variant="h4">{passengersCount}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Administradores - nueva tarjeta, igual que Pasajeros/Conductores */}
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 },
                        transition: 'transform 0.15s ease'
                      }}
                      onClick={() => gotoTabAndScroll(2)}
                    >
                      <CardContent>
                        <Typography color="textSecondary">Administradores</Typography>
                        <Typography variant="h4">{adminsCount}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary">Rutas Activas</Typography>
                        <Typography variant="h4">{activeRoutesCount}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>
            </>
          )}

          {/* ========================= */}
          {/* Balance diario por conductor */}
          <Grid item xs={12} sx={{ mt: 3 }}>
            <Paper sx={{ p: 2 }}>
              <DriverDailyBalances />
            </Paper>
          </Grid>
          {/* ========================= */}

          {/* Mostrar Gestión de Usuarios SOLO cuando se haya seleccionado una pestaña */}
          {selectedTab !== null && (
            <Grid item xs={12}>
              <Paper id="user-management" sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h5" gutterBottom color="primary">👥 Gestión de Usuarios</Typography>
                  {/* top "Crear Usuario" is the single source of creation, removed duplicates */}
                </Box>

                {/* SOLO mostrar Tabs y contenido cuando haya una pestaña seleccionada */}
                {selectedTab !== null && (
                  <>
                    <Tabs value={selectedTab} onChange={handleTabChange} sx={{ mb: 2 }}>
                      <Tab label="Conductores" value={0} />
                      <Tab label="Pasajeros" value={1} />
                      <Tab label="Administradores" value={2} />
                      <Tab label="Rutas Activas" value={3} />
                    </Tabs>

                    {/* Contenido según pestaña */}
                    {selectedTab === 0 && (
                      <>
                        {loadingUsers ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
                        ) : drivers.length === 0 ? (
                          <Typography color="text.secondary">No hay conductores registrados.</Typography>
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
                                {drivers.map((u) => (
                                  <TableRow key={u.id}>
                                    <TableCell>{u.id}</TableCell>
                                    <TableCell>{u.name}</TableCell>
                                    <TableCell>{u.email}</TableCell>
                                    <TableCell>
                                      <Chip
                                        label={(u.role || '').toString().toUpperCase()}
                                        color={u.role === 'admin' ? 'secondary' : u.role === 'driver' ? 'warning' : 'info'}
                                        size="small"
                                      />
                                    </TableCell>
                                    <TableCell>{parseFloat(u.balance || 0).toFixed(2)}</TableCell>
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
                      </>
                    )}

                    {selectedTab === 1 && (
                      <>
                        {loadingUsers ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
                        ) : passengers.length === 0 ? (
                          <Typography color="text.secondary">No hay pasajeros registrados.</Typography>
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
                                {passengers.map((u) => (
                                  <TableRow key={u.id}>
                                    <TableCell>{u.id}</TableCell>
                                    <TableCell>{u.name}</TableCell>
                                    <TableCell>{u.email}</TableCell>
                                    <TableCell>
                                      <Chip
                                        label={(u.role || '').toString().toUpperCase()}
                                        color={u.role === 'admin' ? 'secondary' : u.role === 'driver' ? 'warning' : 'info'}
                                        size="small"
                                      />
                                    </TableCell>
                                    <TableCell>{parseFloat(u.balance || 0).toFixed(2)}</TableCell>
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
                      </>
                    )}

                    {selectedTab === 2 && (
                      <>
                        {loadingUsers ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
                        ) : admins.length === 0 ? (
                          <Typography color="text.secondary">No hay administradores registrados.</Typography>
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
                                {admins.map((u) => (
                                  <TableRow key={u.id}>
                                    <TableCell>{u.id}</TableCell>
                                    <TableCell>{u.name}</TableCell>
                                    <TableCell>{u.email}</TableCell>
                                    <TableCell>
                                      <Chip
                                        label={(u.role || '').toString().toUpperCase()}
                                        color={u.role === 'admin' ? 'secondary' : u.role === 'driver' ? 'warning' : 'info'}
                                        size="small"
                                      />
                                    </TableCell>
                                    <TableCell>{parseFloat(u.balance || 0).toFixed(2)}</TableCell>
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
                      </>
                    )}

                    {selectedTab === 3 && (
                      <>
                        {loadingRoutes ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
                        ) : activeRoutes.length === 0 ? (
                          <Typography color="text.secondary">No hay rutas activas.</Typography>
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
                                {activeRoutes.map((r) => (
                                  <TableRow key={r.id}>
                                    <TableCell>{r.name}</TableCell>
                                    <TableCell>{parseFloat(r.fare || 0).toFixed(2)}</TableCell>
                                    <TableCell>
                                      <Chip label="Activa" color="success" size="small" />
                                    </TableCell>
                                    <TableCell align="right">
                                      <Tooltip title="Editar Ruta">
                                        <IconButton size="small" onClick={() => handleOpenRouteModal(r)}>
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Desactivar Ruta">
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            routeAPI.update(r.id, { ...r, is_active: false })
                                              .then(() => { setMessage({ text: 'Ruta desactivada.', type: 'success' }); fetchRoutes(); fetchStats(); })
                                              .catch(err => {
                                                console.error('Error deactivation route:', err);
                                                setMessage({ text: err?.response?.data?.error || 'Error al actualizar ruta', type: 'error' });
                                              });
                                          }}
                                        >
                                          <CloseIcon fontSize="small" color="error" />
                                        </IconButton>
                                      </Tooltip>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </>
                    )}
                  </>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>

        {/* Dialogs ... (RouteForm, UserForm, Reject) */}
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

        <Dialog open={openRejectDialog} onClose={handleCloseReject} maxWidth="sm" fullWidth>
          <DialogTitle>Rechazar Recarga</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Indica la razón del rechazo — esto será enviado al usuario como notificación.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Escribe la razón del rechazo..."
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
              <Button onClick={handleCloseReject} color="inherit">Cancelar</Button>
              <Button onClick={handleConfirmReject} variant="contained" color="error" disabled={rejectLoading}>
                {rejectLoading ? <CircularProgress size={18} color="inherit" /> : 'Confirmar Rechazo'}
              </Button>
            </Box>
          </DialogContent>
        </Dialog>

      </Container>
    </Box>
  );
};

export default AdminDashboard;