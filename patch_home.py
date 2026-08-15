import re

with open('frontend/src/components/HomeScreen.tsx', 'r') as f:
    content = f.read()

# Add states for location modal
state_code = """
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationEventId, setLocationEventId] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');
"""
content = re.sub(r'const \[selectedTakeTaskEventId, setSelectedTakeTaskEventId\] = useState<number \| null>\(null\);', state_code + '\n  const [selectedTakeTaskEventId, setSelectedTakeTaskEventId] = useState<number | null>(null);', content)

# Modify handleTakeTask to handle locations
new_handleTakeTask = """  const handleTakeTask = async (eventId: number) => {
    const event = events.find(e => e.id === eventId);
    if (event?.locations?.length > 1) {
      setLocationEventId(eventId);
      setSelectedLocationId('');
      setLocationOpen(true);
      return;
    }
    proceedWithTakeTask(eventId, event?.locations?.[0]?.id);
  };

  const proceedWithTakeTask = async (eventId: number, locationId?: number) => {
    if (me.features?.equipment_booking !== true || equipmentList.length === 0) {
      setLoading(true);
      try {
        const res = await apiService.takeTask(eventId, [], locationId);
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
      // we need to remember the locationId somewhere, but wait, takeTask api takes location_id. 
      // let's just pass it to the equipment modal, or store it in state.
      setSelectedLocationId(locationId || '');
      setEquipmentOpen(true);
    }
  };

  const handleLocationConfirm = () => {
    if (locationEventId === null) return;
    if (!selectedLocationId) {
      alert("Выберите локацию");
      return;
    }
    const locId = selectedLocationId as number;
    setLocationOpen(false);
    proceedWithTakeTask(locationEventId, locId);
  };
"""

content = re.sub(r'  const handleTakeTask = async \(eventId: number\) => \{[\s\S]*?    \} else \{\n      setSelectedTakeTaskEventId\(eventId\);\n      setEquipmentOpen\(true\);\n    \}\n  \};', new_handleTakeTask, content)

# Modify handleEquipmentConfirm to pass locationId
new_equip_confirm = """  const handleEquipmentConfirm = async (selectedIds: number[]) => {
    if (selectedTakeTaskEventId === null) return;
    setLoading(true);
    try {
      const locId = selectedLocationId ? (selectedLocationId as number) : undefined;
      const res = await apiService.takeTask(selectedTakeTaskEventId, selectedIds, locId);
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
  };"""
content = re.sub(r'  const handleEquipmentConfirm = async \(selectedIds: number\[\]\) => \{[\s\S]*?  \};', new_equip_confirm, content)

# Add Location Dialog UI
loc_dialog = """
      {/* Выбор локации */}
      <Dialog open={locationOpen} onClose={() => setLocationOpen(false)} fullWidth maxWidth="xs" sx={{ '& .MuiDialog-paper': { borderRadius: '24px' } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Выберите локацию</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>Для этого мероприятия доступно несколько локаций. На какой из них вы будете работать?</Typography>
          <TextField
            select
            fullWidth
            label="Локация"
            value={selectedLocationId}
            onChange={e => setSelectedLocationId(e.target.value as number)}
          >
            {locationEventId && events.find(e => e.id === locationEventId)?.locations?.map((l: any) => (
              <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLocationOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleLocationConfirm}>Продолжить</Button>
        </DialogActions>
      </Dialog>
"""

content = re.sub(r'      \{equipmentOpen && \(', loc_dialog + '\n      {equipmentOpen && (', content)

with open('frontend/src/components/HomeScreen.tsx', 'w') as f:
    f.write(content)
