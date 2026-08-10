import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

import LoginScreen from './components/LoginScreen';
import HomeScreen from './components/HomeScreen';
import MainLayout from './layouts/MainLayout';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminAnalytics from './pages/admin/Analytics';
import AdminWarehouse from './pages/admin/Warehouse';
import AdminUsersManagement from './pages/admin/UsersManagement';

import { apiService } from './services/api';
import { ThemeSettingsProvider } from './theme/ThemeSettingsContext';
import { SetupWizardModal } from './theme/SetupWizardModal';

// Require Auth Wrapper
const RequireAuth = ({ children, requireAdmin = false }: { children: JSX.Element, requireAdmin?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const hasToken = localStorage.getItem('access') !== null;
      if (!hasToken) {
        setLoading(false);
        return;
      }

      try {
        const me = await apiService.getUserMe();
        if (me && me.id) {
          setIsAuth(true);
          setIsAdmin(me.role === 'MAIN_ADMIN' || me.is_staff || me.is_superuser);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Dynamic Index Page based on role
const IndexPage = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const me = await apiService.getUserMe();
        if (me && me.id) {
          setIsAdmin(me.role === 'MAIN_ADMIN' || me.is_staff || me.is_superuser);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRole();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return isAdmin ? <AdminDashboard /> : <HomeScreen />;
};

// Initial App Content
function AppContent() {
  const tg = (window as any).Telegram?.WebApp;
  const isTWA = !!(tg && tg.initData);

  const [globalLoading, setGlobalLoading] = useState(true);
  const [twaUser, setTwaUser] = useState<any>(null);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, [tg]);

  useEffect(() => {
    const autoLogin = async () => {
      if (isTWA) {
        try {
          const loginRes = await apiService.telegramLogin(tg.initData);
          if (!loginRes || !loginRes.access) {
            const unsafeUser = tg.initDataUnsafe?.user;
            if (unsafeUser) {
              setTwaUser(unsafeUser);
            }
          }
        } catch (err) {
          console.error('TWA auto-login failed:', err);
        }
      }
      setGlobalLoading(false);
    };

    autoLogin();
  }, [isTWA, tg]);

  if (globalLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Загрузка платформы...
        </Typography>
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <SetupWizardModal />
      <Routes>
        <Route path="/login" element={<LoginScreen onLoginSuccess={() => window.location.href = '/'} twaUser={twaUser} initData={tg?.initData} />} />
        
        <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
          {/* Dynamic dashboard for all */}
          <Route index element={<IndexPage />} />
          
          {/* Admin routes */}
          <Route path="analytics" element={<RequireAuth requireAdmin><AdminAnalytics /></RequireAuth>} />
          <Route path="warehouse" element={<RequireAuth requireAdmin><AdminWarehouse /></RequireAuth>} />
          <Route path="users" element={<RequireAuth requireAdmin><AdminUsersManagement /></RequireAuth>} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeSettingsProvider>
      <AppContent />
    </ThemeSettingsProvider>
  );
}

export default App;
