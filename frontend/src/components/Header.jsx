import React, { useState, useEffect, useCallback } from 'react';
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
    </>
  );
};

export default Header;