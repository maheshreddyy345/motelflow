import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Layout/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reservations from './pages/Reservations';
import Rooms from './pages/Rooms';
import Housekeeping from './pages/Housekeeping';
import TapeChart from './pages/TapeChart';
import FolioPage from './pages/FolioPage';
import Reports from './pages/Reports';
import NightAudit from './pages/NightAudit';
import './index.css';

// Protected Route wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Layout wrapper with sidebar
const AppLayout = ({ children }) => {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

// Main App component
const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={['owner', 'manager', 'frontdesk']}>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reservations"
        element={
          <ProtectedRoute allowedRoles={['owner', 'manager', 'frontdesk']}>
            <AppLayout>
              <Reservations />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/folio/:id"
        element={
          <ProtectedRoute allowedRoles={['owner', 'manager', 'frontdesk']}>
            <AppLayout>
              <FolioPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/rooms"
        element={
          <ProtectedRoute allowedRoles={['owner', 'manager', 'frontdesk']}>
            <AppLayout>
              <Rooms />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/housekeeping"
        element={
          <ProtectedRoute allowedRoles={['owner', 'manager', 'frontdesk', 'housekeeping']}>
            <AppLayout>
              <Housekeeping />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tape-chart"
        element={
          <ProtectedRoute allowedRoles={['owner', 'manager', 'frontdesk']}>
            <AppLayout>
              <TapeChart />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['owner', 'manager']}>
            <AppLayout>
              <Reports />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/night-audit"
        element={
          <ProtectedRoute allowedRoles={['owner', 'manager']}>
            <AppLayout>
              <NightAudit />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
