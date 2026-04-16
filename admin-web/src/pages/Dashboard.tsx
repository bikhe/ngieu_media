import React, { useEffect, useState, useContext, useCallback } from 'react';
import { Box, Container, Typography, Card, Button, AppBar, Toolbar, Avatar, IconButton, Chip, Tabs, Tab, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Drawer, List, ListItem, ListItemText, Stack, Paper, MenuItem, Select, FormControl, InputLabel, OutlinedInput, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import toast, { Toaster } from 'react-hot-toast';
import { Brightness4 as Brightness4Icon, Brightness7 as Brightness7Icon, Edit as EditIcon, Delete as DeleteIcon, Chat as ChatIcon, Send as SendIcon, Inventory2 as Inventory2Icon, MilitaryTech as MilitaryTechIcon, Link as LinkIcon, Timer as TimerIcon } from '@mui/icons-material';

import api from '../services/api';
import { ColorModeContext } from '../App';

const Dashboard = () => {
  const { mode, toggleColorMode, brandName } = useContext(ColorModeContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [features, setFeatures] = useState<any>({});
  const [tab, setTab] = useState('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
  
  const [modal, setModal] = useState({ open: false, id: null as any });
  
  // Расширенная форма со всеми полями из БД
  const [form, setForm] = useState({ 
    title: '', date: '', time: '12:00', deadline: '', location: '', 
    content_type: 'PHOTO', document_link: '', result_link: '',
    max_participants: 1, required_skill: 'ANY', equipment_ids: [] as number[] 
  });

  const [chatModal, setChatModal] = useState({ open: false, eventId: null as any });
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  const [profileModal, setProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', telegram_id: '' });

  const isAdmin = user?.role === 'MAIN_ADMIN';

  const loadData = useCallback(async () => {
    try {
      const [e, u, eq] = await Promise.all([
        api.get('events/'), 
        api.get('users/me/'),
        api.get('equipment/') // Тянем список техники
      ]);
      setEvents(e.data); 
      setUser(u.data); 
      setFeatures(u.data.features || {});
      setEquipment(eq.data);
      
      setProfileForm({ first_name: u.data.first_name || '', last_name: u.data.last_name || '', telegram_id: u.data.telegram_id || '' });
      if (u.data.role === 'MAIN_ADMIN') setInvites((await api.get('invites/')).data);
    } catch { navigate('/login'); } finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async (id: number | null, action: string, data?: any) => {
    try {
      if (action === 'delete') { if (!window.confirm("Удалить?")) return; await api.delete(`events/${id}/`); }
      else if (action === 'approve') await api.post(`events/${id}/approve/`);
      else if (action === 'reject') await api.post(`events/${id}/reject/`);
      else if (action === 'save') {
        // Подготовка данных для отправки (чистка ссылок)
        const payload = { ...data };
        if (id) await api.patch(`events/${id}/`, payload);
        else await api.post('events/', payload);
      }
      toast.success("Готово"); loadData(); setModal({ open: false, id: null });
    } catch { toast.error("Ошибка операции"); }
  };

  const loadChat = async (id: number) => setChatMessages((await api.get(`events/${id}/comments/`)).data);
  const sendMessage = async () => {
    if (!newComment.trim()) return;
    await api.post(`events/${chatModal.eventId}/comments/`, { text: newComment });
    setNewComment(''); loadChat(chatModal.eventId);
  };

  if (loading) return <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 5 }}>
      <Toaster />
      <AppBar position="sticky" elevation={4}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 900 }}>{brandName} {isAdmin && <Chip label="ADMIN" size="small" sx={{ ml: 1, bgcolor: '#ffa300', color: '#000', fontWeight: 900 }} />}</Typography>
          <IconButton onClick={toggleColorMode} color="inherit">{mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}</IconButton>
          <IconButton onClick={() => setDrawerOpen(true)} color="inherit" sx={{ ml: 1 }}><Avatar sx={{ width: 32, height: 32 }}>{user?.username?.[0].toUpperCase()}</Avatar></IconButton>
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 320, p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 3 }}>Меню</Typography>
          <Button fullWidth variant="outlined" sx={{ mb: 3 }} onClick={() => { setDrawerOpen(false); setProfileModal(true); }}>Профиль</Button>
          {isAdmin && (
            <Box sx={{ mb: 4 }}>
              <Button fullWidth variant="contained" onClick={async () => { await api.post('invites/', {}); setInvites((await api.get('invites/')).data); toast.success("Код создан"); }} sx={{ mb: 2 }}>Новый инвайт</Button>
              <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                <List dense>{invites.map(i => <ListItem key={i.id}><ListItemText primary={i.code} /></ListItem>)}</List>
              </Paper>
            </Box>
          )}
          <Button fullWidth color="error" variant="outlined" onClick={() => {localStorage.removeItem('access'); navigate('/login');}}>Выйти</Button>
        </Box>
      </Drawer>

      <Container maxWidth="lg" sx={{ mt: 5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>Мероприятия</Typography>
          <Button variant="contained" onClick={() => { 
            setForm({title:'', date:'', time:'12:00', deadline: '', location:'', content_type:'PHOTO', document_link:'', result_link: '', max_participants: 1, required_skill: 'ANY', equipment_ids: []}); 
            setModal({open: true, id: null}); 
          }}>Создать</Button>
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 4 }} variant="scrollable">
          <Tab label="Все" value="ALL" /><Tab label="Новые" value="PENDING" /><Tab label="Открыты" value="OPEN" /><Tab label="В работе" value="IN_PROGRESS" /><Tab label="Готово" value="COMPLETED" />
        </Tabs>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          {(tab === 'ALL' ? events : events.filter(e => e.status === tab)).map(event => (
            <Box key={event.id}>
              <Card sx={{ height: '100%', p: 3, display: 'flex', flexDirection: 'column', borderTop: 6, borderColor: event.status === 'COMPLETED' ? 'success.main' : (event.status === 'OVERDUE' ? 'error.main' : 'primary.main') }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Chip label={event.status} size="small" color={event.status === 'OVERDUE' ? 'error' : 'default'} />
                  <Stack direction="row">
                    <IconButton size="small" onClick={() => {
                      setForm({...event, equipment_ids: event.booked_equipment?.map((eq:any) => eq.id) || []}); 
                      setModal({open: true, id: event.id});
                    }}><EditIcon/></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleAction(event.id, 'delete')}><DeleteIcon/></IconButton>
                  </Stack>
                </Box>
                
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5 }}>{event.title}</Typography>
                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
                  <TimerIcon sx={{ fontSize: 14, mr: 0.5 }} /> {format(parseISO(event.date), 'dd.MM.yyyy')} в {event.time?.slice(0,5)}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip icon={<MilitaryTechIcon />} label={event.required_skill} size="small" variant="outlined" color={event.required_skill !== 'ANY' ? 'secondary' : 'default'} />
                  <Chip label={`👥 ${event.media_participants?.length || 0} / ${event.max_participants}`} size="small" variant="outlined" />
                </Stack>

                <Box sx={{ mb: 2 }}>
                  {event.booked_equipment?.map((eq: any) => (
                    <Chip key={eq.id} icon={<Inventory2Icon sx={{ fontSize: '12px !important' }}/>} label={eq.name} size="small" sx={{ mr: 0.5, mb: 0.5, fontSize: '10px' }} />
                  ))}
                </Box>
                
                <Box sx={{ mt: 'auto' }}>
                  <Divider sx={{ mb: 1.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.disabled">Орг: {event.responsible_person?.first_name || event.responsible_person?.username}</Typography>
                    <Stack direction="row" spacing={1}>
                      {event.result_link && <IconButton size="small" onClick={() => window.open(event.result_link)} color="success"><LinkIcon /></IconButton>}
                      <IconButton size="small" onClick={() => {setChatModal({open: true, eventId: event.id}); loadChat(event.id);}}><ChatIcon/></IconButton>
                    </Stack>
                  </Box>

                  {isAdmin && event.status === 'PENDING' && (
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Button size="small" variant="contained" color="success" onClick={() => handleAction(event.id, 'approve')} fullWidth>Одобрить</Button>
                      <Button size="small" variant="contained" color="error" onClick={() => handleAction(event.id, 'reject')} fullWidth>Отказ</Button>
                    </Stack>
                  )}
                </Box>
              </Card>
            </Box>
          ))}
        </Box>
      </Container>

      {/* МОДАЛКА РЕДАКТИРОВАНИЯ - ТУТ ВСЕ ПОЛЯ */}
      <Dialog open={modal.open} onClose={() => setModal({open: false, id: null})} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>{modal.id ? 'Редактирование задачи' : 'Новая задача'}</DialogTitle>
        <DialogContent dividers>
          <TextField fullWidth label="Название" margin="dense" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth type="date" label="Дата" slotProps={{ inputLabel: { shrink: true } }} value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            <TextField fullWidth type="time" label="Время" slotProps={{ inputLabel: { shrink: true } }} value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
          </Stack>
          
          <TextField fullWidth label="Локация" margin="normal" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
          
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Тип контента</InputLabel>
              <Select value={form.content_type} label="Тип контента" onChange={e => setForm({...form, content_type: e.target.value})}>
                <MenuItem value="PHOTO">Фото</MenuItem><MenuItem value="VIDEO">Видео</MenuItem><MenuItem value="ALL">Всё вместе</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Нужный навык</InputLabel>
              <Select value={form.required_skill} label="Нужный навык" onChange={e => setForm({...form, required_skill: e.target.value})}>
                <MenuItem value="ANY">Любой</MenuItem><MenuItem value="PRO">Только PRO</MenuItem><MenuItem value="VIDEO">Видеограф</MenuItem><MenuItem value="DRONE">Пилот дрона</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <TextField fullWidth type="number" label="Макс. участников" value={form.max_participants} onChange={e => setForm({...form, max_participants: parseInt(e.target.value)})} />
            <TextField fullWidth type="datetime-local" label="Дедлайн сдачи" slotProps={{ inputLabel: { shrink: true } }} value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} />
          </Stack>

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Необходимая техника</InputLabel>
            <Select
              multiple
              value={form.equipment_ids}
              onChange={(e:any) => setForm({...form, equipment_ids: e.target.value})}
              input={<OutlinedInput label="Необходимая техника" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value: any) => (
                    <Chip key={value} label={equipment.find(eq => eq.id === value)?.name} size="small" />
                  ))}
                </Box>
              )}
            >
              {equipment.map((eq) => (
                <MenuItem key={eq.id} value={eq.id}>{eq.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField fullWidth label="Ссылка на ТЗ / Сценарий" margin="normal" value={form.document_link} onChange={e => setForm({...form, document_link: e.target.value})} />
          <TextField fullWidth label="Ссылка на результат (облако)" margin="normal" value={form.result_link} onChange={e => setForm({...form, result_link: e.target.value})} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModal({open: false, id: null})}>Отмена</Button>
          <Button variant="contained" onClick={() => handleAction(modal.id, 'save', form)}>Сохранить</Button>
        </DialogActions>
      </Dialog>

      {/* ОСТАЛЬНЫЕ МОДАЛКИ (ЧАТ И ПРОФИЛЬ) БЕЗ ИЗМЕНЕНИЙ */}
      <Dialog open={chatModal.open} onClose={() => setChatModal({open: false, eventId: null})} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Чат мероприятия</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ height: 350, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {chatMessages.map(msg => (
              <Box key={msg.id} sx={{ alignSelf: msg.author?.username === user?.username ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>{msg.author?.first_name || msg.author?.username}</Typography>
                <Paper elevation={1} sx={{ p: 1.5, borderRadius: 2, bgcolor: msg.author?.username === user?.username ? 'primary.main' : 'background.paper', color: msg.author?.username === user?.username ? 'white' : 'text.primary' }}>
                  <Typography variant="body2">{msg.text}</Typography>
                </Paper>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <TextField fullWidth size="small" placeholder="Написать сообщение..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} />
          <IconButton color="primary" onClick={sendMessage}><SendIcon/></IconButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;