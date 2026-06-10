import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  IconButton, 
  Button, 
  Popover, 
  Divider, 
  Chip, 
  useTheme 
} from '@mui/material';
import { 
  ChevronLeft as ChevronLeftIcon, 
  ChevronRight as ChevronRightIcon, 
  Add as AddIcon,
  Chat as ChatIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface CalendarViewProps {
  events: any[];
  user: any;
  onAddEvent: (dateStr: string) => void;
  onEditEvent: (event: any) => void;
  onDeleteEvent: (id: number) => void;
  onApproveEvent: (id: number) => void;
  onRejectEvent: (id: number) => void;
  onOpenChat: (id: number) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  user,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onApproveEvent,
  onRejectEvent,
  onOpenChat
}) => {
  const theme = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Popover state for event detail preview
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days
  const firstDay = new Date(year, month, 1);
  let startDayOfWeek = firstDay.getDay(); // 0 is Sunday, 1 is Monday
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Align: Monday = 0, Sunday = 6

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const dayCells: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month padding days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    dayCells.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    dayCells.push({
      date: new Date(year, month, i),
      isCurrentMonth: true
    });
  }

  // Next month padding days (fill out grid to 42 cells to prevent jumps)
  const remainingCells = 42 - dayCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    dayCells.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false
    });
  }

  // Format date to local YYYY-MM-DD
  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleEventClick = (event: React.MouseEvent<HTMLElement>, evtData: any) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedEvent(evtData);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
    setSelectedEvent(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { bg: '#fff8e1', border: '#ffe082', text: '#b78103' };
      case 'OPEN':
        return { bg: '#e3f2fd', border: '#90caf9', text: '#0d47a1' };
      case 'IN_PROGRESS':
        return { bg: '#f3e5f5', border: '#ce93d8', text: '#4a148c' };
      case 'COMPLETED':
        return { bg: '#e8f5e9', border: '#a5d6a7', text: '#1b5e20' };
      case 'REJECTED':
        return { bg: '#ffebee', border: '#ef9a9a', text: '#c62828' };
      case 'OVERDUE':
        return { bg: '#fbe9e7', border: '#ffab91', text: '#d84315' };
      default:
        return { bg: '#f5f5f5', border: '#e0e0e0', text: '#616161' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Ожидание';
      case 'OPEN': return 'Открыт';
      case 'IN_PROGRESS': return 'В работе';
      case 'COMPLETED': return 'Готово';
      case 'REJECTED': return 'Отклонено';
      case 'OVERDUE': return 'Просрочено';
      default: return status;
    }
  };

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case 'PHOTO': return 'Фотосъемка';
      case 'VIDEO': return 'Видеосъемка';
      case 'ALL': return 'Фото и Видео';
      default: return type;
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isAdmin = user?.role === 'MAIN_ADMIN';

  return (
    <Box sx={{ width: '100%' }}>
      {/* Calendar Header Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {MONTH_NAMES[month]} {year}
          </Typography>
          <Box sx={{ ml: 2 }}>
            <Button variant="outlined" size="small" onClick={handleToday}>
              Сегодня
            </Button>
          </Box>
        </Box>
        <Box>
          <IconButton onClick={handlePrevMonth} color="primary">
            <ChevronLeftIcon />
          </IconButton>
          <IconButton onClick={handleNextMonth} color="primary">
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Week Days Header */}
      <Paper elevation={0} variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: theme.palette.mode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, textAlign: 'center' }}>
          {WEEK_DAYS.map((day, idx) => (
            <Box key={day}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: idx >= 5 ? 'error.main' : 'text.secondary' }}>
                {day}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Calendar Grid */}
      <Paper variant="outlined" sx={{ overflow: 'hidden', p: '2px', bgcolor: theme.palette.divider }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {dayCells.map((cell, idx) => {
            const dateKey = formatDateKey(cell.date);
            const dayEvents = events.filter(e => e.date === dateKey);
            const currentIsToday = isToday(cell.date);

            return (
              <Box 
                key={idx} 
                sx={{ 
                  height: 130, 
                  bgcolor: cell.isCurrentMonth 
                    ? (currentIsToday 
                      ? (theme.palette.mode === 'light' ? '#e3f2fd' : 'rgba(33, 150, 243, 0.15)') 
                      : 'background.paper')
                    : (theme.palette.mode === 'light' ? '#fafafa' : '#1e1e1e'),
                  position: 'relative',
                  p: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  border: currentIsToday ? `2px solid ${theme.palette.primary.main}` : 'none',
                  '&:hover .add-btn': {
                    opacity: 1
                  }
                }}
              >
                {/* Day Number Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: currentIsToday ? 900 : 500,
                      color: cell.isCurrentMonth 
                        ? (currentIsToday 
                          ? 'primary.main' 
                          : 'text.primary') 
                        : 'text.disabled',
                      fontSize: '0.85rem'
                    }}
                  >
                    {cell.date.getDate()}
                  </Typography>
                  
                  {/* Hover Add Button */}
                  {(isAdmin || user?.role === 'ORGANIZER') && (
                    <IconButton 
                      className="add-btn"
                      size="small" 
                      onClick={() => onAddEvent(dateKey)}
                      sx={{ 
                        opacity: 0, 
                        transition: 'opacity 0.2s', 
                        p: 0.25,
                        color: 'primary.main'
                      }}
                      title="Создать событие на этот день"
                    >
                      <AddIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>

                {/* Events list inside cell */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {dayEvents.map(evt => {
                    const colors = getStatusColor(evt.status);
                    return (
                      <Box
                        key={evt.id}
                        onClick={(e) => handleEventClick(e, evt)}
                        sx={{
                          p: 0.5,
                          borderRadius: 1,
                          fontSize: '11px',
                          fontWeight: evt.status === 'OVERDUE' ? 'bold' : 'normal',
                          bgcolor: colors.bg,
                          color: colors.text,
                          borderLeft: `3px solid ${colors.border}`,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          transition: 'transform 0.1s',
                          '&:hover': {
                            transform: 'scale(1.02)',
                            boxShadow: '0px 1px 3px rgba(0,0,0,0.1)'
                          }
                        }}
                        title={evt.title}
                      >
                        {evt.time ? `${evt.time.slice(0, 5)} ` : ''}{evt.title}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* Event Details Actions Popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        {...({
          PaperProps: {
            sx: { width: 300, p: 2, borderRadius: 3, boxShadow: 6 }
          }
        } as any)}
      >
        {selectedEvent && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: '11px', textTransform: 'uppercase' }}>
                {getContentTypeLabel(selectedEvent.content_type)}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {selectedEvent.title}
              </Typography>
            </Box>

            <Divider />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ fontSize: '13px' }}>
                  {selectedEvent.time?.slice(0, 5)} {selectedEvent.end_time ? `- ${selectedEvent.end_time.slice(0, 5)}` : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PlaceIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ fontSize: '13px' }}>
                  {selectedEvent.location}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ fontSize: '13px' }}>
                  Орг: {selectedEvent.responsible_person?.first_name || selectedEvent.responsible_person?.username}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
              <Chip 
                label={getStatusLabel(selectedEvent.status)} 
                size="small" 
                sx={{ 
                  bgcolor: getStatusColor(selectedEvent.status).bg, 
                  color: getStatusColor(selectedEvent.status).text,
                  borderColor: getStatusColor(selectedEvent.status).border,
                  borderWidth: 1,
                  borderStyle: 'solid'
                }} 
              />
              <Chip label={`👥 ${selectedEvent.media_participants?.length || 0}/${selectedEvent.max_participants}`} size="small" variant="outlined" />
            </Box>

            <Divider />

            {/* Quick Actions Footer */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <IconButton 
                size="small" 
                color="primary" 
                onClick={() => { onOpenChat(selectedEvent.id); handleClosePopover(); }}
                title="Открыть чат"
              >
                <ChatIcon />
              </IconButton>
              
              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5 }}>
                {/* Admin/Owner actions */}
                {(isAdmin || (user?.role === 'ORGANIZER' && selectedEvent.responsible_person?.id === user?.id)) && (
                  <>
                    <IconButton 
                      size="small" 
                      onClick={() => { onEditEvent(selectedEvent); handleClosePopover(); }}
                      title="Редактировать"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="error" 
                      onClick={() => { onDeleteEvent(selectedEvent.id); handleClosePopover(); }}
                      title="Удалить"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </>
                )}

                {/* Admin approve/reject */}
                {isAdmin && selectedEvent.status === 'PENDING' && (
                  <>
                    <IconButton 
                      size="small" 
                      color="success" 
                      onClick={() => { onApproveEvent(selectedEvent.id); handleClosePopover(); }}
                      title="Одобрить"
                    >
                      <CheckIcon />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="error" 
                      onClick={() => { onRejectEvent(selectedEvent.id); handleClosePopover(); }}
                      title="Отклонить"
                    >
                      <CancelIcon />
                    </IconButton>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Popover>
    </Box>
  );
};
