# Observation
1. In `frontend/src/pages/admin/Dashboard.tsx`, the event creation form maintains the `deadline` state as `""` (empty string) by default. When the form is submitted via `handleAction(modal.id, 'save', form)`, the payload sends `"deadline": ""` to the backend. (Unlike `EventFormModal.tsx`, which explicitly converts `""` to `null` before sending).
2. In `backend/api/events/serializers.py`, the `EventSerializer` inherits a `DateTimeField` for `deadline` from the `Event` model. DRF's `DateTimeField` raises a validation error ("Datetime has wrong format") during `to_internal_value` if it receives an empty string `""`, because it expects a valid ISO datetime string or `null` (since `allow_null=True`). This happens *before* the custom `validate()` method with the 7-day fallback logic can run.
3. The fallback logic in `EventSerializer.validate()` correctly checks `if date and not deadline:` and assigns a datetime 7 days in the future, but it is currently unreachable when `deadline` is sent as `""`.

# Logic Chain
1. The backend fails with a validation error because `""` is not a valid datetime string for DRF's `DateTimeField`, even when `allow_null=True`.
2. To meet the requirement ("The backend API should accept the payload with an empty or null deadline"), the backend serializer must intercept the payload and convert an empty string `""` for `deadline` into `None` before DRF runs its standard field-level validation.
3. By overriding `to_internal_value` in `EventSerializer` to map `deadline: ""` to `None`, the built-in `DateTimeField` will accept it (due to `allow_null=True`), and the data will pass to `validate()`, where the 7-day fallback logic will execute successfully.
4. For frontend consistency, `Dashboard.tsx` should ideally also be updated to set `payload.deadline = null` if it is falsy, just as `EventFormModal.tsx` does, ensuring clean data transmission.

# Caveats
No caveats. The fix directly addresses the problem without side effects on existing valid datetime strings.

# Conclusion
**Recommended Fix Strategy:**
1. **Backend (`backend/api/events/serializers.py`)**: 
   Add a `to_internal_value` method to `EventSerializer` to gracefully convert empty string deadlines to `None`:
   ```python
    def to_internal_value(self, data):
        # Make a mutable copy of the data (handles both dict and QueryDict)
        mutable_data = data.copy() if hasattr(data, 'copy') else data
        if mutable_data.get('deadline') == '':
            mutable_data['deadline'] = None
        return super().to_internal_value(mutable_data)
   ```
2. **Frontend (`frontend/src/pages/admin/Dashboard.tsx`)**:
   In `handleAction` (around line 114), before the payload is sent, convert empty string `deadline` and `end_time` to `null` to match `EventFormModal.tsx`:
   ```typescript
      else if (action === 'save') {
        const payload = { ...data };
        if (!payload.end_time) payload.end_time = null;
        if (!payload.deadline) payload.deadline = null;
        // ... (existing code for document_link, etc.)
   ```

# Verification Method
1. Start the backend and frontend servers.
2. Log into the application and open the admin dashboard event creation modal (`Dashboard.tsx`).
3. Fill out the required event fields but leave the "Дедлайн сдачи" (deadline) field completely empty.
4. Submit the form. It should succeed without displaying a validation error.
5. Verify in the database (or API response) that the created event has a `deadline` set exactly 7 days after the event's `date` at 23:59:59.
