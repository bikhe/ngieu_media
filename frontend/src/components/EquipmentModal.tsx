import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
} from '@mui/material';

interface EquipmentItem {
  id: number;
  name: string;
}

interface EquipmentModalProps {
  open: boolean;
  onClose: () => void;
  equipment: EquipmentItem[];
  onConfirm: (selectedIds: number[]) => void;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  open,
  onClose,
  equipment,
  onConfirm,
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const handleToggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedIds);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Взять технику?</DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {equipment.length === 0 ? (
          <ListItem sx={{ py: 3 }}>
            <ListItemText primary="Нет доступного оборудования" />
          </ListItem>
        ) : (
          <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
            {equipment.map((item) => {
              const labelId = `checkbox-list-label-${item.id}`;
              return (
                <ListItem key={item.id} disablePadding>
                  <ListItemButton onClick={() => handleToggle(item.id)} dense>
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={selectedIds.includes(item.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText id={labelId} primary={item.name} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleConfirm} variant="contained">
          Записаться
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EquipmentModal;
