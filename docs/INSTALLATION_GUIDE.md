# Installation Guide

## Prerequisites

- Python 3.10 or newer
- MySQL 8.x
- A static file server for the frontend, such as VS Code Live Server or Python's built-in server

## 1. Create MySQL Database

```sql
SOURCE database/schema.sql;
```

Optional sample SQL data:

```sql
SOURCE database/sample_data.sql;
```

For a valid hashed admin password, prefer the Python seed script in step 4.

## 2. Configure Backend Environment

Copy the example environment file:

```powershell
Copy-Item backend\.env.example backend\.env
```

Update `backend/.env`:

```env
SECRET_KEY=change-this-secret-key
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/driver_assignment_dashboard
FRONTEND_ORIGIN=http://localhost:5500
```

## 3. Install Backend Dependencies

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 4. Seed Sample Data

```powershell
python seed.py
```

Default admin login:

- Email: `admin@manivthatours.com`
- Password: `Admin@123`

## 5. Start Flask API

```powershell
python run.py
```

Backend URL: `http://localhost:5000`

## 6. Start Frontend

From the project root:

```powershell
cd frontend
python -m http.server 5500
```

Open: `http://localhost:5500/index.html`

After login, the application redirects to `dashboard.html`. The separate module pages are:

- `dashboard.html`
- `customers.html`
- `bookings.html`
- `drivers.html`
- `vehicles.html`
- `assignments.html`
- `trips.html`
- `reports.html`

## Notes

- The frontend uses `fetch()` and session cookies.
- Keep `FRONTEND_ORIGIN` aligned with the URL used to serve the frontend.
- The application is intentionally limited to dashboard, customers, bookings, drivers, vehicles, assignments, trip tracking, and reports.
