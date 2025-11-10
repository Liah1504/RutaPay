import React, { useEffect, useState } from 'react';
import { Container, Paper, Typography, List, ListItem, ListItemText, Divider, Button } from '@mui/material';
import { notificationsAPI } from '../services/api';
import Header from '../components/Header';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await notificationsAPI.getForUser(50);
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Error cargando notifs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Error marcando leída', err);
    }
  };

  return (
    <>
      <Header />
      <Container maxWidth="md" sx={{ mt: 3 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Notificaciones</Typography>
          {loading ? <div>Cargando...</div> : (
            notifications.length === 0 ? <Typography color="text.secondary">No hay notificaciones.</Typography> :
            <List>
              {notifications.map(n => (
                <React.Fragment key={n.id}>
                  <ListItem alignItems="flex-start" sx={{ bgcolor: n.read ? 'transparent' : 'rgba(33,150,243,0.04)' }}>
                    <ListItemText
                      primary={<strong>{n.title}</strong>}
                      secondary={<>{n.body}<div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div></>}
                    />
                    {!n.read && <Button size="small" onClick={() => markRead(n.id)}>Marcar leída</Button>}
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
        </Paper>
      </Container>
    </>
  );
}