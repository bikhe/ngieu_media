import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { Camera, Send } from 'lucide-react';
import { apiService } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  twaUser?: {
    id: number;
    username?: string;
    first_name: string;
    last_name?: string;
  } | null;
  initData?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLoginSuccess, 
  twaUser = null, 
  initData = '' 
}) => {
  const isTwaRegister = twaUser !== null;
  const [isLogin, setIsLogin] = useState(!isTwaRegister);
  const [username, setUsername] = useState(twaUser?.username || '');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Ошибка! Проверьте данные.');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    try {
      let success = false;
      if (isTwaRegister) {
        if (!inviteCode.trim()) {
          setErrorMessage('Введите инвайт-код.');
          setErrorOpen(true);
          setLoading(false);
          return;
        }
        success = await apiService.telegramRegister(
          username.trim(),
          inviteCode.trim(),
          initData
        );
        if (!success) {
          setErrorMessage('Ошибка регистрации. Проверьте инвайт-код или имя пользователя.');
        }
      } else {
        if (!password.trim()) {
          setLoading(false);
          return;
        }
        if (isLogin) {
          success = await apiService.login(username.trim(), password.trim());
        } else {
          if (!inviteCode.trim()) {
            setLoading(false);
            return;
          }
          success = await apiService.register(
            username.trim(),
            password.trim(),
            inviteCode.trim()
          );
          if (success) {
            success = await apiService.login(username.trim(), password.trim());
          } else {
            setErrorMessage('Ошибка регистрации. Возможно, неверный код инвайта.');
          }
        }
      }

      if (success) {
        onLoginSuccess();
      } else {
        setErrorOpen(true);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Ошибка соединения с сервером.');
      setErrorOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 2,
          p: 3,
          borderRadius: 4,
          bgcolor: 'background.paper',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease-out',
        }}
      >
        {/* Logo Icon */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'action.selected',
              color: 'primary.main',
            }}
          >
            {isTwaRegister ? <Send size={44} /> : <Camera size={44} />}
          </Box>
        </Box>

        {isTwaRegister ? (
          <>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }} gutterBottom color="text.primary">
              Привет, {twaUser.first_name}!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Твой Telegram-аккаунт еще не подключен к системе Media Events. 
              Введите инвайт-код, выданный администратором, чтобы зарегистрироваться.
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }} gutterBottom color="text.primary">
              Media Events
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {isLogin ? 'Вход в рабочий кабинет медиацентра' : 'Регистрация нового исполнителя'}
            </Typography>
          </>
        )}

        <TextField
          label="Имя пользователя (логин)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          fullWidth
          variant="outlined"
          autoComplete="username"
        />

        {!isTwaRegister && (
          <TextField
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            variant="outlined"
            autoComplete="current-password"
          />
        )}

        {(isTwaRegister || !isLogin) && (
          <TextField
            label="Инвайт-код"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
            fullWidth
            variant="outlined"
            helperText={isTwaRegister ? "Код определяет вашу роль в системе" : ""}
          />
        )}

        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{
            py: 1.5,
            mt: 1,
            borderRadius: 2.5,
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
        >
          {loading ? (
            <CircularProgress size={24} color="inherit" />
          ) : isTwaRegister ? (
            'ПОДТВЕРДИТЬ И ВОЙТИ'
          ) : isLogin ? (
            'ВОЙТИ'
          ) : (
            'ЗАРЕГИСТРИРОВАТЬСЯ'
          )}
        </Button>

        {!isTwaRegister && (
          <Button
            variant="text"
            onClick={() => {
              setIsLogin(!isLogin);
              setInviteCode('');
            }}
            disabled={loading}
            sx={{ textTransform: 'none', mt: 0.5 }}
          >
            {isLogin ? 'Нет аккаунта? Нужен код!' : 'Уже есть аккаунт? Войти'}
          </Button>
        )}
      </Box>

      {/* Error notification */}
      <Snackbar
        open={errorOpen}
        autoHideDuration={4000}
        onClose={() => setErrorOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setErrorOpen(false)} severity="error" variant="filled" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default LoginScreen;
