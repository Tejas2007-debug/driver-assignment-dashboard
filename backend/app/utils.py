from datetime import datetime, timedelta
from functools import wraps

from flask import jsonify, session

from .models import Assignment


BOOKING_STATUSES = {
    "Pending",
    "Confirmed",
    "Driver Assigned",
    "Vehicle Assigned",
    "Trip Started",
    "In Progress",
    "Completed",
    "Cancelled",
}
PAYMENT_STATUSES = {"Pending", "Partial", "Paid", "Refunded"}
DRIVER_STATUSES = {"Available", "Assigned", "Unavailable"}
VEHICLE_STATUSES = {"Available", "Assigned", "Maintenance"}

STATUS_TRANSITIONS = {
    "Pending": {"Confirmed", "Cancelled"},
    "Confirmed": {"Driver Assigned", "Cancelled"},
    "Driver Assigned": {"Vehicle Assigned", "Cancelled"},
    "Vehicle Assigned": {"Trip Started", "Cancelled"},
    "Trip Started": {"In Progress", "Cancelled"},
    "In Progress": {"Completed", "Cancelled"},
    "Completed": set(),
    "Cancelled": set(),
}


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"message": "Authentication required"}), 401
        return view(*args, **kwargs)

    return wrapped


def parse_date(value):
    return datetime.strptime(value, "%Y-%m-%d").date()


def parse_time(value):
    return datetime.strptime(value, "%H:%M").time()


def trip_window(booking):
    start = datetime.combine(booking.trip_date, booking.trip_time)
    return start, start + timedelta(hours=8)


def has_schedule_conflict(booking, driver_id=None, vehicle_id=None, exclude_assignment_id=None):
    start, end = trip_window(booking)
    query = Assignment.query.filter_by(is_active=True).join(Assignment.booking)
    if exclude_assignment_id:
        query = query.filter(Assignment.id != exclude_assignment_id)
    if driver_id:
        query = query.filter(Assignment.driver_id == driver_id)
    if vehicle_id:
        query = query.filter(Assignment.vehicle_id == vehicle_id)

    for assignment in query.all():
        if assignment.booking.status in {"Completed", "Cancelled"}:
            continue
        other_start, other_end = trip_window(assignment.booking)
        if start < other_end and end > other_start:
            return assignment
    return None


def is_valid_status_transition(current_status, next_status):
    if current_status == next_status:
        return True
    return next_status in STATUS_TRANSITIONS.get(current_status, set())


def require_fields(payload, fields):
    missing = [field for field in fields if payload.get(field) in (None, "")]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    return None
