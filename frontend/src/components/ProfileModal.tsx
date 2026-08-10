import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from '@mui/material';
import { apiService } from '../services/api';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    first_name?: string;
    last_name?: string;
    telegram_id?: string;
  };
  onSave: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  onClose,
  user,
  onSave,
}) => {
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [telegramId, setTelegramId] = useState(user.telegram_id || '');
  const [saving, setSaving] = useState(false);

  // Password change state
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const isTelegramWebApp = !!(window as any).Telegram?.WebApp?.initData;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (changePassOpen) {
        if (!newPassword) {
          alert('Введите новый пароль.');
          setSaving(false);
          return;
        }
        if (!isTelegramWebApp && !oldPassword) {
          alert('Введите текущий пароль.');
          setSaving(false);
          return;
        }
        if (newPassword.length < 6) {
          alert('Новый пароль должен быть не менее 6 символов.');
          setSaving(false);
          return;
        }
        
        const initData = (window as any).Telegram?.WebApp?.initData;
        const passSuccess = await apiService.changePassword(
          isTelegramWebApp ? null : oldPassword,
          newPassword,
          initData
        );
        if (!passSuccess) {
          alert(isTelegramWebApp ? 'Ошибка смены пароля.' : 'Неверный старый пароль или ошибка смены пароля.');
          setSaving(false);
          return;
        }
      }

      const success = await apiService.updateProfile(firstName, lastName, telegramId);
      if (success) {
        onSave();
        onClose();
        if (changePassOpen) {
          alert('Профиль и пароль успешно изменены!');
        }
      } else {
        alert('Ошибка при сохранении профиля.');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка соединения.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Мой профиль</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Имя"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <TextField
            label="Фамилия"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <TextField
            label="Telegram ID (для бота)"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            fullWidth
            variant="outlined"
            helperText="Необходим для получения уведомлений в Telegram"
          />

          <Button
            size="small"
            onClick={() => setChangePassOpen(!changePassOpen)}
            sx={{ alignSelf: 'flex-start', mt: 1, textTransform: 'none' }}
          >
            {changePassOpen ? '❌ Отменить смену пароля' : '🔑 Сменить пароль'}
          </Button>

          {changePassOpen && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
              {!isTelegramWebApp && (
                <TextField
                  label="Текущий пароль"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  fullWidth
                  size="small"
                />
              )}
              <TextField
                label="Новый пароль"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                size="small"
                helperText="Минимум 6 символов"
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0, flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 1 }}>
          <Button onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Box>
        <Button 
          color="error" 
          variant="text"
          fullWidth
          onClick={() => {
            apiService.logout();
          }}
          sx={{ mt: 1, borderRadius: 3 }}
        >
          🚪 Выйти из аккаунта
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfileModal;
