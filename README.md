# Driver Assignment Dashboard

Professional full-stack Driver Assignment Dashboard for **Manivtha Tours & Travels**.

The system helps administrators manage customers, bookings, drivers, vehicles, driver assignments, trip schedules, assignment conflicts, trip status, and operational reports from one centralized dashboard.

## Technology Stack

- Frontend: HTML5, CSS3, Vanilla JavaScript, Bootstrap 5, Font Awesome, Chart.js
- Backend: Python Flask, Flask REST APIs, Flask-CORS, SQLAlchemy ORM
- Database: MySQL

## Required Modules

- Dashboard
- Customer Management
- Booking Management
- Driver Management
- Vehicle Management
- Driver Assignment Management
- Trip Status Tracking
- Reports

No tourism packages, hotel booking, flight booking, payment, chatbot, public website, or marketing modules are included.

## Project Structure

```text
driver_assignment_dashboard/
  backend/
    app/
      __init__.py
      config.py
      extensions.py
      models.py
      routes.py
      utils.py
    .env.example
    requirements.txt
    run.py
    seed.py
  database/
    schema.sql
    sample_data.sql
  docs/
    API_DOCUMENTATION.md
    INSTALLATION_GUIDE.md
  frontend/
    index.html
    assets/
      css/styles.css
      js/app.js
  README.md
```

## Core Features

- Admin login, logout, and session management
- Dashboard summary cards and Chart.js analytics
- CRUD operations for customers, bookings, drivers, and vehicles
- Driver and vehicle assignment to bookings
- Reassignment with assignment history preservation
- Conflict prevention for driver and vehicle schedules
- Professional trip status tracking with colored badges
- Daily, weekly, and monthly assignment reports
- Driver utilization and vehicle utilization charts
- Responsive dashboard layout with collapsible sidebar

## Quick Start

1. Create the MySQL schema from `database/schema.sql`.
2. Copy `backend/.env.example` to `backend/.env` and update database credentials.
3. Install backend dependencies:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py
python run.py
```

4. Serve the frontend:

```powershell
cd frontend
python -m http.server 5500
```

5. Open `http://localhost:5500`.

Default login:

- Email: `admin@manivthatours.com`
- Password: `Admin@123`

## Documentation

- API documentation: `docs/API_DOCUMENTATION.md`
- Installation guide: `docs/INSTALLATION_GUIDE.md`
- MySQL schema: `database/schema.sql`
- Sample data: `database/sample_data.sql`
- Environment template: `backend/.env.example`
