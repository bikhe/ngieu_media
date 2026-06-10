import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  Box, Container, Typography, Card, Button, AppBar, Toolbar, Avatar, IconButton, Chip, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, MenuItem, Select,
  FormControl, InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, TablePagination
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  ArrowBack as ArrowBackIcon, Brightness4 as Brightness4Icon, Brightness7 as Brightness7Icon,
  Person as PersonIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon
} from '@mui/icons-material';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';
import { ColorModeContext } from '../App';
import { useUpdatesBroker } from '../services/useUpdatesBroker';

const ROLES: Record<string, string> = {
  MAIN_ADMIN: 'Администратор',
  MEDIA: 'СМИ',
  ORGANIZER: 'Организатор'
};

const ROLE_COLORS: Record<string, 'error' | 'warning' | 'primary'> = {
  MAIN_ADMIN: 'error',
  ORGANIZER: 'warning',
  MEDIA: 'primary'
};

const SKILLS: Record<string, string> = {
  ANY: 'Любой',
  PRO: 'Профи',
  VIDEO: 'Видеограф',
  DRONE: 'Дрон'
};

const UsersManagement = () => {
  const { mode, toggleColorMode, brandName } = useContext(ColorModeContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // User Form Modal State
  const [modal, setModal] = useState({ open: false, id: null as number | null });
  const [form, setForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'ORGANIZER',
    skill_level: 'ANY',
    telegram_id: ''
  });

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);

  const fetchUsers = useCallback(async (p: number, rpp: number, search: string = '') => {
    try {
      const params: any = { page: p + 1, page_size: rpp };
      // Backend search can be simulated or sent if supported. 
      // But we can filter on the client or let backend handle standard filtering if configured.
      const res = await api.get('users/', { params });
      
      let fetchedUsers = [];
      let count = 0;
      if (res.data.results !== undefined) {
        fetchedUsers = res.data.results;
        count = res.data.count;
      } else {
        fetchedUsers = res.data;
        count = res.data.length;
      }

      // Local filter for search query
      if (search.trim()) {
        const query = search.toLowerCase();
        fetchedUsers = fetchedUsers.filter((u: any) => 
          u.username.toLowerCase().includes(query) ||
          (u.first_name || '').toLowerCase().includes(query) ||
          (u.last_name || '').toLowerCase().includes(query) ||
          (u.telegram_id || '').toLowerCase().includes(query)
        );
        count = fetchedUsers.length;
      }

      setUsers(fetchedUsers);
      setTotalUsers(count);
    } catch (err) {
      console.error(err);
      toast.error("Ошибка загрузки пользователей");
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const uRes = await api.get('users/me/');
      if (uRes.data.role !== 'MAIN_ADMIN') {
        toast.error("Доступ разрешен только администраторам");
        navigate('/');
        return;
      }
      setUser(uRes.data);
      await fetchUsers(page, rowsPerPage, searchQuery);
    } catch (error: any) {
      toast.error("Ошибка загрузки данных пользователей");
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, rowsPerPage]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchUsers(page, rowsPerPage, val);
  };

  // Real-time updates broker integration
  useUpdatesBroker(['user'], () => {
    fetchUsers(page, rowsPerPage, searchQuery);
  });

  const handleOpenModal = (item?: any) => {
    if (item) {
      setForm({
        username: item.username,
        password: '',
        first_name: item.first_name || '',
        last_name: item.last_name || '',
        role: item.role,
        skill_level: item.skill_level || 'ANY',
        telegram_id: item.telegram_id || ''
      });
      setModal({ open: true, id: item.id });
    } else {
      setForm({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'ORGANIZER',
        skill_level: 'ANY',
        telegram_id: ''
      });
      setModal({ open: true, id: null });
    }
  };

  const handleSaveUser = async () => {
    if (!form.username.trim()) {
      toast.error("Логин не может быть пустым");
      return;
    }
    if (!modal.id && !form.password.trim()) {
      toast.error("Пароль обязателен для нового пользователя");
      return;
    }

    try {
      const payload: any = { ...form };
      if (!payload.password) {
        delete payload.password;
      }
      if (modal.id) {
        await api.patch(`users/${modal.id}/`, payload);
        toast.success("Пользователь обновлен");
      } else {
        await api.post('users/', payload);
        toast.success("Пользователь создан");
      }
      setModal({ open: false, id: null });
      fetchUsers(page, rowsPerPage, searchQuery);
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.username?.[0] || "Ошибка сохранения";
      toast.error(errMsg);
    }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (id === user?.id) {
      toast.error("Вы не можете удалить свою собственную учетную запись");
      return;
    }
    if (!window.confirm(`Вы уверены, что хотите удалить пользователя "${username}"?`)) return;
    try {
      await api.delete(`users/${id}/`);
      toast.success("Пользователь успешно удален");
      fetchUsers(page, rowsPerPage, searchQuery);
    } catch {
      toast.error("Не удалось удалить пользователя");
    }
  };

  if (loading && !user) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 5 }}>
      <Toaster />

      {/* AppBar */}
      <AppBar position="sticky" elevation={4}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 900 }}>
            {brandName} — Управление пользователями
          </Typography>
          <IconButton onClick={toggleColorMode} color="inherit">
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {/* Header section */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 4, gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>Учетные записи</Typography>
            <Typography variant="subtitle2" color="text.secondary">
              Просмотр, создание, изменение ролей и удаление аккаунтов пользователей системы
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>
            Создать пользователя
          </Button>
        </Box>

        {/* Search filter */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <TextField
            fullWidth
            size="small"
            label="Поиск по имени, логину или Telegram ID"
            variant="outlined"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </Paper>

        {/* Users Table */}
        <Card sx={{ p: 3, boxShadow: '0 4px 20px 0 rgba(0,0,0,0.05)' }}>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table>
              <TableHead sx={{ bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Пользователь</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Логин</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Роль</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Telegram ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Уровень СМИ</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length > 0 ? (
                  users.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Avatar sx={{ bgcolor: 'action.selected', color: 'primary.main', width: 36, height: 36 }}>
                            <PersonIcon fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {`${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Имя не указано'}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{item.username}</TableCell>
                      <TableCell>
                        <Chip
                          label={ROLES[item.role] || item.role}
                          color={ROLE_COLORS[item.role] || 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{item.telegram_id || '—'}</TableCell>
                      <TableCell>
                        {item.role === 'MEDIA' ? (
                          <Chip label={SKILLS[item.skill_level] || item.skill_level} size="small" variant="outlined" />
                        ) : (
                          <Typography variant="caption" color="text.disabled">Не применимо</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                          <IconButton size="small" color="primary" onClick={() => handleOpenModal(item)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={item.id === user?.id}
                            onClick={() => handleDeleteUser(item.id, item.username)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        Пользователи не найдены
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalUsers}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => {
              setPage(newPage);
            }}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Строк на странице:"
          />
        </Card>
      </Container>

      {/* User CRUD Dialog */}
      <Dialog open={modal.open} onClose={() => setModal({ open: false, id: null })} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>
          {modal.id ? 'Редактировать пользователя' : 'Создать пользователя'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Логин (имя пользователя)"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />

            <TextField
              fullWidth
              type="password"
              label={modal.id ? "Новый пароль (оставьте пустым для сохранения старого)" : "Пароль"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Имя"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
              <TextField
                fullWidth
                label="Фамилия"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Роль</InputLabel>
                <Select
                  value={form.role}
                  label="Роль"
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {Object.entries(ROLES).map(([key, label]) => (
                    <MenuItem key={key} value={key}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={form.role !== 'MEDIA'}>
                <InputLabel>Уровень СМИ</InputLabel>
                <Select
                  value={form.skill_level}
                  label="Уровень СМИ"
                  onChange={(e) => setForm({ ...form, skill_level: e.target.value })}
                >
                  {Object.entries(SKILLS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <TextField
              fullWidth
              label="Telegram ID"
              value={form.telegram_id}
              onChange={(e) => setForm({ ...form, telegram_id: e.target.value })}
              helperText="Для отправки уведомлений телеграм-ботом"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModal({ open: false, id: null })}>Отмена</Button>
          <Button variant="contained" onClick={handleSaveUser}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersManagement;
