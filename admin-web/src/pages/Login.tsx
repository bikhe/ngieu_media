import React, { useState } from 'react';
import { Card, TextField, Button, Typography, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/token/', { username, password });
      localStorage.setItem('access', res.data.access);
      localStorage.setItem('refresh', res.data.refresh);
      toast.success('Успешный вход!');
      navigate('/');
    } catch (err) {
      toast.error('Неверный логин или пароль');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Toaster />
      <Card sx={{ p: 5, width: '100%', boxShadow: 4, borderRadius: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, textAlign: 'center', mb: 1 }}>СМИ НГИЭУ</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 4 }}>Панель администратора</Typography>
        <form onSubmit={handleLogin}>
          <TextField fullWidth variant="outlined" label="Логин" margin="normal" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <TextField fullWidth variant="outlined" type="password" label="Пароль" margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button fullWidth type="submit" variant="contained" size="large" sx={{ mt: 3, py: 1.5, fontWeight: 'bold' }}>Войти</Button>
        </form>
      </Card>
    </Container>
  );
};

export default Login;