import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import Badge from '@mui/material/Badge';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { notificationsAPI } from '../services/api';

// Inline SVG fallback avatar (no archivos externos)
const DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 24 24'>
     <rect width='100%' height='100%' fill='#e7eef3' rx='6'/>
     <g transform='translate(3,2)' fill='#41555f'>
       <circle cx='9' cy='6' r='4'/>
       <path d='M0 18c0-3.3 6.9-5 9-5s9 1.7 9 5v1H0v-1z'/>
     </g>
  </svg>`
)}`;

const normalizeAvatarUrl = (url) => {
  if (!url) return null;
  try {
    new URL(url);
    return url;
  } catch {
    if (typeof url === 'string' && url.startsWith('/')) return `${window.location.origin}${url}`;
    return url;
  }
};

// Helper para parsear amount seguro y formatearlo
const parseAmount = (raw) => {
  if (raw === undefined || raw === null) return 0;
  let v = raw;
  if (typeof v === 'object') {
    // si viene en un objeto sorpresa, intenta extraer .amount
    v = v.amount ?? v.value ?? 0;
  }
  if (typeof v === 'string') {
    v = v.replace(',', '.').replace(/[^\d.-]/g, '');
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  // Notifications state (works both for driver and passenger)
  const [anchorNotif, setAnchorNotif] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);

  const [avatarSrc, setAvatarSrc] = useState(null);

  // Snackbar for global messages (reads location.state.successMessage)
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');

  // Snackbar específico para notificaciones entrantes
  const [notifToastOpen, setNotifToastOpen] = useState(false);
  const [notifToastMsg, setNotifToastMsg] = useState('');

  // Dedupe helpers:
  // - lastShownNotifId previene repetir por id de notificación
  const lastShownNotifId = useRef(null);
  // - shownPaymentIds previene mostrar 2 toasts para el mismo payment (si existe payment_id)
  const shownPaymentIds = useRef(new Set());
  // - shownMessages previene mostrar el mismo texto varias veces (por ejemplo si otro componente también muestra)
  const shownMessages = useRef(new Set());

  useEffect(() => {
    // If navigation included a successMessage in state, show it
    if (location?.state && location.state.successMessage) {
      setSnackMsg(location.state.successMessage);
      setSnackOpen(true);
      // replace history entry to clear state so message doesn't reappear on refresh/back
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state]);

  useEffect(() => {
    const tmpKeyPerUser = user?.id ? `tmpAvatarUrl_${user.id}` : null;
    const tmpPerUser = tmpKeyPerUser ? localStorage.getItem(tmpKeyPerUser) : null;
    const tmpGlobal = localStorage.getItem('tmpAvatarUrl');
    const candidate = user?.avatar || tmpPerUser || tmpGlobal || null;
    setAvatarSrc(normalizeAvatarUrl(candidate) || null);
  }, [user?.id, user?.avatar]);

  // carga de notificaciones — ahora usamos el endpoint común /api/notifications
  const loadNotifs = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      setNotifsLoading(true);
      // Pedimos solo no leídas para badge/preview
      const res = await notificationsAPI.getForUser(20, true);
      const items = Array.isArray(res?.data) ? res.data : [];
      setNotifications(items);
      const unread = items.filter(i => !i.read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.warn('Header: error loading notifications', err);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotifsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifs();
    // actualizar periódicamente
    const iv = setInterval(loadNotifs, 10000);
    // escuchar evento disparado por NotificationsPage después de marcar leída
    const handler = () => loadNotifs();
    window.addEventListener('notifications-updated', handler);
    return () => { clearInterval(iv); window.removeEventListener('notifications-updated', handler); };
  }, [loadNotifs]);

  // Nuevo: mostrar toast emergente SOLO si hay una notificación NO LEÍDA o reciente que tenga amount > 0
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    // Helper para extraer amount numérico desde la notificación (data ó amount)
    const getNotifData = (n) => {
      let data = n.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { data = {}; }
      }
      return data || {};
    };

    const getNotifAmount = (n) => {
      const data = getNotifData(n);
      return parseAmount(data.amount ?? n.amount ?? data.value ?? 0);
    };

    const getPaymentId = (n) => {
      const data = getNotifData(n);
      return data.payment_id ?? data.paymentId ?? data.id ?? null;
    };

    // 1) Buscar la última notificación NO LEÍDA con amount > 0
    let latest = notifications.find(n => !n.read && getNotifAmount(n) > 0);

    // 2) Si ninguna no-leída con amount>0, buscar la más reciente con amount>0 (aunque esté leída)
    if (!latest) {
      latest = notifications.find(n => getNotifAmount(n) > 0);
    }

    // 3) Si aún no hay notificación con amount>0, no mostramos nada
    if (!latest) return;

    // 4) Dedupe por payment_id si existe
    const paymentId = getPaymentId(latest);
    if (paymentId && shownPaymentIds.current.has(String(paymentId))) {
      // Ya mostramos una notificación para este payment_id -> ignora
      return;
    }

    // 5) Construir mensaje y dedupe por texto
    const amountNum = getNotifAmount(latest);
    const amountStr = amountNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const data = getNotifData(latest);
    const passengerName = data.passenger_name || data.name || latest.passenger_name || 'usuario';
    const title = latest.title || 'Nuevo pago';
    const message = `${title}: ${passengerName} - Bs ${amountStr}`;

    if (shownMessages.current.has(message)) {
      // ya mostramos exactamente ese mensaje recientemente -> ignora
      return;
    }

    // Marcar como mostrado para evitar duplicados:
    if (paymentId) {
      shownPaymentIds.current.add(String(paymentId));
      // limpiar después de 30s (evita crecer indefinidamente)
      setTimeout(() => shownPaymentIds.current.delete(String(paymentId)), 30000);
    }
    shownMessages.current.add(message);
    setTimeout(() => shownMessages.current.delete(message), 10000);

    // Evitar repetir la misma notificación por id
    if (lastShownNotifId.current === latest.id) return;
    lastShownNotifId.current = latest.id;

    // Mostrar snackbar/toast
    setNotifToastMsg(message);
    setNotifToastOpen(true);
    // no marcamos como leída automáticamente; el usuario puede abrir la campana y leer
  }, [notifications]);

  const toggleDrawer = (v) => () => setOpen(v);
  const nav = (p) => { setOpen(false); navigate(p); };
  const handleAvatarClick = (e) => setAnchorEl(e.currentTarget);
  const closeProfileMenu = () => setAnchorEl(null);
  const handleLogout = async () => { closeProfileMenu(); if (logout) await logout(); navigate('/'); };

  // cuando se hace click en la campana, abrimos la página completa de notificaciones
  const handleBellClick = () => navigate('/notifications');

  // marcar como leída llamando al endpoint y disparar evento global para refrescar header/pages
  const markReadLocal = async (id) => {
    try {
      const res = await notificationsAPI.markAsRead(id);
      const newCount = res?.data?.unread_count;
      // actualizar badge localmente si backend devolvió unread_count
      if (typeof newCount === 'number') setUnreadCount(newCount);
      // actualizar listado local si lo tenemos (marcar read)
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
      // notificar al resto de la app para que recargue si es necesario
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      console.error('Error marcando notificación:', err);
    }
  };

  const handleImgError = (e) => {
    try { if (e && e.currentTarget) e.currentTarget.src = DEFAULT_AVATAR; } catch {}
  };

  return (
    <>
      <AppBar position="static" color="primary">
        <Toolbar>
          <IconButton edge="start" color="inherit" aria-label="menu" onClick={toggleDrawer(true)} size="large">
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>RutaPay</Typography>
          </Box>

          {user && (
            <IconButton color="inherit" onClick={handleBellClick} size="large" sx={{ mr: 1 }}>
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          )}

          <IconButton color="inherit" onClick={handleAvatarClick} size="large">
            {avatarSrc ? (
              <Avatar
                src={avatarSrc}
                alt={user?.name || 'Usuario'}
                imgProps={{ onError: handleImgError, crossOrigin: 'anonymous' }}
              />
            ) : (
              <Avatar>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</Avatar>
            )}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={open} onClose={toggleDrawer(false)}>
        <Box sx={{ width: 260 }} role="presentation" onClick={toggleDrawer(false)} onKeyDown={toggleDrawer(false)}>
          <List>
            <ListItem button onClick={() => nav('/')}>
              <ListItemIcon><HomeIcon /></ListItemIcon>
              <ListItemText primary="Inicio" />
            </ListItem>
            <ListItem button onClick={() => nav('/settings')}>
              <ListItemIcon><SettingsIcon /></ListItemIcon>
              <ListItemText primary="Ajustes" />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* (Legacy) menu de notificaciones: se mantiene para compatibilidad, pero la campana ahora abre /notifications */}
      <Menu anchorEl={anchorNotif} open={Boolean(anchorNotif)} onClose={() => setAnchorNotif(null)} PaperProps={{ style: { maxHeight: 320, width: 360, padding: 0 } }}>
        {notifsLoading ? <Box sx={{ display:'flex', justifyContent:'center', p:2 }}><CircularProgress size={20} /></Box> :
          (notifications.length === 0 ? <MenuItem disabled>No hay notificaciones</MenuItem> :
            notifications.map(n => (
              <MenuItem key={n.id} onClick={() => { if (!n.read) markReadLocal(n.id); setAnchorNotif(null); }} sx={{ whiteSpace: 'normal', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{n.title || 'Evento'}</Typography>
                  <Typography variant="body2" color="text.secondary">{n.body}</Typography>
                  <Typography variant="caption" color="text.secondary">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</Typography>
                </Box>
              </MenuItem>
            ))
          )
        }
      </Menu>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeProfileMenu}>
        <MenuItem onClick={() => { closeProfileMenu(); navigate('/settings'); }}>Ajustes</MenuItem>
        <MenuItem onClick={handleLogout}>Cerrar sesión</MenuItem>
      </Menu>

      {/* Global Snackbar for success messages passed via navigation state */}
      <Snackbar open={snackOpen} autoHideDuration={3500} onClose={() => setSnackOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setSnackOpen(false)} severity="success" sx={{ width: '100%' }}>
          {snackMsg}
        </Alert>
      </Snackbar>

      {/* Snackbar específico para notificación emergente (toast) */}
      <Snackbar open={notifToastOpen} autoHideDuration={5000} onClose={() => setNotifToastOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setNotifToastOpen(false)} severity="success" sx={{ width: '100%' }}>
          {notifToastMsg}
        </Alert>
      </Snackbar>
    </>
  );
};

export default Header;