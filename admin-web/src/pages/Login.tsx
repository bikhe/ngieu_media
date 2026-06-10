import React, { useState } from 'react';
import { Card, TextField, Button, Typography, Container, Box, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        // Login flow
        const res = await api.post('token/', { username, password });
        localStorage.setItem('access', res.data.access);
        localStorage.setItem('refresh', res.data.refresh);
        toast.success('Успешный вход!');
        navigate('/');
      } else {
        // Registration flow
        if (!inviteCode.trim()) {
          toast.error('Введите инвайт-код');
          setLoading(false);
          return;
        }
        await api.post('register/', {
          username: username.trim(),
          password: password,
          invite_code: inviteCode.trim(),
        });
        toast.success('Регистрация успешна! Вход...');
        
        // Auto-login after registration
        const res = await api.post('token/', { username, password });
        localStorage.setItem('access', res.data.access);
        localStorage.setItem('refresh', res.data.refresh);
        navigate('/');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || (isLogin ? 'Неверный логин или пароль' : 'Ошибка при регистрации');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Toaster />
      <Card sx={{ p: 5, width: '100%', boxShadow: 4, borderRadius: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, textAlign: 'center', mb: 1 }}>СМИ НГИЭУ</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 4 }}>
          {isLogin ? 'Панель администратора' : 'Регистрация нового пользователя'}
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            variant="outlined"
            label="Логин"
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <TextField
            fullWidth
            variant="outlined"
            type="password"
            label="Пароль"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {!isLogin && (
            <TextField
              fullWidth
              variant="outlined"
              label="Инвайт-код (от администратора)"
              margin="normal"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
            />
          )}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 3, py: 1.5, fontWeight: 'bold' }}
          >
            {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
          </Button>
          
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Link
              component="button"
              variant="body2"
              onClick={(e) => {
                e.preventDefault();
                setIsLogin(!isLogin);
                setInviteCode('');
              }}
              sx={{ textDecoration: 'none' }}
            >
              {isLogin ? 'Нет аккаунта? Зарегистрироваться по коду' : 'Уже есть аккаунт? Войти'}
            </Link>
          </Box>
        </form>
      </Card>
    </Container>
  );
};

export default Login;