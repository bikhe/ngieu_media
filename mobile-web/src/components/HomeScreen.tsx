import React, { useState, useEffect, useRef } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Card,
  Chip,
  Paper,
  Stack,
} from '@mui/material';
import { User, LogOut, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';
import EventCard from './EventCard';
import ProfileModal from './ProfileModal';
import EquipmentModal from './EquipmentModal';
import ChatDrawer from './ChatDrawer';
import RequestEquipmentModal from './RequestEquipmentModal';
import { useUpdatesBroker } from '../services/useUpdatesBroker';

export const HomeScreen: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [me, setMe] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Modals state
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedChatEventId, setSelectedChatEventId] = useState<number | null>(null);
  
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [selectedTakeTaskEventId, setSelectedTakeTaskEventId] = useState<number | null>(null);
  const [requestEqOpen, setRequestEqOpen] = useState(false);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedSubmitEventId, setSelectedSubmitEventId] = useState<number | null>(null);
  const [submitLink, setSubmitLink] = useState('');
  const [submittingWork, setSubmittingWork] = useState(false);

  // Refs for tracking mounted state
  const isMounted = useRef(true);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const meData = await apiService.getUserMe();
      const eventsData = await apiService.getEvents();
      
      let equipmentData = equipmentList;
      let loansData: any[] = [];
      if (meData.features?.equipment_booking === true) {
        const rawLoans = await apiService.getLoans();
        loansData = Array.isArray(rawLoans) ? rawLoans : (rawLoans.results || []);
        
        const rawEquipment = await apiService.getEquipment();
        equipmentData = Array.isArray(rawEquipment) ? rawEquipment : (rawEquipment.results || []);
      }

      const normalizedEvents = Array.isArray(eventsData) ? eventsData : (eventsData.results || []);

      if (isMounted.current) {
        setMe(meData);
        setEvents(normalizedEvents);
        setEquipmentList(equipmentData);
        setLoans(loansData);
      }
    } catch (err) {
      console.error('Failed to load home screen data:', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    isMounted.current = true;
    loadData(true);

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Real-time updates broker integration
  useUpdatesBroker(['event', 'equipment', 'loan'], () => {
    loadData(false);
  });

  // Handle deep linking from Telegram notifications
  useEffect(() => {
    if (events.length > 0 && me.id) {
      const urlParams = new URLSearchParams(window.location.search);
      const eventIdStr = urlParams.get('event_id');
      const openChatParam = urlParams.get('open_chat');
      
      if (eventIdStr) {
        const eventId = parseInt(eventIdStr, 10);
        if (!isNaN(eventId)) {
          // Check if this event exists
          const targetEvent = events.find((e) => e.id === eventId);
          if (targetEvent) {
            // Determine if I am a participant
            const isMyTask = targetEvent.media_participants?.some(
              (p: any) => p.id === me.id || p.username === me.username
            );
            
            // Set active tab accordingly
            if (isMyTask) {
              setActiveTab(1);
            } else {
              setActiveTab(0);
            }
            
            // Open chat if requested
            if (openChatParam === 'true') {
              handleOpenChat(eventId);
            }
            
            // Clear URL params so refreshing doesn't keep triggering this
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          }
        }
      }
    }
  }, [events, me]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleTakeTask = async (eventId: number) => {
    // If equipment booking feature is disabled or stock is empty, join directly
    if (me.features?.equipment_booking !== true || equipmentList.length === 0) {
      setLoading(true);
      try {
        const res = await apiService.takeTask(eventId, []);
        if (res.success) {
          await loadData(false);
        } else {
          alert(res.error || 'Не удалось записаться на задачу.');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    } else {
      setSelectedTakeTaskEventId(eventId);
      setEquipmentOpen(true);
    }
  };

  const handleEquipmentConfirm = async (selectedIds: number[]) => {
    if (selectedTakeTaskEventId === null) return;
    setLoading(true);
    try {
      const res = await apiService.takeTask(selectedTakeTaskEventId, selectedIds);
      if (res.success) {
        await loadData(false);
      } else {
        alert(res.error || 'Не удалось записаться с выбранным оборудованием.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSelectedTakeTaskEventId(null);
      setLoading(false);
    }
  };

  const handleSubmitWorkOpen = (eventId: number) => {
    setSelectedSubmitEventId(eventId);
    setSubmitLink('');
    setSubmitOpen(true);
  };

  const handleSubmitWorkConfirm = async () => {
    if (selectedSubmitEventId === null || !submitLink.trim()) return;
    setSubmittingWork(true);
    try {
      const success = await apiService.submitWork(selectedSubmitEventId, submitLink.trim());
      if (success) {
        setSubmitOpen(false);
        await loadData(false);
      } else {
        alert('Ошибка при сдаче работы.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingWork(false);
    }
  };

  const handleOpenChat = (eventId: number) => {
    setSelectedChatEventId(eventId);
    setChatOpen(true);
  };

  const handleReturnLoan = async (loanId: number) => {
    setLoading(true);
    try {
      const success = await apiService.requestLoanReturn(loanId);
      if (success) {
        await loadData(false);
        alert('Запрос на сдачу техники успешно отправлен.');
      } else {
        alert('Не удалось отправить запрос на сдачу.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEquipmentConfirm = async (equipmentId: number, quantity: number, eventId: number | null, comment: string) => {
    setLoading(true);
    try {
      const success = await apiService.createLoan(equipmentId, quantity, eventId, comment);
      if (success) {
        await loadData(false);
        alert('Запрос на технику успешно создан и ожидает одобрения.');
      } else {
        alert('Не удалось отправить запрос на технику.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks
  const myEvents = events.filter((e) =>
    e.media_participants?.some(
      (p: any) => p.id === me.id || p.username === me.username
    )
  );

  const openEvents = events.filter(
    (e) => e.status === 'OPEN' && !myEvents.some((m) => m.id === e.id)
  );

  if (loading && events.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', pb: 4 }}>
      {/* Top Header App Bar */}
      <AppBar position="sticky" elevation={2} color="default" sx={{ bgcolor: 'background.paper' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            СМИ НГИЭУ
          </Typography>
          <IconButton onClick={() => loadData(true)} color="primary" title="Обновить">
            <RefreshCw size={20} />
          </IconButton>
          <IconButton onClick={() => setProfileOpen(true)} color="inherit" title="Профиль">
            <User size={20} />
          </IconButton>
          <IconButton onClick={() => apiService.logout()} color="error" title="Выйти">
            <LogOut size={20} />
          </IconButton>
        </Toolbar>
        
        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Свободные" sx={{ fontWeight: 'bold' }} />
          <Tab label="Мои задачи" sx={{ fontWeight: 'bold' }} />
          {me.features?.equipment_booking === true && (
            <Tab label="Моя техника" sx={{ fontWeight: 'bold' }} />
          )}
        </Tabs>
      </AppBar>

      {/* Tab Contents */}
      <Box sx={{ mt: 2, flexGrow: 1 }} className="fade-in">
        {activeTab === 0 && (
          openEvents.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <Typography color="text.secondary">Нет свободных заявок</Typography>
            </Box>
          ) : (
            openEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isMyTask={false}
                currentUser={me}
                onTakeTask={handleTakeTask}
                onSubmitWork={handleSubmitWorkOpen}
                onOpenChat={handleOpenChat}
              />
            ))
          )
        )}
        {activeTab === 1 && (
          myEvents.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <Typography color="text.secondary">Вы еще не взяли задач</Typography>
            </Box>
          ) : (
            myEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isMyTask={true}
                currentUser={me}
                onTakeTask={handleTakeTask}
                onSubmitWork={handleSubmitWorkOpen}
                onOpenChat={handleOpenChat}
              />
            ))
          )
        )}
        {activeTab === 2 && me.features?.equipment_booking === true && (
          <Box sx={{ px: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Складской инвентарь</Typography>
              <Button
                variant="contained"
                onClick={() => setRequestEqOpen(true)}
                sx={{ borderRadius: 2 }}
              >
                Запросить технику
              </Button>
            </Box>

            {/* Issued loans list */}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.secondary' }}>
              НА РУКАХ ({loans.filter(l => l.status === 'ISSUED' || l.status === 'RETURN_REQUESTED').length})
            </Typography>
            {loans.filter(l => l.status === 'ISSUED' || l.status === 'RETURN_REQUESTED').length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', mb: 4, borderRadius: 3, borderStyle: 'dashed' }}>
                <Typography variant="body2" color="text.secondary">У вас нет выданного оборудования</Typography>
              </Paper>
            ) : (
              <Box sx={{ mb: 4 }}>
                {loans.filter(l => l.status === 'ISSUED' || l.status === 'RETURN_REQUESTED').map((loan) => (
                  <Card key={loan.id} sx={{ p: 2, mb: 1.5, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography sx={{ fontWeight: 'bold' }}>{loan.equipment?.name}</Typography>
                        {loan.equipment?.serial_number && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontFamily: 'monospace' }}>
                            S/N: {loan.equipment.serial_number}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Количество: {loan.quantity} шт.
                        </Typography>
                        {loan.event_title && (
                          <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
                            Задача: {loan.event_title}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        {loan.status === 'ISSUED' ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleReturnLoan(loan.id)}
                            sx={{ borderRadius: 2, textTransform: 'none' }}
                          >
                            Сдать технику
                          </Button>
                        ) : (
                          <Chip label="Ожидает возврата" color="info" size="small" variant="outlined" sx={{ borderRadius: 1.5 }} />
                        )}
                      </Box>
                    </Box>
                  </Card>
                ))}
              </Box>
            )}

            {/* Requested and history list */}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.secondary' }}>
              ЗАПРОСЫ И ИСТОРИЯ
            </Typography>
            {loans.filter(l => l.status === 'REQUESTED' || l.status === 'RETURNED' || l.status === 'REJECTED').length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 3, borderStyle: 'dashed' }}>
                <Typography variant="body2" color="text.secondary">История запросов пуста</Typography>
              </Paper>
            ) : (
              <Box sx={{ pb: 4 }}>
                {loans.filter(l => l.status === 'REQUESTED' || l.status === 'RETURNED' || l.status === 'REJECTED').map((loan) => (
                  <Card key={loan.id} sx={{ p: 2, mb: 1.5, borderRadius: 3, opacity: loan.status === 'RETURNED' ? 0.7 : 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{loan.equipment?.name} ({loan.quantity} шт.)</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Создан: {new Date(loan.requested_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Chip
                        label={
                          loan.status === 'REQUESTED' ? 'Ожидает одобрения' :
                          loan.status === 'RETURNED' ? 'Возвращено' : 'Отклонено'
                        }
                        color={
                          loan.status === 'REQUESTED' ? 'warning' :
                          loan.status === 'RETURNED' ? 'default' : 'error'
                        }
                        size="small"
                        sx={{ borderRadius: 1.5 }}
                      />
                    </Box>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Modals and Overlays */}
      {profileOpen && (
        <ProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={me}
          onSave={() => loadData(false)}
        />
      )}

      {equipmentOpen && (
        <EquipmentModal
          open={equipmentOpen}
          onClose={() => {
            setEquipmentOpen(false);
            setSelectedTakeTaskEventId(null);
          }}
          equipment={equipmentList}
          onConfirm={handleEquipmentConfirm}
        />
      )}

      {chatOpen && selectedChatEventId !== null && (
        <ChatDrawer
          open={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setSelectedChatEventId(null);
          }}
          eventId={selectedChatEventId}
          currentUser={me}
        />
      )}

      {requestEqOpen && (
        <RequestEquipmentModal
          open={requestEqOpen}
          onClose={() => setRequestEqOpen(false)}
          equipmentList={equipmentList}
          myEvents={myEvents}
          onConfirm={handleRequestEquipmentConfirm}
        />
      )}

      {/* Dialog for submitting result link */}
      <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Сдача работы</DialogTitle>
        <DialogContent>
          <TextField
            label="Ссылка на диск/облако"
            value={submitLink}
            onChange={(e) => setSubmitLink(e.target.value)}
            fullWidth
            required
            variant="outlined"
            margin="normal"
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setSubmitOpen(false)} disabled={submittingWork}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmitWorkConfirm}
            variant="contained"
            disabled={!submitLink.trim() || submittingWork}
          >
            {submittingWork ? 'Отправка...' : 'Отправить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HomeScreen;
