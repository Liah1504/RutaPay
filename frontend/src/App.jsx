import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import PassengerDashboard from './pages/PassengerDashboard';
import DriverDashboard from './pages/DriverDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SettingsPage from './pages/SettingsPage';
import NotificationsPage from './pages/Notifications';

// Componente para rutas protegidas
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        🔄 Cargando...
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // requiredRole puede ser string o array de strings
  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }
  
  return children;
};

// Componente para redirección automática según el rol
const RoleBasedRedirect = () => {
  const { user } = useAuth();
  
  if (user?.role === 'driver') {
    return <Navigate to="/driver" replace />;
  } else if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  } else {
    // Por defecto o rol 'passenger'
    return <Navigate to="/passenger" replace />;
  }
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Ruta principal - redirige automáticamente según el rol */}
            <Route path="/" element={<RoleBasedRedirect />} />
            
            {/* Ruta del pasajero */}
            <Route 
              path="/passenger" 
              element={
                <ProtectedRoute requiredRole="passenger">
                  <PassengerDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Ruta del conductor */}
            <Route 
              path="/driver" 
              element={
                <ProtectedRoute requiredRole="driver">
                  <DriverDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Ruta del administrador */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Página de Ajustes - accesible solo para conductor y pasajero (según tu petición) */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredRole={['driver', 'passenger']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Nueva: Notificaciones (cualquier usuario autenticado) */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />

            {/* Rutas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Ruta 404 - para cualquier otra ruta */}
            <Route 
              path="*" 
              element={
                <div style={{ 
                  textAlign: 'center', 
                  padding: '50px',
                  fontSize: '18px'
                }}>
                  <h1>404 - Página no encontrada</h1>
                  <p>La página que buscas no existe.</p>
                  <a href="/">Volver al inicio</a>
                </div>
              } 
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;