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
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { USER_ROLES } from '../utils/constants';

// tiny util: si la URL es relativa la convierte a absoluta
const normalizeAvatarUrl = (url) => {
  if (!url) return null;
  try {
    // si ya es absoluta, URL constructor funciona
    new URL(url);
    return url;
  } catch {
    // ruta relativa -> convertir a absoluta usando origin
    if (url.startsWith('/')) return `${window.location.origin}${url}`;
    return `${window.location.origin}/${url}`;
  }
};

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const showDrawer = [USER_ROLES.DRIVER, USER_ROLES.PASSENGER].includes(user?.role);

  const toggleDrawer = (v) => () => setOpen(v);

  const handleNavigate = (path) => {
    setOpen(false);
    navigate(path);
  };

  // estado local para el src del avatar; garantizamos re-render cuando user cambia
  const [avatarSrc, setAvatarSrc] = useState(null);

  useEffect(() => {
    // reconstruir avatarSrc cuando cambie user o su id/avatar
    const tmpKeyPerUser = user?.id ? `tmpAvatarUrl_${user.id}` : null;
    const tmpPerUser = (typeof window !== 'undefined' && tmpKeyPerUser) ? localStorage.getItem(tmpKeyPerUser) : null;
    const tmpGlobal = (typeof window !== 'undefined') ? localStorage.getItem('tmpAvatarUrl') : null;

    // prioridad: user.avatar (venido desde backend) -> tmpPerUser -> tmpGlobal -> null
    const candidate = user?.avatar || tmpPerUser || tmpGlobal || null;
    setAvatarSrc(normalizeAvatarUrl(candidate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.avatar]); // sólo depender de id y avatar para mantener estable la reactividad

  const handleAvatarClick = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleCloseMenu = () => setAnchorEl(null);

  const handleLogout = async () => {
    handleCloseMenu();
    try {
      if (typeof logout === 'function') await logout();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      navigate('/');
    }
  };

  return (
    <>
      <AppBar position="static" color="primary">
        <Toolbar>
          {showDrawer ? (
            <IconButton edge="start" color="inherit" aria-label="menu" onClick={toggleDrawer(true)} size="large">
              <MenuIcon />
            </IconButton>
          ) : (
            <Box sx={{ width: 48 }} />
          )}

          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
              RutaPay
            </Typography>
          </Box>

          <IconButton color="inherit" onClick={handleAvatarClick} size="large">
            {avatarSrc ? <Avatar src={avatarSrc} alt={user?.name} /> : <Avatar>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</Avatar>}
          </IconButton>
        </Toolbar>
      </AppBar>

      {showDrawer && (
        <Drawer anchor="left" open={open} onClose={toggleDrawer(false)}>
          <Box sx={{ width: 260 }} role="presentation" onClick={toggleDrawer(false)} onKeyDown={toggleDrawer(false)}>
            <List>
              <ListItem button onClick={() => handleNavigate('/')}>
                <ListItemIcon><HomeIcon /></ListItemIcon>
                <ListItemText primary="Inicio" />
              </ListItem>

              <ListItem button onClick={() => handleNavigate('/settings')}>
                <ListItemIcon><SettingsIcon /></ListItemIcon>
                <ListItemText primary="Ajustes" />
              </ListItem>
              {/* NO hay botón 'Cerrar sesión' aquí */}
            </List>
          </Box>
        </Drawer>
      )}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
        <MenuItem onClick={() => { handleCloseMenu(); navigate('/settings'); }}>Ajustes</MenuItem>
        <MenuItem onClick={handleLogout}>Cerrar sesión</MenuItem>
      </Menu>
    </>
  );
};

export default Header;