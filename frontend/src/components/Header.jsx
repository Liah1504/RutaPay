import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { driverAPI } from '../services/api';

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
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const [anchorNotif, setAnchorNotif] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);

  const [avatarSrc, setAvatarSrc] = useState(null);

  useEffect(() => {
    const tmpKeyPerUser = user?.id ? `tmpAvatarUrl_${user.id}` : null;
    const tmpPerUser = tmpKeyPerUser ? localStorage.getItem(tmpKeyPerUser) : null;
    const tmpGlobal = localStorage.getItem('tmpAvatarUrl');
    const candidate = user?.avatar || tmpPerUser || tmpGlobal || null;
    setAvatarSrc(normalizeAvatarUrl(candidate) || null);
  }, [user?.id, user?.avatar]);

  useEffect(() => {
    let mounted = true;
    const loadNotifs = async () => {
      if (!user || user.role !== 'driver') {
        if (mounted) { setNotifications([]); setUnreadCount(0); }
        return;
      }
      try {
        setNotifsLoading(true);
        const res = await driverAPI.getNotifications(6);
        if (!mounted) return;
        const items = Array.isArray(res?.data) ? res.data : [];
        setNotifications(items);
        const unread = items.filter(i => i && i.read === false).length || items.length;
        setUnreadCount(unread);
      } catch (err) {
        console.warn('Header: error loading notifications', err);
      } finally {
        if (mounted) setNotifsLoading(false);
      }
    };
    loadNotifs();
    return () => { mounted = false; };
  }, [user?.id, user?.role]);

  const toggleDrawer = (v) => () => setOpen(v);
  const nav = (p) => { setOpen(false); navigate(p); };
  const handleAvatarClick = (e) => setAnchorEl(e.currentTarget);
  const closeProfileMenu = () => setAnchorEl(null);
  const handleLogout = async () => { closeProfileMenu(); if (logout) await logout(); navigate('/'); };

  const openNotifs = (e) => setAnchorNotif(e.currentTarget);
  const closeNotifs = () => setAnchorNotif(null);
  const markReadLocal = (id) => { setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n))); setUnreadCount(c => Math.max(0, c-1)); };

  const handleImgError = (e) => {
    // si falla la carga, poner fallback inline
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

          {user?.role === 'driver' && (
            <IconButton color="inherit" onClick={openNotifs} size="large" sx={{ mr: 1 }}>
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

      <Menu anchorEl={anchorNotif} open={Boolean(anchorNotif)} onClose={closeNotifs} PaperProps={{ style: { maxHeight: 320, width: 360, padding: 0 } }}>
        {notifsLoading ? <Box sx={{ display:'flex', justifyContent:'center', p:2 }}><CircularProgress size={20} /></Box> :
          (notifications.length === 0 ? <MenuItem disabled>No hay notificaciones</MenuItem> :
            notifications.map(n => (
              <MenuItem key={n.id} onClick={() => { if (!n.read) markReadLocal(n.id); closeNotifs(); }} sx={{ whiteSpace: 'normal', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{n.passenger_name || n.title || 'Evento'}</Typography>
                  <Typography variant="body2" color="text.secondary">{n.route_name ? `${n.route_name} • ` : ''}{n.amount ? `Bs ${parseFloat(n.amount).toFixed(2)}` : ''}</Typography>
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
    </>
  );
};

export default Header;