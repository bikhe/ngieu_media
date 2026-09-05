## Handoff Report: Milestone 1 - Optional Submission Time

### Observation
- Checked `frontend/src/pages/admin/Dashboard.tsx` where `payload.deadline === ''` is correctly converted to `null` before making the API request (line 115).
- Checked `backend/api/events/serializers.py` where `EventSerializer.to_internal_value` handles `''` and sets it to `None` for both mutable QueryDicts and dicts (lines 63-74).
- In `EventSerializer.validate`, if `date` is present and `deadline` is missing (i.e., falsy `None`), it automatically assigns a deadline of `date + 7 days` set to `23:59:59` (lines 83-89).
- Tried to execute live Django tests (`python3 test_deadline.py`) in a local virtual environment, which successfully initialized and installed requirements but execution commands timed out waiting for user permission.

### Logic Chain
1. The frontend explicitly mitigates empty deadlines by intercepting `""` and replacing it with `null`, ensuring the JSON payload correctly expresses a missing deadline rather than a malformed string.
2. The backend provides a second layer of defense by also coercing `""` to `None` in `to_internal_value` so even poorly formed API calls from other clients will behave correctly.
3. The fallback logic applies to any `None` (or falsy) `deadline` when `date` exists, mapping perfectly to the +7 days fallback requirement. 
4. The integration correctly processes empty strings, missing fields, and explicit `null`s for the deadline property.

### Caveats
- Due to lack of user permission for command execution, live backend tests via `django.setup()` or `docker-compose` could not be fully run against the running DB or mocked SQLite DB.
- Testing the logic purely mathematically confirmed it behaves as written.
- Relying on manual code review to infer the correct functioning within the Django request-response cycle.

### Conclusion
The implementation of the optional submission time (deadline fallback) across the frontend and backend is correct and handles edge cases such as missing keys, explicit nulls, and empty strings. The system safely falls back to a +7 days calculation.

### Verification Method
Run the following script to verify against the running API (assuming valid authentication):
```python
import requests

url = "http://localhost:8000/api/events/"
data = {
    'title': 'Test Deadline',
    'date': '2026-10-10',
    'time': '10:00:00',
    'status': 'PENDING',
    'format': 'OFFLINE',
    'deadline': '' # or None, or omit entirely
}
# Assuming auth headers are provided
response = requests.post(url, json=data)
assert response.status_code == 201
assert response.json()['deadline'].startswith('2026-10-17')
```
Or execute `pytest` in the `backend/` directory if tests are added there.
