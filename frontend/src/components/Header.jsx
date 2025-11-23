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
import Divider from '@mui/material/Divider';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import List from '@mui/material/List';
import Badge from '@mui/material/Badge';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import GroupIcon from '@mui/icons-material/Group';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { notificationsAPI } from '../services/api';
import { useTheme } from '@mui/material/styles';

// Small inline SVG avatar fallback
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

const Header = () => {
  const theme = useTheme();
  const avatarBg = theme?.palette?.primary?.main || '#0b63a7';

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);

  const [avatarSrc, setAvatarSrc] = useState(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [notifToastOpen, setNotifToastOpen] = useState(false);
  const [notifToastMsg, setNotifToastMsg] = useState('');

  const lastShownNotifId = useRef(null);
  const shownPaymentIds = useRef(new Set());
  const shownMessages = useRef(new Set());

  useEffect(() => {
    if (location?.state && location.state.successMessage) {
      setSnackMsg(location.state.successMessage);
      setSnackOpen(true);
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

  const loadNotifs = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      setNotifsLoading(true);
      const res = await notificationsAPI.getForUser(20, true);
      const items = Array.isArray(res?.data) ? res.data : [];
      setNotifications(items);
      setUnreadCount(items.filter(i => !i.read).length);
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
    const iv = setInterval(loadNotifs, 10000);
    const handler = () => loadNotifs();
    window.addEventListener('notifications-updated', handler);
    return () => { clearInterval(iv); window.removeEventListener('notifications-updated', handler); };
  }, [loadNotifs]);

  // toast logic for payment notifications
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    const getNotifData = (n) => {
      let data = n.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { data = {}; }
      }
      return data || {};
    };

    const parseAmount = (raw) => {
      if (raw === undefined || raw === null) return 0;
      let v = raw;
      if (typeof v === 'object') v = v.amount ?? v.value ?? 0;
      if (typeof v === 'string') v = v.replace(',', '.').replace(/[^\d.-]/g, '');
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const getNotifAmount = (n) => parseAmount(getNotifData(n).amount ?? n.amount ?? getNotifData(n).value ?? 0);
    const getPaymentId = (n) => {
      const data = getNotifData(n);
      return data.payment_id ?? data.paymentId ?? data.id ?? null;
    };

    let latest = notifications.find(n => !n.read && getNotifAmount(n) > 0);
    if (!latest) latest = notifications.find(n => getNotifAmount(n) > 0);
    if (!latest) return;

    const paymentId = getPaymentId(latest);
    if (paymentId && shownPaymentIds.current.has(String(paymentId))) return;

    const amountNum = getNotifAmount(latest);
    const amountStr = amountNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const data = getNotifData(latest);
    const passengerName = data.passenger_name || data.name || latest.passenger_name || 'usuario';
    const title = latest.title || 'Nuevo pago';
    const message = `${title}: ${passengerName} - Bs ${amountStr}`;

    if (shownMessages.current.has(message)) return;

    if (paymentId) {
      shownPaymentIds.current.add(String(paymentId));
      setTimeout(() => shownPaymentIds.current.delete(String(paymentId)), 30000);
    }
    shownMessages.current.add(message);
    setTimeout(() => shownMessages.current.delete(message), 10000);

    if (lastShownNotifId.current === latest.id) return;
    lastShownNotifId.current = latest.id;

    setNotifToastMsg(message);
    setNotifToastOpen(true);
  }, [notifications]);

  const toggleDrawer = (v) => () => setOpen(v);
  const handleAvatarClick = (e) => setAnchorEl(e.currentTarget);
  const closeProfileMenu = () => setAnchorEl(null);
  const handleLogout = async () => { closeProfileMenu(); if (logout) await logout(); navigate('/'); };

  const handleBellClick = () => navigate('/notifications');

  const markReadLocal = async (id) => {
    try {
      const res = await notificationsAPI.markAsRead(id);
      const newCount = res?.data?.unread_count;
      if (typeof newCount === 'number') setUnreadCount(newCount);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      console.error('Error marcando notificación:', err);
    }
  };

  const handleImgError = (e) => { try { if (e && e.currentTarget) e.currentTarget.src = DEFAULT_AVATAR; } catch {} };

  // Drawer items => navigate to separate pages
  const menuItems = [
    { text: 'Inicio', icon: <HomeIcon />, action: () => { setOpen(false); navigate('/admin'); } },
    { text: 'Usuarios', icon: <PeopleIcon />, action: () => { setOpen(false); navigate('/admin/users'); } },
    { text: 'Conductores', icon: <GroupIcon />, action: () => { setOpen(false); navigate('/admin/drivers'); } },
    { text: 'Reportes', icon: <AssessmentIcon />, action: () => { setOpen(false); navigate('/admin/reports'); } },
    { text: 'Ajustes', icon: <SettingsIcon />, action: () => { setOpen(false); navigate('/admin/settings'); } }
  ];

  return (
    <>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton edge="start" color="inherit" onClick={toggleDrawer(true)} aria-label="menu" size="large">
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => navigate('/')}>
              RutaPay
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {user && (
              <IconButton color="inherit" onClick={handleBellClick} size="large" sx={{ mr: 1 }}>
                <Badge badgeContent={unreadCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            )}

            <IconButton color="inherit" onClick={handleAvatarClick} size="large" sx={{ p: 0 }}>
              <Avatar
                src={avatarSrc || DEFAULT_AVATAR}
                alt={user?.name || 'Usuario'}
                imgProps={{ onError: handleImgError, crossOrigin: 'anonymous' }}
                sx={{ bgcolor: avatarBg, width: 40, height: 40, fontWeight: 'bold', boxShadow: '0 2px 6px rgba(11,99,167,0.25)' }}
              />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={open} onClose={toggleDrawer(false)} PaperProps={{ sx: { width: 280, borderTopRightRadius: 8, borderBottomRightRadius: 8 } }}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Avatar sx={{ bgcolor: avatarBg, width: 56, height: 56, fontSize: 20, boxShadow: '0 2px 6px rgba(11,99,167,0.25)' }} src={avatarSrc || DEFAULT_AVATAR} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{user?.name || 'Administrador'}</Typography>
              <Typography variant="body2" color="text.secondary">{user?.email || 'admin@rutapay.com'}</Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 1 }} />

          <List>
            {menuItems.map(item => (
              <ListItemButton key={item.text} onClick={item.action} sx={{ borderRadius: 1, mb: 0.5 }}>
                <ListItemIcon sx={{ color: 'primary.main' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            ))}
          </List>

          <Divider sx={{ my: 1 }} />

          <List>
            {/* Removed "Mi perfil" per request — only keep Configuración and Cerrar sesión */}
            <ListItemButton onClick={() => { navigate('/admin/settings'); setOpen(false); }} sx={{ borderRadius: 1 }}>
              <ListItemIcon><SettingsIcon /></ListItemIcon>
              <ListItemText primary="Configuración" />
            </ListItemButton>

            <ListItemButton onClick={async () => { setOpen(false); await handleLogout(); }} sx={{ borderRadius: 1, mt: 1 }}>
              <ListItemIcon><ExitToAppIcon /></ListItemIcon>
              <ListItemText primary="Cerrar sesión" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      {/* Avatar menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeProfileMenu} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        {/* Removed "Mi perfil" menu item here too. Keep Ajustes and Cerrar sesión */}
        <MenuItem onClick={() => { closeProfileMenu(); navigate('/admin/settings'); }}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Ajustes</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><ExitToAppIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Cerrar sesión</ListItemText>
        </MenuItem>
      </Menu>

      {/* Snackbar messages */}
      <Snackbar open={snackOpen} autoHideDuration={3500} onClose={() => setSnackOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setSnackOpen(false)} severity="success" sx={{ width: '100%' }}>{snackMsg}</Alert>
      </Snackbar>

      <Snackbar open={notifToastOpen} autoHideDuration={5000} onClose={() => setNotifToastOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setNotifToastOpen(false)} severity="success" sx={{ width: '100%' }}>{notifToastMsg}</Alert>
      </Snackbar>
    </>
  );
};

export default Header;