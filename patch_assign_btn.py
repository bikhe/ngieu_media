import re

with open('frontend/src/pages/admin/Dashboard.tsx', 'r') as f:
    content = f.read()

# For the calendar view
chip_group_pattern = r'(\{event\.media_participants\?\.length > 0 && \(\s*<Box sx=\{\{ display: \'flex\', gap: 0\.5, mb: 1\.5, flexWrap: \'wrap\' \}\}>\s*\{event\.media_participants\.map\(\(p: any\) => \{.*?\)\}\s*</Box>\s*\)\})'

# We want to change the rendering of participants so it always shows the <Box>, and inside it renders participants, plus a "+ СМИ" button for admins.
# Actually, the user wants to see their role and location too.
new_participants_render = """
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                        {event.media_participants?.map((p: any) => {
                          const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username;
                          let title = p.phone_number ? `${fullName} (${p.phone_number})` : fullName;
                          const details = event.participant_details?.[p.id.toString()] || {};
                          const role = eventRoles.find(r => r.id === details.role_id)?.name;
                          const loc = locations.find(l => l.id === details.location_id)?.name;
                          if (role || loc) title += ` [${role || 'СМИ'}${loc ? ` - ${loc}` : ''}]`;
                          return (
                            <Tooltip key={p.id} title={title}>
                              <Chip
                                avatar={<Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>{p.username.charAt(0).toUpperCase()}</Avatar>}
                                label={`${fullName}${role ? ` (${role})` : ''}`}
                                size="small"
                                variant="outlined"
                                onDelete={isAdmin ? () => handleRemoveParticipant(event.id, p.id) : undefined}
                                sx={{ height: 26, borderRadius: 13 }}
                              />
                            </Tooltip>
                          );
                        })}
                        {(isAdmin || user?.role === 'ORGANIZER') && (event.media_participants?.length || 0) < event.max_participants && (
                          <Chip 
                            label="+ СМИ" 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                            onClick={() => setAssignModal({ open: true, eventId: event.id, user_id: '', role_id: '', location_id: '' })} 
                            sx={{ height: 26, borderRadius: 13, cursor: 'pointer', borderStyle: 'dashed' }} 
                          />
                        )}
                      </Box>
"""

content = re.sub(chip_group_pattern, new_participants_render, content, flags=re.DOTALL)

with open('frontend/src/pages/admin/Dashboard.tsx', 'w') as f:
    f.write(content)
