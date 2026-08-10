import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack, FormControl, InputLabel, Select, MenuItem, OutlinedInput, Box, Chip, Typography, Collapse, IconButton } from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  eventId?: number | null;
  onSave: () => void;
  equipmentList: any[];
}

export const EventFormModal: React.FC<EventFormModalProps> = ({ open, onClose, eventId, onSave, equipmentList }) => {
  const [form, setForm] = useState({ 
    title: '', date: '', time: '12:00', end_time: '14:00', deadline: '', location: '', 
    content_type: 'PHOTO', document_link: '', result_link: '',
    max_participants: 1, required_skill: 'ANY', equipment_ids: [] as number[] 
  });
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      apiService.getSkills().then(res => setSkills(Array.isArray(res) ? res : res.results || []));
      apiService.getTemplates().then(res => setTemplates(Array.isArray(res) ? res : res.results || []));
    }
  }, [open]);

  useEffect(() => {
    if (open && eventId) {
      setLoading(true);
      apiService.getEvents().then((data: any) => {
        const events = Array.isArray(data) ? data : (data.results || []);
        const event = events.find((e: any) => e.id === eventId);
        if (event) {
          setForm({
            ...event,
            end_time: event.end_time || '',
            equipment_ids: event.booked_equipment?.map((eq: any) => eq.id) || []
          });
          setSelectedTemplate('');
        }
      }).finally(() => setLoading(false));
    } else if (open && !eventId) {
      setForm({ 
        title: '', date: '', time: '12:00', end_time: '14:00', deadline: '', location: '', 
        content_type: 'PHOTO', document_link: '', result_link: '',
        max_participants: 1, required_skill: 'ANY', equipment_ids: [] 
      });
      setSelectedTemplate('');
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
          required_skill: template.required_skill,
          max_participants: template.max_participants,
          equipment_ids: template.equipment || []
        }));
      }
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const payload = { ...form };
      if (!payload.end_time) payload.end_time = null as any;
      if (!payload.deadline) payload.deadline = null as any;
      
      const success = await apiService.saveEvent(eventId || null, payload);
      if (success) {
        toast.success("Сохранено");
        onSave();
        onClose();
      } else {
        toast.error("Ошибка сохранения");
      }
    } catch (err) {
      toast.error("Ошибка сохранения");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" sx={{ '& .MuiDialog-paper': { borderRadius: '24px' } }}>
      <DialogTitle sx={{ fontWeight: 900 }}>{eventId ? 'Редактирование задачи' : 'Новая задача'}</DialogTitle>
      <DialogContent dividers>
        
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
              {skills.length > 0 ? (
                skills.map(s => <MenuItem key={s.id} value={s.code}>{s.name}</MenuItem>)
              ) : (
                <MenuItem value="ANY">Любой</MenuItem>
              )}
            </Select>
          </FormControl>
        </Stack>

        <Box mt={2} mb={1}>
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
          <Box pt={1}>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
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
    </Dialog>
  );
};
export default EventFormModal;
