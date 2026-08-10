import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Tabs, Tab, Box, Typography, TextField, IconButton, Switch, FormControlLabel,
  Select, MenuItem, InputLabel, FormControl, CircularProgress,
  List, ListItem, ListItemText, ListItemSecondaryAction, Paper
} from '@mui/material';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';

interface AdminPanelModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AdminPanelModal({ open, onClose }: AdminPanelModalProps) {
  const [tab, setTab] = useState(0);
  const [skills, setSkills] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [editSkillId, setEditSkillId] = useState<number | null>(null);
  const [skillForm, setSkillForm] = useState({ name: '', code: '', is_pro: false, is_default: false });

  const [editTemplateId, setEditTemplateId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', content_type: 'PHOTO', required_skill: 'ANY', max_participants: 1 });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 0) {
        const res = await apiService.getSkills();
        setSkills(Array.isArray(res) ? res : res.results || []);
      } else {
        const res = await apiService.getTemplates();
        setTemplates(Array.isArray(res) ? res : res.results || []);
        
        // Load skills for select in templates
        const skillsRes = await apiService.getSkills();
        setSkills(Array.isArray(skillsRes) ? skillsRes : skillsRes.results || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSkill = async () => {
    if (!skillForm.name || !skillForm.code) return;
    const success = await apiService.saveSkill(editSkillId, skillForm);
    if (success) {
      setEditSkillId(null);
      setSkillForm({ name: '', code: '', is_pro: false, is_default: false });
      loadData();
    }
  };

  const handleDeleteSkill = async (id: number) => {
    if (window.confirm("Удалить роль?")) {
      const success = await apiService.deleteSkill(id);
      if (success) loadData();
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name) return;
    const success = await apiService.saveTemplate(editTemplateId, templateForm);
    if (success) {
      setEditTemplateId(null);
      setTemplateForm({ name: '', content_type: 'PHOTO', required_skill: 'ANY', max_participants: 1 });
      loadData();
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (window.confirm("Удалить шаблон?")) {
      const success = await apiService.deleteTemplate(id);
      if (success) loadData();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Настройки платформы</DialogTitle>
      
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
        <Tab label="Навыки / Роли" />
        <Tab label="Шаблоны съемок" />
      </Tabs>

      <DialogContent sx={{ minHeight: '300px' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
        ) : (
          <Box mt={2}>
            {tab === 0 && (
              <Box>
                <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                  <Typography variant="subtitle2" mb={2}>
                    {editSkillId ? 'Редактировать роль' : 'Добавить новую роль'}
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <TextField 
                      label="Название (например: Видео)" 
                      size="small" 
                      value={skillForm.name} 
                      onChange={e => setSkillForm({...skillForm, name: e.target.value})}
                    />
                    <TextField 
                      label="Код (латиницей, например: VIDEO)" 
                      size="small" 
                      value={skillForm.code} 
                      onChange={e => setSkillForm({...skillForm, code: e.target.value.toUpperCase()})}
                    />
                    <Box display="flex" gap={2}>
                      <FormControlLabel 
                        control={<Switch checked={skillForm.is_pro} onChange={e => setSkillForm({...skillForm, is_pro: e.target.checked})} />} 
                        label="Может брать любые задачи (Pro)" 
                      />
                      <FormControlLabel 
                        control={<Switch checked={skillForm.is_default} onChange={e => setSkillForm({...skillForm, is_default: e.target.checked})} />} 
                        label="По умолчанию" 
                      />
                    </Box>
                    <Box display="flex" justifyContent="flex-end" gap={1}>
                      {editSkillId && (
                        <Button onClick={() => { setEditSkillId(null); setSkillForm({ name: '', code: '', is_pro: false, is_default: false }); }}>
                          Отмена
                        </Button>
                      )}
                      <Button variant="contained" onClick={handleSaveSkill}>
                        Сохранить
                      </Button>
                    </Box>
                  </Box>
                </Paper>

                <List>
                  {skills.map(s => (
                    <ListItem key={s.id} divider>
                      <ListItemText 
                        primary={`${s.name} (${s.code})`} 
                        secondary={(s.is_pro ? "PRO " : "") + (s.is_default ? "По умолчанию" : "")} 
                      />
                      <ListItemSecondaryAction>
                        <IconButton size="small" onClick={() => {
                          setEditSkillId(s.id);
                          setSkillForm(s);
                        }}><Edit2 size={16} /></IconButton>
                        <IconButton size="small" onClick={() => handleDeleteSkill(s.id)} color="error"><Trash2 size={16} /></IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {tab === 1 && (
              <Box>
                <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                  <Typography variant="subtitle2" mb={2}>
                    {editTemplateId ? 'Редактировать шаблон' : 'Добавить шаблон'}
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <TextField 
                      label="Название шаблона (например: Отчетный ролик)" 
                      size="small" 
                      value={templateForm.name} 
                      onChange={e => setTemplateForm({...templateForm, name: e.target.value})}
                    />
                    
                    <FormControl size="small">
                      <InputLabel>Тип контента</InputLabel>
                      <Select 
                        value={templateForm.content_type} 
                        label="Тип контента"
                        onChange={e => setTemplateForm({...templateForm, content_type: e.target.value})}
                      >
                        <MenuItem value="PHOTO">Фото</MenuItem>
                        <MenuItem value="VIDEO">Видео</MenuItem>
                        <MenuItem value="ALL">Всё вместе</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl size="small">
                      <InputLabel>Требуемый навык</InputLabel>
                      <Select 
                        value={templateForm.required_skill} 
                        label="Требуемый навык"
                        onChange={e => setTemplateForm({...templateForm, required_skill: e.target.value as string})}
                      >
                        {skills.map(s => (
                          <MenuItem key={s.id} value={s.code}>{s.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField 
                      label="Количество мест" 
                      type="number"
                      size="small" 
                      value={templateForm.max_participants} 
                      onChange={e => setTemplateForm({...templateForm, max_participants: parseInt(e.target.value) || 1})}
                    />
                    
                    <Box display="flex" justifyContent="flex-end" gap={1}>
                      {editTemplateId && (
                        <Button onClick={() => { setEditTemplateId(null); setTemplateForm({ name: '', content_type: 'PHOTO', required_skill: 'ANY', max_participants: 1 }); }}>
                          Отмена
                        </Button>
                      )}
                      <Button variant="contained" onClick={handleSaveTemplate}>
                        Сохранить
                      </Button>
                    </Box>
                  </Box>
                </Paper>

                <List>
                  {templates.map(t => (
                    <ListItem key={t.id} divider>
                      <ListItemText 
                        primary={t.name} 
                        secondary={`${t.content_type}, ${t.required_skill}, ${t.max_participants} чел.`} 
                      />
                      <ListItemSecondaryAction>
                        <IconButton size="small" onClick={() => {
                          setEditTemplateId(t.id);
                          setTemplateForm(t);
                        }}><Edit2 size={16} /></IconButton>
                        <IconButton size="small" onClick={() => handleDeleteTemplate(t.id)} color="error"><Trash2 size={16} /></IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}
