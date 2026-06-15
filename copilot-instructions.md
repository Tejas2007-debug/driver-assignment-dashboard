Purpose

This file provides concise, repository-specific instructions to help Copilot-based sessions (or other AI assistants) understand how this project is structured, how to run it, and which repository conventions matter for making edits or generating code.

Build / run / test / lint (what exists)

Backend (Flask, Python 3.10+)
- Create virtualenv and install:  
  cd backend
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt
- Seed sample data (creates admin user if missing):  
  python seed.py
- Run dev server (single-process Flask):  
  python run.py  # binds 0.0.0.0:5000 by default

Frontend (static HTML/JS)
- Serve locally (static server):  
  cd frontend
  python -m http.server 5500
- Open: http://localhost:5500/index.html
- Note: frontend/assets/js/app.js sets API_BASE. For local dev change API_BASE to http://localhost:5000/api or proxy requests.

Tests / Lint
- No test runner, unit tests, or lint commands are configured in this repo (no pytest, no npm scripts, no flake8/black config present).
- If adding tests, use pytest for backend and run a single test:  
  python -m pytest tests/test_module.py::test_function  
(placeholder — tests not present)

High-level architecture (big-picture)

- Frontend: simple SPA-like static client (frontend/*.html + frontend/assets/js/app.js). Navigation is implemented client-side via a modules array. The client calls backend API endpoints using fetch(..., { credentials: "include" }) and expects a session cookie-based auth.

- Backend: Flask application (backend/app/) using application factory pattern (create_app in backend/app/__init__.py). SQLAlchemy (backend/app/extensions.py) defines models in backend/app/models.py. All HTTP API handlers live in backend/app/routes.py and are registered on blueprint /api.

- Persistence: MySQL (SQLAlchemy). The repository uses db.create_all() at startup/seed — there are no DB migrations (Alembic/Flask-Migrate not configured).

- Authentication: Server-side sessions (Flask session). The frontend relies on cookies and includes credentials on requests.

- Reporting/Exports: The backend exposes /reports and export endpoints that generate Excel and PDF using openpyxl and reportlab.

Key conventions and repository-specific patterns

- Booking code generation: Booking.create uses pattern "MTT-YYYYMMDD-####" (see create_booking). New booking_code is generated when not provided.

- Assignment history: Assignments are historical. Assignment.is_active flag identifies the current assignment. Reassigning marks the old assignment is_active=False and creates a new Assignment row; driver.availability_status and vehicle.status are updated accordingly.

- TripHistory audit: All trip status changes and assignment-related events append TripHistory rows for auditability.

- Deletion guards: Drivers, Vehicles, Bookings cannot be deleted if there are active assignments. Assignment deletion is only allowed when the related booking.status == "Completed".

- Schedule conflict checks: has_schedule_conflict(booking, driver_id=..., vehicle_id=..., exclude_assignment_id=...) is used to prevent overlapping assignments. The logic lives in backend/app/utils.py — prefer using that helper when adding assignment logic.

- Status enums: Booking, Driver, and Vehicle statuses are enums (see models.py and utils constants). Use those exact string values when interacting via API.

- API formats: Date fields use ISO (YYYY-MM-DD) and time fields use HH:MM. Endpoints expect/return JSON. The client sends and expects JSON responses in the format { ... } or error { "message": "..." }.

- Session-based auth considerations: All protected endpoints use login_required decorator and rely on Flask sessions. Ensure credentials: "include" is used and FRONTEND_ORIGIN is configured correctly in backend/.env for CORS.

- Server-side schema management: The app currently relies on db.create_all() and seed.py. When modifying models, anticipate needing a migration strategy (Alembic/Flask-Migrate) before applying to production DB.

Files to consult when changing behavior

- Backend entrypoints: backend/app/__init__.py, backend/run.py
- API handlers: backend/app/routes.py
- Domain models: backend/app/models.py
- Utilities & constants: backend/app/utils.py
- Frontend client: frontend/assets/js/app.js (single file controlling UI + API_BASE)
- Environment template: backend/.env.example
- Docs: docs/API_DOCUMENTATION.md and docs/INSTALLATION_GUIDE.md contain useful examples and endpoints mapping

How Copilot sessions should behave here (quick guidance)

- Prefer small, surgical edits. Reassignment/assignment logic, status transitions, and deletion guards are sensitive—read routes.py + models.py + utils.py before making changes.
- Update database model fields and then add migrations (the repo currently lacks migrations). If adding migrations, include migration commands in the repo docs.
- When changing API behavior, update docs/API_DOCUMENTATION.md and the frontend assets/js/app.js API_BASE if needed.
- Use server-side helpers for validation/conflict checks (require_fields, has_schedule_conflict).

Post-creation question

Would you like an MCP server configured for this web project (Playwright or similar) to run automated browser tests and UI checks? Reply yes to add a basic Playwright MCP server config.

Generated by: Copilot CLI assistant (concise repo-specific instructions).