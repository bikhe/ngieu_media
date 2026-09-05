# Handoff Report: Milestone 1 - Optional Submission Time

## Observation
1. In `frontend/src/components/EventFormModal.tsx`, the `deadline` is an optional `datetime-local` field. In `handleSave`, there is logic to convert empty deadlines to `null`: `if (!payload.deadline) payload.deadline = null as any;`.
2. In `backend/api/events/serializers.py`, `EventSerializer.validate()` has a fallback logic block: `if date and not deadline: ...` which populates `attrs['deadline']` with a datetime 7 days ahead of the event date.
3. The `Event` model in `models.py` has `deadline = models.DateTimeField(null=True, blank=True)`.
4. Despite the fallback logic, the requirement states that event creation currently fails with a validation error when the deadline is empty.

## Logic Chain
1. When the frontend sends the payload with `deadline: ""` or `deadline: null`, DRF runs field-level validation (`to_internal_value` on fields) *before* the object-level `validate(self, attrs)` method is called.
2. DRF's `DateTimeField` does not inherently accept an empty string (`""`) as a valid empty value; it throws a `ValidationError` (e.g., "Datetime has wrong format") before the fallback logic in `validate()` even gets a chance to execute.
3. Even though the frontend attempts to set it to `null`, enforcing it explicitly in the backend's `to_internal_value` ensures that DRF converts empty strings to `None` before field validation kicks in.
4. Additionally, explicitly defining `deadline = serializers.DateTimeField(required=False, allow_null=True)` on the serializer guarantees that DRF treats the field as optional and nullable without relying solely on model inspection.

## Caveats
- The frontend currently converts empty deadlines to `null`, which should theoretically work with a properly configured `allow_null=True` field, but overriding `to_internal_value` provides an airtight guarantee against DRF format validation errors regardless of whether the frontend sends `""` or `null`.

## Conclusion
To fulfill the requirement and allow an empty or null deadline without throwing validation errors, the fix should be implemented on the backend in `EventSerializer`:

1. **Explicitly declare the field** to ensure DRF permits nulls:
   ```python
   deadline = serializers.DateTimeField(required=False, allow_null=True)
   ```
2. **Override `to_internal_value`** in `EventSerializer` to intercept `""` and map it to `None` before field validation triggers format errors:
   ```python
   def to_internal_value(self, data):
       # Ensure data is mutable
       _data = data.copy() if hasattr(data, 'copy') else dict(data)
       if _data.get('deadline') == '':
           _data['deadline'] = None
       return super().to_internal_value(_data)
   ```

No changes are strictly needed on the frontend since it already converts empty strings to `null`, but the backend update will robustly handle any empty submission.

## Verification Method
1. Apply the recommended changes to `backend/api/events/serializers.py`.
2. Spin up the backend container or test environment.
3. Submit a POST request to `/api/events/` with `deadline: ""` or `deadline: null` and verify that the event is successfully created and the deadline is populated with the 7-day fallback datetime.
