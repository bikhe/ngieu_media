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
} from '@mui/material';
import { Calendar, MapPin, FileText, MessageSquare, Lock, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ResponsiblePerson {
  username: string;
  first_name?: string;
  last_name?: string;
}

interface Participant {
  id: number;
  username: string;
}

interface EventData {
  id: number;
  title: string;
  description?: string;
  status: string; // 'OPEN', 'IN_PROGRESS', 'COMPLETED'
  date: string;
  location?: string;
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
  };
  onTakeTask: (eventId: number) => void;
  onSubmitWork: (eventId: number) => void;
  onOpenChat: (eventId: number) => void;
}

// Map English backend statuses to readable Russian values and colors
const getStatusDetails = (status: string) => {
  switch (status) {
    case 'OPEN':
      return { label: 'Свободно', color: 'success' as const };
    case 'IN_PROGRESS':
      return { label: 'В работе', color: 'warning' as const };
    case 'COMPLETED':
      return { label: 'Выполнено', color: 'info' as const };
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
}) => {
  const mySkill = currentUser.skill_level || 'ANY';
  
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
    formattedDate = format(parsedDate, 'dd MMMM yyyy', { locale: ru });
    if (event.time) {
      formattedDate += ` в ${event.time.slice(0, 5)}`;
      if (event.end_time) {
        formattedDate += ` - ${event.end_time.slice(0, 5)}`;
      }
    }
  } catch (err) {
    console.error('Date parsing failed:', err);
  }


  const statusInfo = getStatusDetails(event.status);

  return (
    <Card sx={{ mb: 2, mx: 2, borderRadius: 3, border: isMyTask ? '1px solid rgba(25, 118, 210, 0.4)' : 'none' }}>
      <CardContent sx={{ pb: 1.5 }}>
        {/* Status and limits */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Chip label={statusInfo.label} color={statusInfo.color} size="small" variant="filled" />
          
          {!hasAccess && !isMyTask && (
            <Chip
              label={`Нужен ${event.required_skill}`}
              size="small"
              icon={<Lock size={12} />}
              color="error"
              variant="outlined"
            />
          )}

          {hasAccess && !isMyTask && (
            <Chip
              label={`${participantsCount} / ${event.max_participants}`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Title */}
        <Typography variant="h6" gutterBottom sx={{ lineHeight: 1.3, fontWeight: 'bold' }}>
          {event.title}
        </Typography>

        {/* Date and Location */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, my: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Calendar size={14} style={{ opacity: 0.6 }} />
            <Typography variant="body2" color="text.secondary">
              {formattedDate}
            </Typography>
          </Box>
          {event.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MapPin size={14} style={{ opacity: 0.6 }} />
              <Typography variant="body2" color="text.secondary" noWrap>
                {event.location}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Organizer */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Орг: <span style={{ fontWeight: 500 }}>{orgName}</span>
        </Typography>
      </CardContent>

      <Divider />

      <CardActions sx={{ px: 2, py: 1.2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* Document Link */}
          {event.document_link && (
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
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
            >
              <FileText size={18} />
            </IconButton>
          )}
          
          {/* Chat Link */}
          {currentUser.features?.event_chat === true && (
            <IconButton
              size="small"
              onClick={() => onOpenChat(event.id)}
              title="Чат"
            >
              <MessageSquare size={18} />
            </IconButton>
          )}
        </Box>

        {/* Right action button */}
        <Box>
          {!isMyTask && hasAccess && !isFull && (
            <Button
              variant="contained"
              size="small"
              onClick={() => onTakeTask(event.id)}
              sx={{ borderRadius: 2, textTransform: 'none', px: 2 }}
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
              sx={{ borderRadius: 2, textTransform: 'none', px: 2 }}
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
      </CardActions>
    </Card>
  );
};

export default EventCard;
