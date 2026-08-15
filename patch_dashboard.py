import re

with open('frontend/src/pages/admin/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add states for roles and users, and modals
states_code = """  const [eventRoles, setEventRoles] = useState<any[]>([]);
  const [mediaUsers, setMediaUsers] = useState<any[]>([]);
  const [createLocation, setCreateLocation] = useState({ open: false, name: '' });
  const [createRole, setCreateRole] = useState({ open: false, name: '' });
  const [assignModal, setAssignModal] = useState({ open: false, eventId: null as any, user_id: '', role_id: '', location_id: '' });
"""
content = re.sub(r'(const \[locations, setLocations\] = useState<any\[\]>\(\[\]\);)', r'\1\n' + states_code, content)

# Load data
load_data_code = """      const [e, u, eq, loc, rls, m_users] = await Promise.all([
        api.get('events/', { params }), 
        api.get('users/me/'),
        api.get('equipment/'), 
        api.get('locations/'),
        api.get('event-roles/'),
        api.get('users/', { params: { role: 'MEDIA' } })
      ]);"""
content = re.sub(r'const \[e, u, eq, loc\] = await Promise\.all\(\[\n.*?api\.get\(\'locations/\'\)\s*\]\);', load_data_code, content, flags=re.DOTALL)

# Set data
set_data_code = """      setLocations(loc.data.results !== undefined ? loc.data.results : loc.data);
      setEventRoles(rls.data.results !== undefined ? rls.data.results : rls.data);
      setMediaUsers(m_users.data.results !== undefined ? m_users.data.results : m_users.data);"""
content = re.sub(r'setLocations\(loc\.data\.results !== undefined \? loc\.data\.results : loc\.data\);', set_data_code, content)

# Actions
actions_code = """  const handleCreateLocation = async () => {
    try {
      const res = await api.post('locations/', { name: createLocation.name });
      setLocations([...locations, res.data]);
      setForm({...form, location_ids: [...form.location_ids, res.data.id]});
      setCreateLocation({ open: false, name: '' });
      toast.success("Локация создана");
    } catch { toast.error("Ошибка"); }
  };
  
  const handleCreateRole = async () => {
    try {
      const res = await api.post('event-roles/', { name: createRole.name });
      setEventRoles([...eventRoles, res.data]);
      setAssignModal({...assignModal, role_id: res.data.id});
      setCreateRole({ open: false, name: '' });
      toast.success("Роль создана");
    } catch { toast.error("Ошибка"); }
  };
  
  const handleAssignSubmit = async () => {
    try {
      if (!assignModal.user_id) return toast.error("Выберите пользователя");
      await api.post(`events/${assignModal.eventId}/assign_participant/`, {
        user_id: assignModal.user_id,
        role_id: assignModal.role_id || undefined,
        location_id: assignModal.location_id || undefined
      });
      toast.success("Участник назначен");
      setAssignModal({ open: false, eventId: null, user_id: '', role_id: '', location_id: '' });
      loadData();
    } catch { toast.error("Ошибка назначения"); }
  };
  
  const handleRemoveParticipant = async (eventId: number, userId: number) => {
    if (!window.confirm("Снять участника с задачи?")) return;
    try {
      await api.post(`events/${eventId}/remove_participant/`, { user_id: userId });
      toast.success("Участник снят");
      loadData();
    } catch { toast.error("Ошибка"); }
  };
"""
content = re.sub(r'(const handleProfileSave = async \(\) => {)', actions_code + r'\n  \1', content)

# Add Assignment Modals and Create Modals at the end (before </Box>)
modals_code = """
      {/* МОДАЛКА НАЗНАЧЕНИЯ */}
      <Dialog open={assignModal.open} onClose={() => setAssignModal({...assignModal, open: false})} fullWidth maxWidth="xs" sx={{ '& .MuiDialog-paper': { borderRadius: '24px' } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Назначить СМИ</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth margin="dense">
            <InputLabel>Сотрудник</InputLabel>
            <Select value={assignModal.user_id} label="Сотрудник" onChange={e => setAssignModal({...assignModal, user_id: e.target.value as any})}>
              {mediaUsers.map(u => <MenuItem key={u.id} value={u.id}>{u.first_name || u.username} {u.last_name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Роль</InputLabel>
            <Select 
              value={assignModal.role_id} 
              label="Роль" 
              onChange={e => {
                if (e.target.value === 'CREATE_NEW') setCreateRole({ open: true, name: '' });
                else setAssignModal({...assignModal, role_id: e.target.value as any});
              }}
            >
              <MenuItem value=""><em>Не назначена</em></MenuItem>
              <MenuItem value="CREATE_NEW" sx={{ color: 'primary.main', fontWeight: 'bold' }}>+ Создать новую</MenuItem>
              {eventRoles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Локация</InputLabel>
            <Select 
              value={assignModal.location_id} 
              label="Локация" 
              onChange={e => {
                if (e.target.value === 'CREATE_NEW') setCreateLocation({ open: true, name: '' });
                else setAssignModal({...assignModal, location_id: e.target.value as any});
              }}
            >
              <MenuItem value=""><em>Любая</em></MenuItem>
              <MenuItem value="CREATE_NEW" sx={{ color: 'primary.main', fontWeight: 'bold' }}>+ Создать новую</MenuItem>
              {locations.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAssignModal({...assignModal, open: false})}>Отмена</Button>
          <Button variant="contained" onClick={handleAssignSubmit}>Назначить</Button>
        </DialogActions>
      </Dialog>
      
      {/* Создание локации */}
      <Dialog open={createLocation.open} onClose={() => setCreateLocation({...createLocation, open: false})}>
        <DialogTitle>Новая локация</DialogTitle>
        <DialogContent><TextField autoFocus margin="dense" label="Название" fullWidth value={createLocation.name} onChange={e => setCreateLocation({...createLocation, name: e.target.value})} /></DialogContent>
        <DialogActions><Button onClick={() => setCreateLocation({...createLocation, open: false})}>Отмена</Button><Button onClick={handleCreateLocation}>Создать</Button></DialogActions>
      </Dialog>
      
      {/* Создание роли */}
      <Dialog open={createRole.open} onClose={() => setCreateRole({...createRole, open: false})}>
        <DialogTitle>Новая роль</DialogTitle>
        <DialogContent><TextField autoFocus margin="dense" label="Название" fullWidth value={createRole.name} onChange={e => setCreateRole({...createRole, name: e.target.value})} /></DialogContent>
        <DialogActions><Button onClick={() => setCreateRole({...createRole, open: false})}>Отмена</Button><Button onClick={handleCreateRole}>Создать</Button></DialogActions>
      </Dialog>
"""
content = re.sub(r'(    </Box>\n  \);\n};\n\nexport default Dashboard;)', modals_code + r'\1', content)

# Update location select in the Event Modal to have CREATE_NEW
loc_select_code = """            <Select
              multiple
              value={form.location_ids}
              onChange={(e:any) => {
                const values = e.target.value;
                if (values.includes('CREATE_NEW')) {
                  setCreateLocation({ open: true, name: '' });
                } else {
                  setForm({...form, location_ids: values});
                }
              }}
              input={<OutlinedInput label="Локации" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value: any) => (
                    <Chip key={value} label={locations.find(loc => loc.id === value)?.name || value} size="small" />
                  ))}
                </Box>
              )}
            >
              <MenuItem value="CREATE_NEW" sx={{ color: 'primary.main', fontWeight: 'bold' }}>+ Создать новую</MenuItem>
              {locations.map((loc) => (
                <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
              ))}
            </Select>"""
content = re.sub(r'<Select\n\s*multiple\n\s*value=\{form\.location_ids\}.*?</Select>', loc_select_code, content, flags=re.DOTALL)

with open('frontend/src/pages/admin/Dashboard.tsx', 'w') as f:
    f.write(content)
