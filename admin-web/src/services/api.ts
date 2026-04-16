import axios from 'axios';

const api = axios.create({
  // Замени на IP своего сервера при деплое
  baseURL: 'localhost:8000/api',
});

// Перехватчик: перед каждым запросом достаем токен из памяти и приклеиваем его
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Перехватчик ошибок (если токен протух - выкидываем на логин)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;