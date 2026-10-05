import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack, FormControl, InputLabel, Select, MenuItem, OutlinedInput, Box, Chip, Collapse, Alert } from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { apiService } from '../services/api';
import type { EventTemplate, Equipment } from '../services/api';
import toast from 'react-hot-toast';

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  eventId?: number | null;
  onSave: () => void;
  equipmentList: Equipment[];
}

interface EventFormState {
  title: string; date: string; time: string; end_time: string | null; deadline: string | null; location_ids: number[];
  short_comment: string; content_type: string; document_link: string; result_link: string;
  max_participants: number; equipment_ids: number[];
}

export const EventFormModal: React.FC<EventFormModalProps> = ({ open, onClose, eventId, onSave, equipmentList }) => {
  const [form, setForm] = useState<EventFormState>({
    title: '', date: '', time: '12:00', end_time: '14:00', deadline: '', location_ids: [] as number[], short_comment: '',
    content_type: 'PHOTO', document_link: '', result_link: '',
    max_participants: 1, equipment_ids: [] as number[]
  });
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [createLocation, setCreateLocation] = useState({ open: false, name: '' });

  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      // Deferred so the state updates never happen synchronously in the effect body.
      void Promise.resolve().then(() => {
        setFormErrors({});
        void apiService.getTemplates().then(setTemplates);
        void apiService.getLocations().then(setLocations);
      });
    }
  }, [open]);

  useEffect(() => {
    if (open && eventId) {
      // Deferred so the state updates never happen synchronously in the effect body.
      void Promise.resolve().then(() => {
      setLoading(true);
      return apiService.getEvents().then((data: unknown) => {
        const events = (Array.isArray(data) ? data : ((data as { results?: unknown[] }).results || [])) as Array<
          EventFormState & { id: number; booked_equipment?: Array<{ id: number }>; end_time?: string }
        >;
        const event = events.find((e) => e.id === eventId);
        if (event) {
          setForm({
            ...event,
            end_time: event.end_time || '',
            equipment_ids: event.booked_equipment?.map((eq) => eq.id) || []
          });
          setSelectedTemplate('');
        }
      }).finally(() => setLoading(false));
      });
    } else if (open && !eventId) {
      // Deferred so the state reset never happens synchronously in the effect body.
      void Promise.resolve().then(() => {
        setFormErrors({});
        setForm({
          title: '', date: '', time: '12:00', end_time: '14:00', deadline: '', location_ids: [] as number[], short_comment: '',
          content_type: 'PHOTO', document_link: '', result_link: '',
          max_participants: 1, equipment_ids: []
        });
        setSelectedTemplate('');
      });
    }
  }, [open, eventId]);

  const handleTemplateChange = (templateId: number | '') => {
    setSelectedTemplate(templateId);
    if (templateId !== '') {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setForm(prev => ({
          ...prev,
          title: template.name,
          content_type: template.content_type,
          max_participants: template.max_participants,
          equipment_ids: template.equipment || []
        }));
      }
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'Введите название события';
    if (!form.date) errors.date = 'Выберите дату';
    if (!form.time) errors.time = 'Укажите время начала';
    if (form.end_time && form.time && form.end_time <= form.time) errors.end_time = 'Время окончания должно быть позже начала';
    if (!form.max_participants || form.max_participants < 1) errors.max_participants = 'Количество должно быть не меньше 1';
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    try {
      setLoading(true);
      const payload = { ...form };
      if (!payload.end_time) payload.end_time = null;
      if (!payload.deadline) payload.deadline = null;
      
      const success = await apiService.saveEvent(eventId || null, payload);
      if (success) {
        toast.success("Сохранено");
        onSave();
        onClose();
      } else {
        setFormErrors({ form: 'Не удалось сохранить событие. Проверьте данные формы.' });
        toast.error("Ошибка сохранения");
      }
    } catch (err) {
      setFormErrors({ form: 'Не удалось сохранить событие. Проверьте данные формы.' });
      toast.error("Ошибка сохранения");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = async () => {
    if (!createLocation.name.trim()) return;
    setLoading(true);
    try {
      const newLoc = await apiService.createLocation(createLocation.name);
      setLocations([...locations, newLoc]);
      setForm({...form, location_ids: [...form.location_ids, newLoc.id]});
      setCreateLocation({ open: false, name: '' });
      toast.success('Локация создана');
    } catch (e) {
      toast.error('Ошибка создания локации');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" sx={{ '& .MuiDialog-paper': { borderRadius: '24px' } }}>
      <DialogTitle sx={{ fontWeight: 900 }}>{eventId ? 'Редактирование задачи' : 'Новая задача'}</DialogTitle>
      <DialogContent dividers>
        {formErrors.form && <Alert severity="error" sx={{ mb: 1 }}>{formErrors.form}</Alert>}
        
        {!eventId && templates.length > 0 && (
          <FormControl fullWidth margin="dense" size="small" sx={{ mb: 2 }}>
            <InputLabel>Заполнить из шаблона</InputLabel>
            <Select 
              value={selectedTemplate} 
              label="Заполнить из шаблона" 
              onChange={e => handleTemplateChange(e.target.value as number | '')}
            >
              <MenuItem value=""><em>Не использовать шаблон</em></MenuItem>
              {templates.map(t => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <TextField fullWidth label="Название" margin="dense" value={form.title} onChange={e => setForm({...form, title: e.target.value})} error={Boolean(formErrors.title)} helperText={formErrors.title} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
          <TextField fullWidth type="date" label="Дата" slotProps={{ inputLabel: { shrink: true } }} value={form.date} onChange={e => setForm({...form, date: e.target.value})} error={Boolean(formErrors.date)} helperText={formErrors.date} />
          <TextField fullWidth type="time" label="Время начала" slotProps={{ inputLabel: { shrink: true } }} value={form.time} onChange={e => setForm({...form, time: e.target.value})} error={Boolean(formErrors.time)} helperText={formErrors.time} />
          <TextField fullWidth type="time" label="Время окончания" slotProps={{ inputLabel: { shrink: true } }} value={form.end_time || ''} onChange={e => setForm({...form, end_time: e.target.value})} error={Boolean(formErrors.end_time)} helperText={formErrors.end_time} />
        </Stack>
        
        
        <FormControl fullWidth margin="normal">
          <InputLabel>Локации</InputLabel>
          <Select
            multiple
            value={form.location_ids}
            onChange={(e) => {
              const values = e.target.value as (number | 'CREATE_NEW')[];
              if (values.includes('CREATE_NEW')) {
                setCreateLocation({ open: true, name: '' });
              } else {
                setForm({...form, location_ids: values.filter((v): v is number => typeof v === 'number')});
              }
            }}
            input={<OutlinedInput label="Локации" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value: number) => (
                  <Chip key={value} label={locations.find(loc => loc.id === value)?.name || value} size="small" />
                ))}
              </Box>
            )}
          >
            <MenuItem value="CREATE_NEW" sx={{ color: 'primary.main', fontWeight: 'bold' }}>+ Создать новую</MenuItem>
            {locations.map((loc) => (
              <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Тип контента</InputLabel>
            <Select value={form.content_type} label="Тип контента" onChange={e => setForm({...form, content_type: e.target.value})}>
              <MenuItem value="PHOTO">Фото</MenuItem><MenuItem value="VIDEO">Видео</MenuItem><MenuItem value="ALL">Всё вместе</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Box sx={{ mt: 2, mb: 1 }}>
          <Button 
            fullWidth 
            color="inherit" 
            onClick={() => setShowAdvanced(!showAdvanced)} 
            endIcon={showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            sx={{ justifyContent: 'space-between', color: 'text.secondary' }}
          >
            Дополнительные настройки
          </Button>
        </Box>

        <Collapse in={showAdvanced}>
          <Box sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth type="number" label="Макс. участников" value={form.max_participants} onChange={e => setForm({...form, max_participants: parseInt(e.target.value)})} error={Boolean(formErrors.max_participants)} helperText={formErrors.max_participants} />
              <TextField fullWidth type="datetime-local" label="Дедлайн сдачи" slotProps={{ inputLabel: { shrink: true } }} value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} />
            </Stack>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Необходимая техника</InputLabel>
              <Select
                multiple
                value={form.equipment_ids}
                onChange={(e) => setForm({...form, equipment_ids: e.target.value as number[]})}
                input={<OutlinedInput label="Необходимая техника" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value: number) => (
                      <Chip key={value} label={equipmentList.find(eq => eq.id === value)?.name} size="small" />
                    ))}
                  </Box>
                )}
              >
                {equipmentList.map((eq) => (
                  <MenuItem key={eq.id} value={eq.id}>{eq.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField fullWidth label="Ссылка на ТЗ / Сценарий" margin="normal" value={form.document_link} onChange={e => setForm({...form, document_link: e.target.value})} />
            <TextField fullWidth label="Ссылка на результат (облако)" margin="normal" value={form.result_link} onChange={e => setForm({...form, result_link: e.target.value})} />
          </Box>
        </Collapse>

      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>Сохранить</Button>
      </DialogActions>

      {/* Создание локации */}
      <Dialog open={createLocation.open} onClose={() => setCreateLocation({...createLocation, open: false})}>
        <DialogTitle>Новая локация</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            margin="dense" 
            label="Название" 
            fullWidth 
            value={createLocation.name} 
            onChange={e => setCreateLocation({...createLocation, name: e.target.value})} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateLocation({...createLocation, open: false})}>Отмена</Button>
          <Button onClick={handleCreateLocation} disabled={loading}>Создать</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};
export default EventFormModal;
