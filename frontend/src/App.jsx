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
import DriverPayments from './pages/DriverPayments';

// Importa las páginas nuevas que el Header usa (créalas si aún no existen)
import UsersPage from './pages/UsersPage';
import DriversPage from './pages/DriversPage';
import Reports from './pages/Reports';

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
    // normalize role strings
    const roleNormalized = String(user.role || '').toLowerCase();
    const allowedNormalized = allowed.map(a => String(a || '').toLowerCase());
    if (!allowedNormalized.includes(roleNormalized)) {
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
            
            {/* Ruta del administrador (panel principal) */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />

            {/* Rutas administrativas separadas (para que los enlaces del Header no hagan 404) */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="admin">
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/drivers"
              element={
                <ProtectedRoute requiredRole="admin">
                  <DriversPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin payments path (maps to admin dashboard to avoid 404 if header links here) */}
            <Route
              path="/admin/payments"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Driver payments (separate page) */}
            <Route
              path="/driver/payments"
              element={
                <ProtectedRoute requiredRole="driver">
                  <DriverPayments />
                </ProtectedRoute>
              }
            />

            {/* Página de Ajustes - accesible solo para conductor y pasajero (tu ruta original) */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredRole={['driver', 'passenger']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Notificaciones (cualquier usuario autenticado) */}
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