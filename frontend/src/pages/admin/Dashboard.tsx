import React, { useEffect, useState, useContext, useCallback } from 'react';
import { Box, Container, Typography, Card, Button, AppBar, Toolbar, Avatar, IconButton, Chip, Tabs, Tab, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Drawer, List, ListItem, ListItemText, Stack, Paper, MenuItem, Select, FormControl, InputLabel, OutlinedInput, Divider, Pagination, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import toast, { Toaster } from 'react-hot-toast';
import { Brightness4 as Brightness4Icon, Brightness7 as Brightness7Icon, Edit as EditIcon, Delete as DeleteIcon, Chat as ChatIcon, Send as SendIcon, Inventory2 as Inventory2Icon, MilitaryTech as MilitaryTechIcon, Link as LinkIcon, Timer as TimerIcon, ViewList as ViewListIcon, CalendarMonth as CalendarIcon, Palette as PaletteIcon } from '@mui/icons-material';

import api from '../../services/api';
import { useUpdatesBroker } from '../../services/useUpdatesBroker';
import { ThemeSettingsContext as ColorModeContext } from '../../theme/ThemeSettingsContext';
import { CalendarView } from '../../components/CalendarView';

const Dashboard = () => {
  const { mode, toggleColorMode, brandName, openSetup } = useContext(ColorModeContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [features, setFeatures] = useState<any>({});
  const [tab, setTab] = useState('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteRole, setInviteRole] = useState('ORGANIZER');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 9;
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [modal, setModal] = useState({ open: false, id: null as any });
  
  // Расширенная форма со всеми полями из БД
  const [form, setForm] = useState({ 
    title: '', date: '', time: '12:00', end_time: '14:00', deadline: '', location: '', 
    content_type: 'PHOTO', document_link: '', result_link: '',
    max_participants: 1, required_skill: 'ANY', equipment_ids: [] as number[] 
  });


  const [chatModal, setChatModal] = useState({ open: false, eventId: null as any });
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  const [profileModal, setProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', telegram_id: '' });
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const isAdmin = user?.role === 'MAIN_ADMIN';

  const loadData = useCallback(async () => {
    try {
      const params: any = viewMode === 'calendar' ? {} : { page, page_size: pageSize };
      if (tab !== 'ALL') {
        params.status = tab;
      }
      const [e, u, eq] = await Promise.all([
        api.get('events/', { params }), 
        api.get('users/me/'),
        api.get('equipment/') // Тянем список техники
      ]);
      if (e.data.results !== undefined) {
        setEvents(e.data.results);
        setTotalPages(Math.ceil(e.data.count / pageSize));
      } else {
        setEvents(e.data);
        setTotalPages(1);
      }
      setUser(u.data); 
      setFeatures(u.data.features || {});
      setEquipment(eq.data);
      
      setProfileForm({ first_name: u.data.first_name || '', last_name: u.data.last_name || '', telegram_id: u.data.telegram_id || '' });
      if (u.data.role === 'MAIN_ADMIN') setInvites((await api.get('invites/')).data);
    } catch { navigate('/login'); } finally { setLoading(false); }
  }, [navigate, page, tab, viewMode]);

  // Real-time updates broker integration
  useUpdatesBroker(['event', 'equipment', 'loan'], () => {
    loadData();
  });

  useUpdatesBroker(['comment'], (log) => {
    if (chatModal.open && log.extra_data?.event_id === chatModal.eventId) {
      loadChat(chatModal.eventId);
    }
  });

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async (id: number | null, action: string, data?: any) => {
    try {
      if (action === 'delete') { if (!window.confirm("Удалить?")) return; await api.delete(`events/${id}/`); }
      else if (action === 'approve') await api.post(`events/${id}/approve/`);
      else if (action === 'reject') await api.post(`events/${id}/reject/`);
      else if (action === 'save') {
        // Подготовка данных для отправки (чистка ссылок)
        const payload = { ...data };
        if (payload.document_link) {
          payload.document_link = payload.document_link.trim().split(/\s+/).map((link: string) => {
            if (!link) return '';
            return /^https?:\/\//i.test(link) ? link : `https://${link}`;
          }).filter(Boolean).join(' ');
        }
        if (payload.result_link) {
          payload.result_link = payload.result_link.trim().split(/\s+/).map((link: string) => {
            if (!link) return '';
            return /^https?:\/\//i.test(link) ? link : `https://${link}`;
          }).filter(Boolean).join(' ');
        }
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

  const handleProfileSave = async () => {
    try {
      if (changePassOpen) {
        if (!oldPassword || !newPassword) {
          toast.error('Заполните все поля пароля');
          return;
        }
        if (newPassword.length < 6) {
          toast.error('Новый пароль должен быть не менее 6 символов');
          return;
        }
        await api.post('users/change_password/', { old_password: oldPassword, new_password: newPassword });
      }
      await api.post('users/me/', profileForm);
      toast.success('Профиль успешно обновлен');
      setProfileModal(false);
      setChangePassOpen(false);
      setOldPassword('');
      setNewPassword('');
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Ошибка сохранения';
      toast.error(msg);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 5 }}>
      <Toaster />


      <Container maxWidth="lg" sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>Мероприятия</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, value) => { if (value) setViewMode(value); }}
              size="small"
              color="primary"
            >
              <ToggleButton value="list" title="Список">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="calendar" title="Календарь">
                <CalendarIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>

            {(isAdmin || user?.role === 'ORGANIZER') && (
              <Button variant="contained" onClick={() => { 
                setForm({title:'', date:'', time:'12:00', end_time:'14:00', deadline: '', location:'', content_type:'PHOTO', document_link:'', result_link: '', max_participants: 1, required_skill: 'ANY', equipment_ids: []}); 
                setModal({open: true, id: null}); 
              }}>Создать</Button>
            )}
          </Box>
        </Box>

        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); }} sx={{ mb: 4 }} variant="scrollable">
          <Tab label="Все" value="ALL" /><Tab label="Новые" value="PENDING" /><Tab label="Открыты" value="OPEN" /><Tab label="В работе" value="IN_PROGRESS" /><Tab label="Готово" value="COMPLETED" />
        </Tabs>

        {viewMode === 'calendar' ? (
          <Box>
            <CalendarView
              events={events}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
            
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, mt: 3, color: 'text.secondary' }}>
              События на {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}:
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
              {events.filter(e => {
                const d = new Date(selectedDate);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${day}`;
                return e.date === dateStr;
              }).length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4, gridColumn: '1 / -1' }}>
                  Нет событий на выбранную дату
                </Typography>
              ) : (
                events.filter(e => {
                  const d = new Date(selectedDate);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  const dateStr = `${y}-${m}-${day}`;
                  return e.date === dateStr;
                }).map(event => {
                  const statusMap: Record<string, { label: string; color: 'warning' | 'success' | 'info' | 'default' | 'error' }> = {
                    PENDING: { label: 'Ожидание', color: 'warning' },
                    OPEN: { label: 'Свободно', color: 'success' },
                    IN_PROGRESS: { label: 'В работе', color: 'info' },
                    COMPLETED: { label: 'Выполнено', color: 'default' },
                    OVERDUE: { label: 'Просрочено', color: 'error' },
                  };
                  const skillMap: Record<string, string> = {
                    ANY: 'Любой', PRO: 'PRO', VIDEO: 'Видео', DRONE: 'Дрон',
                  };
                  const statusInfo = statusMap[event.status] || { label: event.status, color: 'default' as const };
                  const skillLabel = skillMap[event.required_skill] || event.required_skill;

                  return (
                  <Box key={event.id}>
                    <Card className="spring-card" sx={{ height: '100%', p: 2.5, display: 'flex', flexDirection: 'column', borderTop: 4, borderColor: event.status === 'COMPLETED' ? 'success.main' : (event.status === 'OVERDUE' ? 'error.main' : (event.status === 'PENDING' ? 'warning.main' : 'primary.main')), borderRadius: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Chip label={statusInfo.label} size="small" color={statusInfo.color} sx={{ borderRadius: 2, fontWeight: 600, fontSize: '0.7rem', height: 24 }} />
                        {(isAdmin || (user?.role === 'ORGANIZER' && event.responsible_person?.id === user?.id)) && (
                          <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" onClick={() => {
                              setForm({...event, end_time: event.end_time || '', equipment_ids: event.booked_equipment?.map((eq:any) => eq.id) || []}); 
                              setModal({open: true, id: event.id});
                            }} sx={{ p: 0.5 }}><EditIcon fontSize="small" /></IconButton>

                            <IconButton size="small" color="error" onClick={() => handleAction(event.id, 'delete')} sx={{ p: 0.5 }}><DeleteIcon fontSize="small" /></IconButton>
                          </Stack>
                        )}
                      </Box>
                      
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5, fontSize: '1.05rem', lineHeight: 1.3, wordBreak: 'break-word' }}>{event.title}</Typography>
                      <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
                        <TimerIcon sx={{ fontSize: 14, mr: 0.5 }} /> {format(parseISO(event.date), 'dd.MM.yyyy')} в {event.time?.slice(0,5)}{event.end_time ? ` — ${event.end_time.slice(0,5)}` : ''}
                      </Typography>

                      <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip icon={<MilitaryTechIcon />} label={skillLabel} size="small" variant="outlined" color={event.required_skill !== 'ANY' ? 'secondary' : 'default'} sx={{ height: 24, fontSize: '0.7rem' }} />
                        <Chip label={`👥 ${event.media_participants?.length || 0} / ${event.max_participants}`} size="small" variant="outlined" sx={{ height: 24, fontSize: '0.7rem' }} />
                      </Stack>

                      {event.booked_equipment?.length > 0 && (
                        <Box sx={{ mb: 1.5 }}>
                          {event.booked_equipment.map((eq: any) => (
                            <Chip key={eq.id} icon={<Inventory2Icon sx={{ fontSize: '12px !important' }}/>} label={eq.name} size="small" sx={{ mr: 0.5, mb: 0.5, fontSize: '0.65rem', height: 22 }} />
                          ))}
                        </Box>
                      )}
                      
                      <Box sx={{ mt: 'auto' }}>
                        <Divider sx={{ mb: 1.5 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>Орг: {event.responsible_person?.first_name || event.responsible_person?.username}</Typography>
                          <Stack direction="row" spacing={0.5}>
                            {event.result_link && (
                              <IconButton
                                size="small"
                                onClick={() => {
                                  event.result_link.trim().split(/\s+/).forEach((link: string) => {
                                    if (link) {
                                      const target = /^https?:\/\//i.test(link) ? link : `https://${link}`;
                                      window.open(target, '_blank');
                                    }
                                  });
                                }}
                                color="success"
                                sx={{ p: 0.5 }}
                              >
                                <LinkIcon fontSize="small" />
                              </IconButton>
                            )}
                            <IconButton size="small" onClick={() => {setChatModal({open: true, eventId: event.id}); loadChat(event.id);}} sx={{ p: 0.5 }}><ChatIcon fontSize="small" /></IconButton>
                          </Stack>
                        </Box>

                        {isAdmin && event.status === 'PENDING' && (
                          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                            <Button size="small" variant="contained" color="success" onClick={() => handleAction(event.id, 'approve')} fullWidth sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>Одобрить</Button>
                            <Button size="small" variant="contained" color="error" onClick={() => handleAction(event.id, 'reject')} fullWidth sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>Отказ</Button>
                          </Stack>
                        )}
                      </Box>
                    </Card>
                  </Box>
                  );
                })
              )}
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
              {events.map(event => {
                const statusMap: Record<string, { label: string; color: 'warning' | 'success' | 'info' | 'default' | 'error' }> = {
                  PENDING: { label: 'Ожидание', color: 'warning' },
                  OPEN: { label: 'Свободно', color: 'success' },
                  IN_PROGRESS: { label: 'В работе', color: 'info' },
                  COMPLETED: { label: 'Выполнено', color: 'default' },
                  OVERDUE: { label: 'Просрочено', color: 'error' },
                };
                const skillMap: Record<string, string> = {
                  ANY: 'Любой', PRO: 'PRO', VIDEO: 'Видео', DRONE: 'Дрон',
                };
                const statusInfo = statusMap[event.status] || { label: event.status, color: 'default' as const };
                const skillLabel = skillMap[event.required_skill] || event.required_skill;

                return (
                <Box key={event.id}>
                  <Card className="spring-card" sx={{ height: '100%', p: 2.5, display: 'flex', flexDirection: 'column', borderTop: 4, borderColor: event.status === 'COMPLETED' ? 'success.main' : (event.status === 'OVERDUE' ? 'error.main' : (event.status === 'PENDING' ? 'warning.main' : 'primary.main')), borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Chip label={statusInfo.label} size="small" color={statusInfo.color} sx={{ borderRadius: 2, fontWeight: 600, fontSize: '0.7rem', height: 24 }} />
                      {(isAdmin || (user?.role === 'ORGANIZER' && event.responsible_person?.id === user?.id)) && (
                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small" onClick={() => {
                            setForm({...event, end_time: event.end_time || '', equipment_ids: event.booked_equipment?.map((eq:any) => eq.id) || []}); 
                            setModal({open: true, id: event.id});
                          }} sx={{ p: 0.5 }}><EditIcon fontSize="small" /></IconButton>

                          <IconButton size="small" color="error" onClick={() => handleAction(event.id, 'delete')} sx={{ p: 0.5 }}><DeleteIcon fontSize="small" /></IconButton>
                        </Stack>
                      )}
                    </Box>
                    
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5, fontSize: '1.05rem', lineHeight: 1.3, wordBreak: 'break-word' }}>{event.title}</Typography>
                    <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
                      <TimerIcon sx={{ fontSize: 14, mr: 0.5 }} /> {format(parseISO(event.date), 'dd.MM.yyyy')} в {event.time?.slice(0,5)}{event.end_time ? ` — ${event.end_time.slice(0,5)}` : ''}
                    </Typography>

                    <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip icon={<MilitaryTechIcon />} label={skillLabel} size="small" variant="outlined" color={event.required_skill !== 'ANY' ? 'secondary' : 'default'} sx={{ height: 24, fontSize: '0.7rem' }} />
                      <Chip label={`👥 ${event.media_participants?.length || 0} / ${event.max_participants}`} size="small" variant="outlined" sx={{ height: 24, fontSize: '0.7rem' }} />
                    </Stack>

                    {event.booked_equipment?.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        {event.booked_equipment.map((eq: any) => (
                          <Chip key={eq.id} icon={<Inventory2Icon sx={{ fontSize: '12px !important' }}/>} label={eq.name} size="small" sx={{ mr: 0.5, mb: 0.5, fontSize: '0.65rem', height: 22 }} />
                        ))}
                      </Box>
                    )}
                    
                    <Box sx={{ mt: 'auto' }}>
                      <Divider sx={{ mb: 1.5 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>Орг: {event.responsible_person?.first_name || event.responsible_person?.username}</Typography>
                        <Stack direction="row" spacing={0.5}>
                          {event.result_link && (
                            <IconButton
                              size="small"
                              onClick={() => {
                                event.result_link.trim().split(/\s+/).forEach((link: string) => {
                                  if (link) {
                                    const target = /^https?:\/\//i.test(link) ? link : `https://${link}`;
                                    window.open(target, '_blank');
                                  }
                                });
                              }}
                              color="success"
                              sx={{ p: 0.5 }}
                            >
                              <LinkIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton size="small" onClick={() => {setChatModal({open: true, eventId: event.id}); loadChat(event.id);}} sx={{ p: 0.5 }}><ChatIcon fontSize="small" /></IconButton>
                        </Stack>
                      </Box>

                      {isAdmin && event.status === 'PENDING' && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                          <Button size="small" variant="contained" color="success" onClick={() => handleAction(event.id, 'approve')} fullWidth sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>Одобрить</Button>
                          <Button size="small" variant="contained" color="error" onClick={() => handleAction(event.id, 'reject')} fullWidth sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>Отказ</Button>
                        </Stack>
                      )}
                    </Box>
                  </Card>
                </Box>
                );
              })}
            </Box>
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination 
                  count={totalPages} 
                  page={page} 
                  onChange={(_, p) => setPage(p)} 
                  color="primary" 
                  size="large"
                />
              </Box>
            )}
          </>
        )}
      </Container>

      {/* МОДАЛКА РЕДАКТИРОВАНИЯ - ТУТ ВСЕ ПОЛЯ */}
      <Dialog open={modal.open} onClose={() => setModal({open: false, id: null})} fullWidth maxWidth="sm" sx={{ '& .MuiDialog-paper': { borderRadius: '24px' } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>{modal.id ? 'Редактирование задачи' : 'Новая задача'}</DialogTitle>
        <DialogContent dividers>
          <TextField fullWidth label="Название" margin="dense" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth type="date" label="Дата" slotProps={{ inputLabel: { shrink: true } }} value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            <TextField fullWidth type="time" label="Время начала" slotProps={{ inputLabel: { shrink: true } }} value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
            <TextField fullWidth type="time" label="Время окончания" slotProps={{ inputLabel: { shrink: true } }} value={form.end_time || ''} onChange={e => setForm({...form, end_time: e.target.value})} />
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
      <Dialog open={chatModal.open} onClose={() => setChatModal({open: false, eventId: null})} fullWidth maxWidth="sm" sx={{ '& .MuiDialog-paper': { borderRadius: '24px' } }}>
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

      {/* МОДАЛКА ПРОФИЛЯ С ВОЗМОЖНОСТЬЮ СМЕНЫ ПАРОЛЯ */}
      <Dialog open={profileModal} onClose={() => setProfileModal(false)} fullWidth maxWidth="xs" sx={{ '& .MuiDialog-paper': { borderRadius: '24px' } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Мой профиль</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth label="Имя" value={profileForm.first_name} onChange={e => setProfileForm({...profileForm, first_name: e.target.value})} />
            <TextField fullWidth label="Фамилия" value={profileForm.last_name} onChange={e => setProfileForm({...profileForm, last_name: e.target.value})} />
            <TextField fullWidth label="Telegram ID" value={profileForm.telegram_id} onChange={e => setProfileForm({...profileForm, telegram_id: e.target.value})} helperText="Для получения уведомлений ботом" />
            
            <Button
              variant="text"
              onClick={() => setChangePassOpen(!changePassOpen)}
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
            >
              {changePassOpen ? '❌ Отменить смену пароля' : '🔑 Сменить пароль'}
            </Button>

            {changePassOpen && (
              <Stack spacing={2} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <TextField fullWidth type="password" size="small" label="Текущий пароль" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
                <TextField fullWidth type="password" size="small" label="Новый пароль" value={newPassword} onChange={e => setNewPassword(e.target.value)} helperText="Минимум 6 символов" />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setProfileModal(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleProfileSave}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;