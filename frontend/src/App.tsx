import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

import LoginScreen from './components/LoginScreen';
import MainLayout from './layouts/MainLayout';

import { apiService } from './services/api';
import { ThemeSettingsProvider } from './theme/ThemeSettingsContext';
import { SetupWizardModal } from './theme/SetupWizardModal';

// Admin pages and the mobile home screen are split into separate chunks
// to keep the entry bundle small.
const HomeScreen = lazy(() => import('./components/HomeScreen'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'));
const AdminWarehouse = lazy(() => import('./pages/admin/Warehouse'));
const AdminUsersManagement = lazy(() => import('./pages/admin/UsersManagement'));

interface TelegramWebAppUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: TelegramWebAppUser };
  ready(): void;
  expand(): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const RequireAuth = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const me = await apiService.getUserMe();
        if (me && me.id) {
          setIsAuth(true);
          setIsAdmin(Boolean(
            me.role === 'MAIN_ADMIN' || me.is_staff || me.is_superuser ||
            me.can_approve_events || me.can_manage_warehouse || me.can_view_all_events
          ));
        }
      } catch (err) {
        // 401 — no valid session cookie; the user stays unauthenticated.
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

const IndexPage = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const me = await apiService.getUserMe();
        if (me && me.id) {
          setIsAdmin(Boolean(
            me.role === 'MAIN_ADMIN' || me.is_staff || me.is_superuser ||
            me.can_approve_events || me.can_manage_warehouse || me.can_view_all_events
          ));
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

function AppContent() {
  const tg = window.Telegram?.WebApp;
  const isTWA = !!(tg && tg.initData);

  const [globalLoading, setGlobalLoading] = useState(true);
  const [twaUser, setTwaUser] = useState<TelegramWebAppUser | null>(null);

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
          if (!loginRes) {
            const unsafeUser = tg.initDataUnsafe?.user;
            if (unsafeUser) {
              setTwaUser(unsafeUser);
            }
          } else {
            setTwaUser({
              id: loginRes.id,
              username: loginRes.username,
              first_name: loginRes.first_name || '',
              last_name: loginRes.last_name,
            });
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
      <Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
          </Box>
        }
      >
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
      </Suspense>
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
