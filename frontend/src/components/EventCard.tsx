import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  IconButton,
  Button,
  Box,
  Divider,
  Avatar,
  Tooltip,
} from '@mui/material';
import { Calendar, MapPin, FileText, MessageSquare, Lock, Check, Edit2, Trash2, X, Copy } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ResponsiblePerson {
  id?: number;
  username: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}

interface Participant {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}

interface LocationData {
  id: number;
  name: string;
}

interface EventData {
  id: number;
  title: string;
  description?: string;
  status: string; // 'OPEN', 'IN_PROGRESS', 'COMPLETED'
  date: string;
  locations?: LocationData[];
  short_comment?: string;
  required_skill: string; // 'ANY', 'VIDEO', 'DRONE', 'PRO', etc.
  max_participants: number;
  media_participants: Participant[];
  responsible_person?: ResponsiblePerson;
  document_link?: string;
  time?: string;
  end_time?: string;

}

interface EventCardProps {
  event: EventData;
  isMyTask: boolean;
  currentUser: {
    id?: number;
    username?: string;
    skill_level?: string;
    features?: {
      skill_levels?: boolean;
      event_chat?: boolean;
    };
    role?: string;
    is_staff?: boolean;
    is_superuser?: boolean;
  };
  onTakeTask: (eventId: number) => void;
  onSubmitWork: (eventId: number) => void;
  onOpenChat: (eventId: number) => void;
  onEditEvent?: (eventId: number) => void;
  onDeleteEvent?: (eventId: number) => void;
  onApproveEvent?: (eventId: number) => void;
  onRejectEvent?: (eventId: number) => void;
  onDuplicateEvent?: (eventId: number) => void;
}

// Map English backend statuses to readable Russian values and colors
const getStatusDetails = (status: string) => {
  switch (status) {
    case 'PENDING':
      return { label: 'Ожидание', color: 'warning' as const };
    case 'OPEN':
      return { label: 'Свободно', color: 'success' as const };
    case 'IN_PROGRESS':
      return { label: 'В работе', color: 'info' as const };
    case 'COMPLETED':
      return { label: 'Выполнено', color: 'default' as const };
    case 'OVERDUE':
      return { label: 'Просрочено', color: 'error' as const };
    default:
      return { label: status, color: 'default' as const };
  }
};

