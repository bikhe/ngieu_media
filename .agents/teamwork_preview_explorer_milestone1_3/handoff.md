# Observation
- The frontend form in `frontend/src/pages/admin/Dashboard.tsx` submits the `deadline` as an empty string (`""`) when left blank.
- The `backend/api/events/serializers.py` defines `EventSerializer` using `fields = '__all__'`. The `deadline` field on the `Event` model is `models.DateTimeField(null=True, blank=True)`.
- When DRF receives an empty string `""` for a DateTimeField, it throws a `ValidationError` ("Datetime has wrong format...") during `to_internal_value` (field-level validation), so it never reaches the `validate()` method where the 7-day fallback logic is implemented.
- `frontend/src/components/EventFormModal.tsx` handles this correctly by setting `payload.deadline = null as any;` if it's falsy, but `Dashboard.tsx` implements its own inline form and misses this cleanup.

# Logic Chain
1. The user creates an event via the Admin Dashboard but leaves the deadline blank.
2. The `Dashboard.tsx` form state maintains `deadline: ''`.
3. Upon save, `handleAction` sends `{ ...data }` directly, meaning `deadline: ""` is sent to the API.
4. The backend Django REST Framework parses the payload. The `EventSerializer` runs field-level validation.
5. The `DateTimeField` for `deadline` rejects the `""` string because it cannot be parsed into a datetime object. It responds with 400 Bad Request.
6. The serializer's `validate()` method (which contains the `if date and not deadline:` fallback) is never reached.

# Caveats
- `Dashboard.tsx`'s payload cleanup modifies `document_link` and `result_link`, but not `deadline` or `end_time`. `end_time` may also face similar issues if left empty (depending on field type), though it usually works if it's a TimeField and sent properly, but setting it to `null` is safer.

# Conclusion
We need to fix this at both the frontend and backend layers to adhere to the requirement ("The backend API should accept the payload with an empty or null deadline... The frontend form should allow an empty deadline."):
1. **Frontend**: Update `handleAction` in `frontend/src/pages/admin/Dashboard.tsx` (around line 114) to explicitly set `payload.deadline = null` if it's an empty string. 
2. **Backend**: Update `EventSerializer` in `backend/api/events/serializers.py` to override `to_internal_value`. Since request data can be an immutable `QueryDict`, copy the data, change `deadline` from `""` to `None`, and then call `super().to_internal_value(data)`. This ensures that even if `""` is sent, it is treated as `None` and reaches the `validate()` fallback.

# Verification Method
1. Modify the code as recommended.
2. In the frontend Admin Dashboard, try to create an event without specifying a deadline. It should successfully save.
3. Check the backend database or UI to ensure the 7-day fallback deadline was correctly applied.
4. Alternatively, use a `curl` or Postman request to POST `/api/events/` with `"deadline": ""` and ensure it returns 201 Created instead of 400 Bad Request.
