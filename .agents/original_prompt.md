# Original User Request

## Initial Request — 2026-08-19T17:26:00Z

Fix three specific issues in the Ngieu Media platform related to events: making submission time optional during event creation, adding an attendance button for admins, and allowing Media (СМИ) users to sign up for events.

Working directory: /home/bikhe/ngieu-media/ngieu_media-main
Integrity mode: development

## Requirements

### R1. Make Submission Time Optional
Event creation should succeed even if the submission time (deadline) is not explicitly provided. Currently, it fails despite having fallback logic.

### R2. Admin Attendance Button
Add a button to the event interface that allows an Admin to join/attend an event themselves. When an Admin clicks the "Go to event" (Пойти на мероприятие) button, they should be added to the `media_participants` list, just like regular Media users.

### R3. Media Self-Signup
Ensure that users with the 'MEDIA' (СМИ) role can sign themselves up for an event. Any Media user can sign up as long as `max_participants` is not reached.

## Acceptance Criteria

### Event Creation
- [ ] An event can be successfully created via the frontend form when the "deadline" field is left empty.
- [ ] The backend API properly accepts the payload with an empty or null deadline and applies the 7-day fallback logic without throwing validation errors.

### Admin Button
- [ ] Admins see a "Go to event" (Пойти на мероприятие) button on the event interface (EventCard/Modal) if they are not already participating.
- [ ] Clicking the button calls the API to successfully add the Admin to the event's `media_participants` list.

### Media Signup
- [ ] Media users see a "Take event" or "Join" button for open events on their home screen.
- [ ] Clicking the button calls the API to successfully add the Media user to the participants list, provided the number of participants is less than `max_participants`.