export const EventCard: React.FC<EventCardProps> = ({
  event,
  isMyTask,
  currentUser,
  onTakeTask,
  onSubmitWork,
  onOpenChat,
  onEditEvent,
  onDeleteEvent,
  onApproveEvent,
  onRejectEvent,
  onDuplicateEvent,
}) => {
  const mySkill = currentUser.skill_level || 'ANY';
  
  // Permissions
  const isAdmin = currentUser.role === 'MAIN_ADMIN' || currentUser.is_staff || currentUser.is_superuser;
  const isCreator = currentUser.role === 'ORGANIZER' && event.responsible_person?.id === currentUser.id;
  
  const canEdit = isAdmin || isCreator;
  const canDelete = isAdmin;
  const canApproveReject = isAdmin && event.status === 'PENDING';
  const canChat = isAdmin || isCreator || isMyTask;

  // Check if user has required skills (unless feature toggle is off)
  const hasAccess =
    currentUser.features?.skill_levels !== true ||
    event.required_skill === 'ANY' ||
    mySkill === 'PRO' ||
    mySkill === event.required_skill;

  const participantsCount = event.media_participants?.length || 0;
  const isFull = participantsCount >= event.max_participants;

  // Format organizer name
  const orgName = event.responsible_person?.first_name
    ? `${event.responsible_person.first_name} ${event.responsible_person.last_name || ''}`.trim()
    : event.responsible_person?.username || 'Неизвестно';

  // Format date
  let formattedDate = event.date;
  try {
    const parsedDate = parseISO(event.date);
    formattedDate = format(parsedDate, 'dd MMM yyyy', { locale: ru });
    if (event.time) {
      formattedDate += ` ${event.time.slice(0, 5)}`;
      if (event.end_time) {
        formattedDate += ` - ${event.end_time.slice(0, 5)}`;
      }
    }
  } catch (err) {
    console.error('Date parsing failed:', err);
  }

  const statusInfo = getStatusDetails(event.status);

  return (
    <Card sx={{ mb: 2, mx: { xs: 2, sm: 3 }, borderRadius: 8, border: isMyTask ? '1px solid rgba(25, 118, 210, 0.4)' : 'none', position: 'relative' }}>
      <CardContent sx={{ py: { xs: 3.5, sm: 4 }, px: { xs: 4.5, sm: 6 }, '&:last-child': { pb: { xs: 3.5, sm: 4 } } }}>
        {/* Status and limits */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', pr: canEdit ? { xs: 4, sm: 5 } : 0 }}>
          <Chip label={statusInfo.label} color={statusInfo.color} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
          
          {!hasAccess && !isMyTask && (
            <Chip
              label={`Нужен ${event.required_skill}`}
              size="small"
              icon={<Lock size={10} />}
              color="error"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}

          {hasAccess && !isMyTask && (
            <Chip
              label={`${participantsCount} / ${event.max_participants}`}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>

        {canEdit && (
          <Box sx={{ position: 'absolute', top: { xs: 12, sm: 16 }, right: { xs: 8, sm: 12 }, display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={() => onDuplicateEvent?.(event.id)} sx={{ p: 0.5 }} title="Дублировать">
              <Copy size={14} />
            </IconButton>
            <IconButton size="small" onClick={() => onEditEvent?.(event.id)} sx={{ p: 0.5 }} title="Редактировать">
              <Edit2 size={14} />
            </IconButton>
            {canDelete && (
              <IconButton size="small" color="error" onClick={() => onDeleteEvent?.(event.id)} sx={{ p: 0.5 }} title="Удалить">
                <Trash2 size={14} />
              </IconButton>
            )}
          </Box>
        )}

        {/* Title */}
        <Typography variant="h6" sx={{ lineHeight: 1.3, fontWeight: 'bold', pr: canEdit ? { xs: 4, sm: 5 } : 0, mb: 1, wordBreak: 'break-word', fontSize: { xs: '0.9rem', sm: '1.05rem' } }}>
          {event.title}
        </Typography>

        {/* Date and Location */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Calendar size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              {formattedDate}
            </Typography>
          </Box>
          {event.locations && event.locations.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 2, minWidth: 0 }}>
              <MapPin size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary" noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {event.locations.map(l => l.name).join(', ')}
              </Typography>
            </Box>
          )}
        </Box>

        {event.short_comment && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontStyle: 'italic', wordBreak: 'break-word' }}>
            {event.short_comment}
          </Typography>
        )}

        {participantsCount > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
            {event.media_participants.map(p => {
              const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username;
              const title = p.phone_number ? `${fullName} (${p.phone_number})` : fullName;
              return (
                <Tooltip key={p.id} title={title}>
                  <Chip
                    avatar={<Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>{p.username.charAt(0).toUpperCase()}</Avatar>}
                    label={fullName}
                    size="small"
                    variant="outlined"
                    sx={{ height: 26, borderRadius: 13, maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        )}

        {/* Organizer */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, wordBreak: 'break-word' }}>
          Орг: <span style={{ fontWeight: 500 }}>{orgName}</span>
          {event.responsible_person?.phone_number && (
            <span style={{ marginLeft: 4, color: 'inherit' }}>({event.responsible_person.phone_number})</span>
          )}
        </Typography>

        {/* Actions Row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 'auto' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* Document Link */}
            {event.document_link && (
              <IconButton
                size="small"
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  const docLink = event.document_link;
                  if (!docLink) return;
                  docLink.trim().split(/\s+/).forEach((link: string) => {
                    if (link) {
                      const target = /^https?:\/\//i.test(link) ? link : `https://${link}`;
                      window.open(target, '_blank');
                    }
                  });
                }}
                title="Открыть ТЗ"
                sx={{ p: 0.5 }}
              >
                <FileText size={18} />
              </IconButton>
            )}
            
            {/* Chat Link */}
            {currentUser.features?.event_chat === true && canChat && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onOpenChat(event.id); }}
                title="Чат"
                sx={{ p: 0.5 }}
              >
                <MessageSquare size={18} />
              </IconButton>
            )}
          </Box>

          {/* Right action button */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', ml: 'auto' }}>
            {canApproveReject && (
              <>
                <IconButton size="small" onClick={() => onApproveEvent?.(event.id)} sx={{ bgcolor: 'success.main', color: 'white', '&:hover': { bgcolor: 'success.dark' }, width: 28, height: 28 }}>
                  <Check size={16} />
                </IconButton>
                <IconButton size="small" onClick={() => onRejectEvent?.(event.id)} sx={{ bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' }, width: 28, height: 28 }}>
                  <X size={16} />
                </IconButton>
              </>
            )}

            {!isMyTask && !isFull && event.status !== 'PENDING' && (
              <Button
                variant="contained"
                size="small"
                onClick={(e) => { e.stopPropagation(); onTakeTask(event.id); }}
                sx={{ borderRadius: 2, textTransform: 'none', px: { xs: 1.5, sm: 2 }, fontSize: { xs: '0.8rem', sm: '0.875rem' }, whiteSpace: 'nowrap' }}
              >
                Я пойду
              </Button>
            )}

            {isMyTask && event.status === 'IN_PROGRESS' && (
              <Button
                variant="outlined"
                size="small"
                color="primary"
                onClick={() => onSubmitWork(event.id)}
                sx={{ borderRadius: 2, textTransform: 'none', px: { xs: 1.5, sm: 2 }, fontSize: { xs: '0.8rem', sm: '0.875rem' }, whiteSpace: 'nowrap' }}
              >
                Сдать работу
              </Button>
            )}

            {isMyTask && event.status === 'COMPLETED' && (
              <Chip
                label="Сдано"
                color="success"
                variant="outlined"
                icon={<Check size={12} />}
                size="small"
                sx={{ borderRadius: 2 }}
              />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default EventCard;
