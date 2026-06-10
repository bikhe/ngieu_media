import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Typography,
} from '@mui/material';

interface EquipmentItem {
  id: number;
  name: string;
  available_quantity: number;
}

interface EventItem {
  id: number;
  title: string;
}

interface RequestEquipmentModalProps {
  open: boolean;
  onClose: () => void;
  equipmentList: EquipmentItem[];
  myEvents: EventItem[];
  onConfirm: (equipmentId: number, quantity: number, eventId: number | null, comment: string) => Promise<void>;
}

export const RequestEquipmentModal: React.FC<RequestEquipmentModalProps> = ({
  open,
  onClose,
  equipmentList,
  myEvents,
  onConfirm,
}) => {
  const [selectedEqId, setSelectedEqId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedEventId, setSelectedEventId] = useState<number | 'none'>('none');
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const selectedEq = equipmentList.find((e) => e.id === selectedEqId);
  const maxQty = selectedEq ? selectedEq.available_quantity : 1;

  const handleSubmit = async () => {
    if (selectedEqId === '') return;
    setSubmitting(true);
    try {
      const eventId = selectedEventId === 'none' ? null : selectedEventId;
      await onConfirm(selectedEqId, quantity, eventId, comment);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 'bold' }}>Запрос оборудования</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel id="eq-select-label">Выберите оборудование</InputLabel>
            <Select
              labelId="eq-select-label"
              value={selectedEqId}
              label="Выберите оборудование"
              onChange={(e) => {
                setSelectedEqId(Number(e.target.value));
                setQuantity(1); // Reset quantity when item changes
              }}
            >
              {equipmentList
                .filter((eq) => eq.available_quantity > 0)
                .map((eq) => (
                  <MenuItem key={eq.id} value={eq.id}>
                    {eq.name} (Доступно: {eq.available_quantity} шт.)
                  </MenuItem>
                ))}
              {equipmentList.filter((eq) => eq.available_quantity > 0).length === 0 && (
                <MenuItem disabled>Нет доступного оборудования</MenuItem>
              )}
            </Select>
          </FormControl>

          {selectedEq && (
            <TextField
              type="number"
              label="Количество"
              value={quantity}
              onChange={(e) => {
                const val = Math.max(1, Math.min(maxQty, parseInt(e.target.value) || 1));
                setQuantity(val);
              }}
              slotProps={{ htmlInput: { min: 1, max: maxQty } }}
              helperText={`Максимум: ${maxQty} шт.`}
              fullWidth
            />
          )}

          <FormControl fullWidth>
            <InputLabel id="event-select-label">Связать с задачей (опционально)</InputLabel>
            <Select
              labelId="event-select-label"
              value={selectedEventId}
              label="Связать с задачей (опционально)"
              onChange={(e) => setSelectedEventId(e.target.value as number | 'none')}
            >
              <MenuItem value="none">Не связывать</MenuItem>
              {myEvents.map((evt) => (
                <MenuItem key={evt.id} value={evt.id}>
                  {evt.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Цель получения / Комментарий"
            multiline
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} disabled={submitting}>
          Отмена
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={selectedEqId === '' || submitting}
        >
          {submitting ? 'Отправка...' : 'Отправить запрос'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RequestEquipmentModal;
