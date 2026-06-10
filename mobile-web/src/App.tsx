import { useState, useEffect } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import LoginScreen from './components/LoginScreen';
import HomeScreen from './components/HomeScreen';
import { apiService } from './services/api';

// Create a premium, Telegram Web App (TWA) theme dynamically or fallback to default dark mode
const getTelegramTheme = () => {
  const tg = (window as any).Telegram?.WebApp;
  const themeParams = tg?.themeParams || {};
  const isDark = tg?.colorScheme === 'dark' || tg?.colorScheme === undefined; // default to dark if not in TWA

  return createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: themeParams.button_color || '#2563eb',
        contrastText: themeParams.button_text_color || '#ffffff',
      },
      background: {
        default: themeParams.bg_color || (isDark ? '#0f172a' : '#f8fafc'),
        paper: themeParams.secondary_bg_color || (isDark ? '#1e293b' : '#ffffff'),
      },
      text: {
        primary: themeParams.text_color || (isDark ? '#f8fafc' : '#0f172a'),
        secondary: themeParams.hint_color || (isDark ? '#94a3b8' : '#64748b'),
      },
      action: {
        active: themeParams.link_color || '#3b82f6',
        hover: 'rgba(59, 130, 246, 0.08)',
        selected: 'rgba(59, 130, 246, 0.16)',
      },
      divider: 'rgba(148, 163, 184, 0.12)',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h5: {
        fontFamily: '"Inter", sans-serif',
        letterSpacing: '-0.025em',
      },
      h6: {
        fontFamily: '"Inter", sans-serif',
        letterSpacing: '-0.025em',
      },
      body1: {
        letterSpacing: '-0.011em',
      },
      body2: {
        letterSpacing: '-0.011em',
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            fontWeight: 600,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'rgba(148, 163, 184, 0.2)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(148, 163, 184, 0.4)',
              },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          },
        },
      },
    },
  });
};

function App() {
  const tg = (window as any).Telegram?.WebApp;
  const isTWA = !!(tg && tg.initData);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [twaUser, setTwaUser] = useState<any>(null);
  const [initTheme, setInitTheme] = useState(getTelegramTheme());

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      
      const handleThemeChange = () => {
        setInitTheme(getTelegramTheme());
      };
      tg.onEvent('themeChanged', handleThemeChange);
      return () => {
        tg.offEvent('themeChanged', handleThemeChange);
      };
    }
  }, [tg]);

  useEffect(() => {
    const autoLogin = async () => {
      if (isTWA) {
        setLoading(true);
        try {
          const loginRes = await apiService.telegramLogin(tg.initData);
          if (loginRes && loginRes.access) {
            setIsLoggedIn(true);
          } else {
            const unsafeUser = tg.initDataUnsafe?.user;
            if (unsafeUser) {
              setTwaUser(unsafeUser);
            }
          }
        } catch (err) {
          console.error('TWA auto-login failed:', err);
        } finally {
          setLoading(false);
        }
      } else {
        const hasToken = localStorage.getItem('access') !== null;
        setIsLoggedIn(hasToken);
        setLoading(false);
      }
    };

    autoLogin();
  }, [isTWA, tg]);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  if (loading) {
    return (
      <ThemeProvider theme={initTheme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 2 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Авторизация в Бирже СМИ...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={initTheme}>
      <CssBaseline />
      {isLoggedIn ? (
        <HomeScreen />
      ) : (
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess} 
          twaUser={twaUser} 
          initData={tg?.initData} 
        />
      )}
    </ThemeProvider>
  );
}

export default App;
