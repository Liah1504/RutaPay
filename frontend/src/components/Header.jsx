import React, { useState } from 'react';
import { AppBar, Toolbar, IconButton, Typography, Avatar, Drawer, List, ListItem, ListItemIcon, ListItemText, Box, Menu, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { USER_ROLES } from '../utils/constants';

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

  // Avatar src: prioridad a backend (user.avatar) luego tmpAvatarUrl temporal
  const tmpAvatar = (typeof window !== 'undefined') ? localStorage.getItem('tmpAvatarUrl') : null;
  const avatarSrc = user?.avatar || tmpAvatar || null;

  // Admin: abrir menu en avatar click
  const handleAvatarClick = (e) => {
    if (user?.role === USER_ROLES.ADMIN) {
      setAnchorEl(e.currentTarget);
    } else {
      // driver/passenger: ir a settings
      navigate('/settings');
    }
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

              <ListItem button onClick={() => { if (typeof logout === 'function') logout(); navigate('/login'); }}>
                <ListItemIcon><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Cerrar sesión" />
              </ListItem>
            </List>
          </Box>
        </Drawer>
      )}

      {/* Menu para admin sobre avatar */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
        <MenuItem onClick={() => { handleCloseMenu(); navigate('/settings'); }}>Ajustes</MenuItem>
        <MenuItem onClick={handleLogout}>Cerrar sesión</MenuItem>
      </Menu>
    </>
  );
};

export default Header;