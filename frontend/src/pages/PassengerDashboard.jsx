import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Paper, Typography, Button, Box, Card, CardContent, Grid, Alert, Chip, 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress, Divider,
  // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody 
  // --- FIN DE LA CORRECCIÓN ---
} from '@mui/material';
import { Phone, LocationOn, PersonPinCircle } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
// ¡Importamos la nueva paymentAPI!
import { routeAPI, tripAPI, rechargeAPI, paymentAPI } from '../services/api'; 

const PassengerDashboard = () => {
  const { user, fetchAndUpdateUser } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);

  // --- ¡NUEVOS ESTADOS PARA EL PAGO! ---
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [driverCode, setDriverCode] = useState(''); // El código que tipea el pasajero
  const [paymentError, setPaymentError] = useState('');

  // Estados para recarga
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeDate, setRechargeDate] = useState('');
  const [rechargeRef, setRechargeRef] = useState('');
  const [rechargeMsg, setRechargeMsg] = useState({ text: '', type: 'info' });

  // Cargar rutas
  const fetchRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const response = await routeAPI.getAll();
      if (response.data && response.data.length > 0) {
        setRoutes(response.data);
      } else {
        setMessage('No hay rutas disponibles en este momento.');
      }
    } catch (error) {
      console.error('Error fetching routes:', error);
      setMessage('Error de conexión al cargar las rutas.');
    } finally {
      setLoadingRoutes(false);
    }
  }, []);

  // Cargar historial de viajes
  const fetchPassengerTrips = useCallback(async () => {
    try {
      const response = await tripAPI.getPassengerTrips();
      setTrips(response.data);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
    fetchPassengerTrips();
    
    // Polling para el historial de pagos
    const interval = setInterval(() => {
      fetchPassengerTrips();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchRoutes, fetchPassengerTrips]);

  // --- Lógica para el modal de recarga ---
  const handleSendRecharge = async () => {
    if (!rechargeAmount || !rechargeDate || !rechargeRef) {
      setRechargeMsg({ text: "Completa todos los campos.", type: 'error' });
      return;
    }
    setLoadingAction(true);
    setRechargeMsg({ text: '', type: 'info' });
    try {
      await rechargeAPI.create({
        amount: rechargeAmount,
        date: rechargeDate,
        reference: rechargeRef,
      });
      setRechargeMsg({ text: 'Recarga enviada para verificación.', type: 'success' });
      setTimeout(() => {
        setShowRecharge(false);
        setRechargeAmount('');
        setRechargeDate('');
        setRechargeRef('');
        setRechargeMsg({ text: '', type: 'info' });
      }, 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error enviando la recarga.';
      setRechargeMsg({ text: errorMsg, type: 'error' });
    } finally {
      setLoadingAction(false);
    }
  };
  
  // ==================================================================
  // ¡LÓGICA DE PAGO MODIFICADA!
  // ==================================================================
  
  // 1. Al hacer clic en la tarjeta de ruta, abrimos el modal de pago
  const handleOpenPaymentDialog = (route) => {
    // Verificamos si tiene saldo ANTES de abrir el modal de pago
    if (user && parseFloat(user.balance) < parseFloat(route.fare)) {
        setMessage('Saldo insuficiente para pagar esta ruta. Por favor, recarga.');
        setTimeout(() => setMessage(''), 4000);
        return;
    }
    setSelectedRoute(route);
    setPaymentDialogOpen(true);
    setPaymentError(''); 
    setDriverCode(''); 
  };
  
  const closePaymentDialog = () => {
    setPaymentDialogOpen(false);
    setSelectedRoute(null);
  };

  // 2. Al confirmar el pago en el modal
  const handleExecutePayment = async () => {
    if (!selectedRoute || !driverCode) {
        setPaymentError('Debes ingresar el código del conductor.');
        return;
    }
    
    setLoadingAction(true);
    setPaymentError('');
    
    try {
      // Usamos la nueva API de pago
      await paymentAPI.executePayment({
        route_id: selectedRoute.id,
        driver_code: driverCode
      });
      
      setMessage('¡Pago realizado exitosamente!');
      
      // Actualizamos el saldo e historial inmediatamente
      await fetchPassengerTrips();
      await fetchAndUpdateUser(); // Esto refresca el saldo en el header y en este dashboard
      
      closePaymentDialog();

    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Error al procesar el pago.';
      setPaymentError(errorMsg); // Mostramos el error DENTRO del modal
    } finally {
      setLoadingAction(false);
    }
  };

  // --- Funciones de ayuda para estilos ---
  const getStatusColor = (status) => ({
    pending: 'warning',
    in_progress: 'primary',
    completed: 'success',
  }[status] || 'default');
  
  const getStatusText = (status) => ({
    pending: 'Pendiente',
    in_progress: 'En camino',
    completed: 'Completado',
  }[status] || status);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
        {message && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
        
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
          Bienvenido, {user?.name || 'Pasajero'}
        </Typography>

        <Grid container spacing={3}>
          {/* --- Columna Izquierda: Saldo e Información --- */}
          <Grid item xs={12} md={4}>
            {/* Tarjeta de Saldo */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom color="text.secondary">Saldo Disponible</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
                <Typography variant="h3" color="primary.main" sx={{ fontWeight: 700 }}>
                  {user?.balance ? parseFloat(user.balance).toFixed(2) : '0.00'}
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ ml: 1 }}>Bs</Typography>
              </Box>
              <Button 
                variant="contained" 
                color="secondary" 
                size="large"
                fullWidth 
                onClick={() => setShowRecharge(true)}
              >
                Recargar Saldo
              </Button>
            </Paper>

            {/* Tarjeta de Información de la Asociación */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                Asociación Civil Propatria 23 de Enero, Silencio
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 2 }}>
                <LocationOn color="action" />
                <Box sx={{ ml: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Nuestra Dirección</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Propatria, al frente de la plaza Lisandro Alvarado, diagonal a la iglesia la Sagrada Familia.
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Phone color="action" />
                <Box sx={{ ml: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Contáctanos</Typography>
                  <Typography variant="body2" color="text.secondary">Efrain Rodriguez: 0424-1682423</Typography>
                  <Typography variant="body2" color="text.secondary">Lia Vilera: 0414-2962797</Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* --- Columna Derecha: Rutas e Historial --- */}
          <Grid item xs={12} md={8}>
            {/* Tarjetas de Rutas para Pagar */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h5" gutterBottom>🚗 Pagar Viaje</Typography>
              {loadingRoutes ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>
              ) : routes.length > 0 ? (
                <Grid container spacing={2}>
                  {routes.map((route) => (
                    <Grid item xs={12} sm={6} key={route.id}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" gutterBottom>{route.name}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                            <PersonPinCircle sx={{ fontSize: '1rem', mr: 1 }} color="success" /> 
                            <strong>Desde:</strong> {route.start_point}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                            <LocationOn sx={{ fontSize: '1rem', mr: 1 }} color="error" /> 
                            <strong>Hasta:</strong> {route.end_point}
                          </Typography>
                        </CardContent>
                        <Box sx={{ p: 2, pt: 0, mt: 'auto' }}>
                          <Typography variant="h5" color="primary" sx={{ textAlign: 'center', mb: 2, fontWeight: 600 }}>
                            {parseFloat(route.fare).toFixed(2)} Bs
                          </Typography>
                          
                          <Button 
                            variant="contained" 
                            color="primary"
                            fullWidth 
                            size="large" 
                            onClick={() => handleOpenPaymentDialog(route)} 
                            disabled={loadingAction || (user && parseFloat(user.balance) < parseFloat(route.fare))}
                          >
                            Pagar Viaje
                          </Button>
                          
                          {user && parseFloat(user.balance) < parseFloat(route.fare) && (
                            <Typography variant="caption" color="error" display="block" align="center" sx={{mt: 1}}>
                              Saldo insuficiente
                            </Typography>
                          )}
                        </Box>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography>No hay rutas disponibles.</Typography>
              )}
            </Paper>

            {/* Historial de Viajes (Pagos) */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>📋 Historial de Pagos</Typography>
              {trips.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Ruta</TableCell>
                        <TableCell>Conductor</TableCell>
                        <TableCell align="right">Monto Pagado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {trips.map((trip) => (
                        <TableRow key={trip.id}>
                          <TableCell>{new Date(trip.created_at).toLocaleString()}</TableCell>
                          <TableCell>{trip.route_name}</TableCell>
                          <TableCell>{trip.driver_name || 'N/A'}</TableCell>
                          <TableCell align="right">
                            <Typography color="error.main" sx={{ fontWeight: 'bold' }}>
                              -{parseFloat(trip.fare).toFixed(2)} Bs
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary">No has realizado ningún pago todavía.</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* --- MODAL DE RECARGA DE SALDO --- */}
        <Dialog open={showRecharge} onClose={() => setShowRecharge(false)}>
          <DialogTitle>Recargar Saldo - Pago Móvil</DialogTitle>
          <DialogContent>
            <Typography variant="body2" gutterBottom>
              <b>Datos de Pago Móvil:</b><br/>
              Banco: Banco de Venezuela<br/>
              Cédula/RIF: V-12345678<br/>
              Teléfono: 0414-1234567<br/>
              <hr/>
            </Typography>
            <TextField label="Monto (Bs)" type="number" fullWidth margin="dense" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} />
            <TextField label="Fecha del Pago" type="date" fullWidth margin="dense" InputLabelProps={{ shrink: true }} value={rechargeDate} onChange={e => setRechargeDate(e.target.value)} />
            <TextField label="Referencia del Pago" fullWidth margin="dense" value={rechargeRef} onChange={e => setRechargeRef(e.target.value)} />
            {rechargeMsg.text && <Alert severity={rechargeMsg.type} sx={{ mt: 2 }}>{rechargeMsg.text}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowRecharge(false)} disabled={loadingAction}>Cancelar</Button>
            <Button variant="contained" onClick={handleSendRecharge} disabled={loadingAction} color="secondary">
              {loadingAction ? 'Enviando...' : 'Enviar Recarga'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* --- ¡NUEVO! MODAL DE PAGO (REEMPLAZA AL DE "CONFIRMAR VIAJE") --- */}
        <Dialog open={paymentDialogOpen} onClose={closePaymentDialog} fullWidth maxWidth="xs">
          <DialogTitle>Realizar Pago</DialogTitle>
          <DialogContent>
            {selectedRoute && (
              <>
                <Typography variant="h6">{selectedRoute.name}</Typography>
                <Typography>Monto a Pagar: <strong>{parseFloat(selectedRoute.fare).toFixed(2)} Bs</strong></Typography>
                <Typography color="text.secondary" variant="body2" sx={{mb: 2}}>
                  Saldo actual: {user?.balance ? parseFloat(user.balance).toFixed(2) : '0.00'} Bs
                </Typography>
                
                <TextField 
                  label="Código del Conductor" 
                  fullWidth 
                  margin="dense" 
                  value={driverCode}
                  onChange={e => setDriverCode(e.target.value)}
                  helperText="Ingresa el código que te muestra el conductor."
                  autoFocus
                />
              </>
            )}
            {paymentError && <Alert severity="error" sx={{ mt: 2 }}>{paymentError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={closePaymentDialog} disabled={loadingAction}>Cancelar</Button>
            <Button onClick={handleExecutePayment} variant="contained" disabled={loadingAction}>
              {loadingAction ? 'Pagando...' : 'Confirmar Pago'}
            </Button>
          </DialogActions>
        </Dialog>
        
      </Container>
    </Box>
  );
};

export default PassengerDashboard;