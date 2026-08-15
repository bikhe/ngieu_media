import re

with open('frontend/src/components/EventFormModal.tsx', 'r') as f:
    content = f.read()

# Add states for location modal
state_code = """
  const [locations, setLocations] = useState<any[]>([]);
  const [createLocation, setCreateLocation] = useState({ open: false, name: '' });
"""
content = re.sub(r'const \[loading, setLoading\] = useState\(false\);', r'const [loading, setLoading] = useState(false);\n' + state_code, content)

# Load locations
load_loc_code = """
    const loadLocs = async () => {
      try {
        const res = await apiService.getLocations();
        setLocations(res);
      } catch (e) {
        console.error(e);
      }
    };
    loadLocs();
"""
content = re.sub(r'const loadTemplatesAndSkills = async \(\) => \{', load_loc_code + '\n    const loadTemplatesAndSkills = async () => {', content)

# Change location to location_ids
content = content.replace("location: ''", "location_ids: [] as number[], short_comment: ''")
content = content.replace("location: eventData.location || ''", "location_ids: eventData.locations?.map((l:any) => l.id) || [], short_comment: eventData.short_comment || ''")

# Replace the text field
loc_select = """
        <FormControl fullWidth margin="normal">
          <InputLabel>Локации</InputLabel>
          <Select
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
          </Select>
        </FormControl>
"""
content = re.sub(r'<TextField fullWidth label="Локация" margin="normal" value=\{form\.location\} onChange=\{e => setForm\(\{\.\.\.form, location: e\.target\.value\}\)\} />', loc_select, content)

# Add create location modal & handler
handler = """
  const handleCreateLocation = async () => {
    try {
      const res = await apiService.createLocation(createLocation.name);
      setLocations([...locations, res]);
      setForm({...form, location_ids: [...form.location_ids, res.id]});
      setCreateLocation({ open: false, name: '' });
    } catch {
      alert("Ошибка");
    }
  };
"""
content = re.sub(r'const handleSubmit = async \(\) => \{', handler + '\n  const handleSubmit = async () => {', content)

modal = """
      <Dialog open={createLocation.open} onClose={() => setCreateLocation({...createLocation, open: false})}>
        <DialogTitle>Новая локация</DialogTitle>
        <DialogContent><TextField autoFocus margin="dense" label="Название" fullWidth value={createLocation.name} onChange={e => setCreateLocation({...createLocation, name: e.target.value})} /></DialogContent>
        <DialogActions><Button onClick={() => setCreateLocation({...createLocation, open: false})}>Отмена</Button><Button onClick={handleCreateLocation}>Создать</Button></DialogActions>
      </Dialog>
"""
content = re.sub(r'    </Dialog>\n  \);\n};\n\nexport default EventFormModal;', '    </Dialog>\n' + modal + '\n  );\n};\n\nexport default EventFormModal;', content)

# Add imports for Chip, Box, OutlinedInput
content = re.sub(r'import \{\n', 'import {\n  Chip,\n  Box,\n  OutlinedInput,\n', content)

with open('frontend/src/components/EventFormModal.tsx', 'w') as f:
    f.write(content)
