import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import { ContentCopy as ContentCopyIcon, Add as AddIcon } from '@mui/icons-material';
import toast from 'react-hot-toast';
import api from '../services/api';

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

const InviteModal: React.FC<InviteModalProps> = ({ open, onClose }) => {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInvites = async () => {
    setLoading(true);
    try {
      const res = await api.get('invites/');
      setInvites(res.data.results !== undefined ? res.data.results : res.data);
    } catch (e) {
      toast.error('Ошибка при загрузке инвайтов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchInvites();
    }
  }, [open]);

  const generateInvite = async (role: string) => {
    try {
      const res = await api.post('invites/', { role });
      navigator.clipboard.writeText(res.data.code);
      toast.success(`Инвайт для ${role === 'MEDIA' ? 'СМИ' : 'Организатора'} скопирован: ${res.data.code}`);
      fetchInvites();
    } catch (e) {
      toast.error('Ошибка при генерации кода');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Код скопирован');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" sx={{ '& .MuiDialog-paper': { borderRadius: '24px' } }}>
      <DialogTitle sx={{ fontWeight: 900 }}>Активные инвайт коды</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button variant="contained" color="primary" onClick={() => generateInvite('MEDIA')} startIcon={<AddIcon />}>
            Инвайт СМИ
          </Button>
          <Button variant="outlined" color="primary" onClick={() => generateInvite('ORGANIZER')} startIcon={<AddIcon />}>
            Инвайт Орг
          </Button>
        </Box>

        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
          Список активных кодов
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {invites.length === 0 ? (
              <Typography color="text.secondary" align="center">Нет активных инвайтов</Typography>
            ) : (
              invites.map((invite) => (
                <ListItem
                  key={invite.id}
                  secondaryAction={
                    <Tooltip title="Скопировать">
                      <IconButton edge="end" onClick={() => copyCode(invite.code)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                  sx={{ bgcolor: 'action.hover', borderRadius: 2, mb: 1 }}
                >
                  <ListItemText
                    primary={invite.code}
                    primaryTypographyProps={{ fontWeight: 'bold', letterSpacing: 1 }}
                    secondary={`Роль: ${invite.role === 'MEDIA' ? 'СМИ' : 'Организатор'} | Создан: ${new Date(invite.created_at).toLocaleDateString()}`}
                  />
                </ListItem>
              ))
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteModal;
