# Driver Assignment Dashboard API Documentation

Base URL: `http://localhost:5000/api`

All protected endpoints require an authenticated Flask session. The frontend sends requests with `credentials: "include"`.

## Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Admin login |
| POST | `/auth/logout` | Logout current admin |
| GET | `/auth/me` | Get current session user |

Login body:

```json
{
  "email": "admin@manivthatours.com",
  "password": "Admin@123"
}
```

## Dashboard

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | Summary cards, booking analytics, status overview, recent assignments, upcoming trips |

## Customers

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/customers?search=` | List/search customers |
| POST | `/customers` | Add customer |
| GET | `/customers/<id>` | View customer details |
| PUT | `/customers/<id>` | Edit customer |
| DELETE | `/customers/<id>` | Delete customer |

Required fields: `name`, `phone`

## Bookings

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/bookings?search=&status=` | List/search/filter bookings |
| POST | `/bookings` | Create booking |
| PUT | `/bookings/<id>` | Edit booking |
| DELETE | `/bookings/<id>` | Delete booking |

Status values: `Pending`, `Confirmed`, `Driver Assigned`, `Trip Started`, `Completed`

## Drivers

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/drivers?search=` | List/search drivers |
| POST | `/drivers` | Add driver |
| PUT | `/drivers/<id>` | Edit driver or update availability |
| DELETE | `/drivers/<id>` | Delete driver |

Availability values: `Available`, `Assigned`, `Unavailable`

## Vehicles

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/vehicles?search=` | List/search vehicles |
| POST | `/vehicles` | Add vehicle |
| PUT | `/vehicles/<id>` | Edit vehicle or update status |
| DELETE | `/vehicles/<id>` | Delete vehicle |

Vehicle status values: `Available`, `Assigned`, `Maintenance`

## Driver Assignments

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/assignments` | View assignment history |
| POST | `/assignments` | Assign driver and vehicle to booking |
| PUT | `/assignments/<id>` | Reassign driver and/or vehicle |

Validation enforced:

- Booking can have only one active assignment.
- Unavailable drivers cannot be assigned.
- Vehicles in maintenance cannot be assigned.
- Driver schedule conflicts are prevented.
- Vehicle schedule conflicts are prevented.
- Reassignment preserves historical assignment records.

## Trip Status Tracking

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/trips` | List trips with customer, assignment, route, schedule, and status |
| PUT | `/trips/<booking_id>/status` | Update trip status |

When a trip is marked `Completed`, the assigned driver and vehicle are released back to `Available`.

## Reports

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/reports?period=daily` | Daily assignment report and utilization |
| GET | `/reports?period=weekly` | Weekly assignment report and utilization |
| GET | `/reports?period=monthly` | Monthly assignment report and utilization |

Reports include assignment tables, driver utilization, and vehicle utilization.
