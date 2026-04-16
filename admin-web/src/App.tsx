import React, { useState, useMemo, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

// Импортируем наши страницы
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Создаем контекст для глобальных настроек (тема и бренд)
export const ColorModeContext = createContext({ 
  mode: 'light', 
  toggleColorMode: () => {},
  brandName: 'СМИ НГИЭУ',
  // Классная нейтральная иконка камеры из публичного доступа
  logoUrl: 'https://cdn-icons-png.flaticon.com/512/3003/3003310.png' 
});

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const colorMode = useMemo(() => ({
    mode,
    toggleColorMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
    brandName: 'СМИ НГИЭУ',
    logoUrl: 'https://cdn-icons-png.flaticon.com/512/3003/3003310.png'
  }), [mode]);

  // Настройка палитры MUI
  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#1976d2' },
      secondary: { main: '#ff9800' },
      background: { default: mode === 'light' ? '#f5f7fa' : '#121212' },
    },
    typography: { fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' },
    shape: { borderRadius: 12 },
  }), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline /> {/* Сбрасывает дефолтные отступы браузера */}
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Если пользователь зашел на корень "/", отправляем его в Dashboard. 
                Внутри Dashboard (в useEffect) есть защита: если токена нет, его выкинет обратно на /login */}
            <Route path="/" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;