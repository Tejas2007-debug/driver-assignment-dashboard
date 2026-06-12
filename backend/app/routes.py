from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from reportlab.lib import colors

from io import BytesIO
from flask import send_file
from openpyxl import Workbook

from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func, or_

from .extensions import db
from .models import Assignment, Booking, Customer, Driver, TripHistory, User, Vehicle
from .utils import (
    BOOKING_STATUSES,
    DRIVER_STATUSES,
    VEHICLE_STATUSES,
    has_schedule_conflict,
    login_required,
    parse_date,
    parse_time,
    require_fields,
)

api_bp = Blueprint("api", __name__)


def ok(data=None, status=200):
    return jsonify(data or {}), status


def fail(message, status=400):
    return jsonify({"message": message}), status


def current_user_id():
    return session.get("user_id")


@api_bp.post("/auth/login")
def login():
    payload = request.get_json() or {}
    error = require_fields(payload, ["email", "password"])
    if error:
        return fail(error)

    user = User.query.filter_by(email=payload["email"], is_active=True).first()
    if not user or not user.check_password(payload["password"]):
        return fail("Invalid email or password", 401)

    session.permanent = True
    session["user_id"] = user.id
    return ok({"user": user.to_dict()})


@api_bp.post("/auth/logout")
@login_required
def logout():
    session.clear()
    return ok({"message": "Logged out"})


@api_bp.get("/auth/me")
def me():
    user_id = session.get("user_id")
    if not user_id:
        return fail("Authentication required", 401)
    user = User.query.get(user_id)
    return ok({"user": user.to_dict()})


@api_bp.get("/dashboard")
@login_required
def dashboard():
    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    cards = {
        "total_bookings": Booking.query.count(),
        "active_trips": Booking.query.filter(Booking.status.in_(["Driver Assigned", "Trip Started"])).count(),
        "completed_trips": Booking.query.filter_by(status="Completed").count(),
        "available_drivers": Driver.query.filter_by(availability_status="Available").count(),
        "assigned_drivers": Driver.query.filter_by(availability_status="Assigned").count(),
        "available_vehicles": Vehicle.query.filter_by(status="Available").count(),
    }

    daily = (
        db.session.query(Booking.trip_date, func.count(Booking.id))
        .filter(Booking.trip_date >= today - timedelta(days=6))
        .group_by(Booking.trip_date)
        .order_by(Booking.trip_date)
        .all()
    )
    weekly = (
        db.session.query(Booking.trip_date, func.count(Booking.id))
        .filter(Booking.trip_date >= week_start - timedelta(weeks=5))
        .group_by(Booking.trip_date)
        .order_by(Booking.trip_date)
        .all()
    )
    status_overview = db.session.query(Booking.status, func.count(Booking.id)).group_by(Booking.status).all()

    recent_assignments = Assignment.query.order_by(Assignment.created_at.desc()).limit(8).all()
    upcoming_trips = (
        Booking.query.filter(Booking.trip_date >= today, Booking.status.in_(["Confirmed", "Driver Assigned", "Trip Started"]))
        .order_by(Booking.trip_date, Booking.trip_time)
        .limit(8)
        .all()
    )

    return ok(
        {
            "cards": cards,
            "daily_bookings": [{"label": item[0].strftime("%d %b"), "value": item[1]} for item in daily],
            "weekly_bookings": [{"label": item[0].strftime("%d %b"), "value": item[1]} for item in weekly],
            "trip_status_overview": [{"label": item[0], "value": item[1]} for item in status_overview],
            "recent_assignments": [item.to_dict() for item in recent_assignments],
            "upcoming_trips": [item.to_dict() for item in upcoming_trips],
        }
    )


@api_bp.get("/customers")
@login_required
def list_customers():
    search = request.args.get("search", "")
    query = Customer.query
    if search:
        like = f"%{search}%"
        query = query.filter(or_(Customer.name.ilike(like), Customer.phone.ilike(like), Customer.email.ilike(like)))
    return ok({"customers": [item.to_dict() for item in query.order_by(Customer.created_at.desc()).all()]})


@api_bp.post("/customers")
@login_required
def create_customer():
    payload = request.get_json() or {}
    error = require_fields(payload, ["name", "phone"])
    if error:
        return fail(error)
    customer = Customer(name=payload["name"], phone=payload["phone"], email=payload.get("email"), address=payload.get("address"))
    db.session.add(customer)
    db.session.commit()
    return ok({"customer": customer.to_dict()}, 201)


@api_bp.route("/customers/<int:customer_id>", methods=["GET", "PUT", "DELETE"])
@login_required
def customer_detail(customer_id):
    customer = Customer.query.get_or_404(customer_id)

    if request.method == "GET":
        return ok({"customer": customer.to_dict(include_bookings=True)})

    if request.method == "DELETE":
        existing_booking = Booking.query.filter_by(
            customer_id=customer.id
        ).first()

        if existing_booking:
            return fail(
                "Customer cannot be deleted because bookings are associated with this customer.",
                400,
            )

        db.session.delete(customer)
        db.session.commit()
        return ok({"message": "Customer deleted"})

    payload = request.get_json() or {}

    customer.name = payload.get("name", customer.name)
    customer.phone = payload.get("phone", customer.phone)
    customer.email = payload.get("email", customer.email)
    customer.address = payload.get("address", customer.address)

    db.session.commit()

    return ok({"customer": customer.to_dict()})

@api_bp.get("/drivers")
@login_required
def list_drivers():
    search = request.args.get("search", "")
    query = Driver.query
    if search:
        like = f"%{search}%"
        query = query.filter(or_(Driver.name.ilike(like), Driver.phone.ilike(like), Driver.license_number.ilike(like)))
    return ok({"drivers": [item.to_dict() for item in query.order_by(Driver.created_at.desc()).all()]})


@api_bp.post("/drivers")
@login_required
def create_driver():
    payload = request.get_json() or {}
    error = require_fields(payload, ["name", "phone", "license_number", "experience"])
    if error:
        return fail(error)
    driver = Driver(
        name=payload["name"],
        phone=payload["phone"],
        license_number=payload["license_number"],
        experience=int(payload["experience"]),
        availability_status=payload.get("availability_status", "Available"),
    )
    if driver.availability_status not in DRIVER_STATUSES:
        return fail("Invalid driver availability status")
    db.session.add(driver)
    db.session.commit()
    return ok({"driver": driver.to_dict()}, 201)


@api_bp.route("/drivers/<int:driver_id>", methods=["PUT", "DELETE"])
@login_required
def driver_detail(driver_id):
    driver = Driver.query.get_or_404(driver_id)

    if request.method == "DELETE":
        active_assignment = Assignment.query.filter_by(
            driver_id=driver.id,
            is_active=True
        ).first()

        if active_assignment:
            return fail(
                "Driver has active assignments and cannot be deleted.",
                400,
            )

        db.session.delete(driver)
        db.session.commit()
        return ok({"message": "Driver deleted"})

    payload = request.get_json() or {}

    status = payload.get(
        "availability_status",
        driver.availability_status
    )

    if status not in DRIVER_STATUSES:
        return fail("Invalid driver availability status")

    driver.name = payload.get("name", driver.name)
    driver.phone = payload.get("phone", driver.phone)
    driver.license_number = payload.get(
        "license_number",
        driver.license_number
    )
    driver.experience = int(
        payload.get("experience", driver.experience)
    )
    driver.availability_status = status

    db.session.commit()

    return ok({"driver": driver.to_dict()})


@api_bp.get("/vehicles")
@login_required
def list_vehicles():
    search = request.args.get("search", "")
    query = Vehicle.query
    if search:
        like = f"%{search}%"
        query = query.filter(or_(Vehicle.name.ilike(like), Vehicle.vehicle_number.ilike(like), Vehicle.vehicle_type.ilike(like)))
    return ok({"vehicles": [item.to_dict() for item in query.order_by(Vehicle.created_at.desc()).all()]})


@api_bp.post("/vehicles")
@login_required
def create_vehicle():
    payload = request.get_json() or {}
    error = require_fields(payload, ["name", "vehicle_number", "vehicle_type", "capacity"])
    if error:
        return fail(error)
    vehicle = Vehicle(
        name=payload["name"],
        vehicle_number=payload["vehicle_number"],
        vehicle_type=payload["vehicle_type"],
        capacity=int(payload["capacity"]),
        status=payload.get("status", "Available"),
    )
    if vehicle.status not in VEHICLE_STATUSES:
        return fail("Invalid vehicle status")
    db.session.add(vehicle)
    db.session.commit()
    return ok({"vehicle": vehicle.to_dict()}, 201)


@api_bp.route("/vehicles/<int:vehicle_id>", methods=["PUT", "DELETE"])
@login_required
def vehicle_detail(vehicle_id):
    vehicle = Vehicle.query.get_or_404(vehicle_id)

    if request.method == "DELETE":
        active_assignment = Assignment.query.filter_by(
            vehicle_id=vehicle.id,
            is_active=True
        ).first()

        if active_assignment:
            return fail(
                "Vehicle has active assignments and cannot be deleted.",
                400,
            )

        db.session.delete(vehicle)
        db.session.commit()
        return ok({"message": "Vehicle deleted"})

    payload = request.get_json() or {}

    status = payload.get(
        "status",
        vehicle.status
    )

    if status not in VEHICLE_STATUSES:
        return fail("Invalid vehicle status")

    vehicle.name = payload.get("name", vehicle.name)
    vehicle.vehicle_number = payload.get(
        "vehicle_number",
        vehicle.vehicle_number
    )
    vehicle.vehicle_type = payload.get(
        "vehicle_type",
        vehicle.vehicle_type
    )
    vehicle.capacity = int(
        payload.get("capacity", vehicle.capacity)
    )
    vehicle.status = status

    db.session.commit()

    return ok({"vehicle": vehicle.to_dict()})


@api_bp.get("/bookings")
@login_required
def list_bookings():
    search = request.args.get("search", "")
    status = request.args.get("status", "")
    query = Booking.query.join(Customer)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Booking.booking_code.ilike(like),
                Customer.name.ilike(like),
                Booking.pickup_location.ilike(like),
                Booking.drop_location.ilike(like),
            )
        )
    if status:
        query = query.filter(Booking.status == status)
    return ok({"bookings": [item.to_dict() for item in query.order_by(Booking.trip_date.desc(), Booking.trip_time.desc()).all()]})


@api_bp.post("/bookings")
@login_required
def create_booking():
    payload = request.get_json() or {}
    error = require_fields(payload, ["customer_id", "pickup_location", "drop_location", "trip_date", "trip_time", "vehicle_type"])
    if error:
        return fail(error)
    booking_count = Booking.query.count() + 1
    booking = Booking(
        booking_code=payload.get("booking_code") or f"MTT-{datetime.utcnow().strftime('%Y%m%d')}-{booking_count:04d}",
        customer_id=int(payload["customer_id"]),
        pickup_location=payload["pickup_location"],
        drop_location=payload["drop_location"],
        trip_date=parse_date(payload["trip_date"]),
        trip_time=parse_time(payload["trip_time"]),
        vehicle_type=payload["vehicle_type"],
        status=payload.get("status", "Pending"),
    )
    if booking.status not in BOOKING_STATUSES:
        return fail("Invalid booking status")
    db.session.add(booking)
    db.session.commit()
    return ok({"booking": booking.to_dict()}, 201)


@api_bp.route("/bookings/<int:booking_id>", methods=["PUT", "DELETE"])
@login_required
def booking_detail(booking_id):
    booking = Booking.query.get_or_404(booking_id)

    if request.method == "DELETE":

        active_assignment = Assignment.query.filter_by(
            booking_id=booking.id,
            is_active=True
        ).first()

        if active_assignment:
            return fail(
                "Booking has an active assignment and cannot be deleted.",
                400,
            )

        db.session.delete(booking)
        db.session.commit()

        return ok({"message": "Booking deleted"})

    payload = request.get_json() or {}

    status = payload.get("status", booking.status)

    if status not in BOOKING_STATUSES:
        return fail("Invalid booking status")

    booking.customer_id = int(
        payload.get("customer_id", booking.customer_id)
    )
    booking.pickup_location = payload.get(
        "pickup_location",
        booking.pickup_location
    )
    booking.drop_location = payload.get(
        "drop_location",
        booking.drop_location
    )
    booking.trip_date = parse_date(
        payload.get(
            "trip_date",
            booking.trip_date.isoformat()
        )
    )
    booking.trip_time = parse_time(
        payload.get(
            "trip_time",
            booking.trip_time.strftime("%H:%M")
        )
    )
    booking.vehicle_type = payload.get(
        "vehicle_type",
        booking.vehicle_type
    )
    booking.status = status

    db.session.commit()

    return ok({"booking": booking.to_dict()})


@api_bp.get("/assignments")
@login_required
def list_assignments():
    return ok({"assignments": [item.to_dict() for item in Assignment.query.order_by(Assignment.created_at.desc()).all()]})


@api_bp.post("/assignments")
@login_required
def create_assignment():
    payload = request.get_json() or {}
    error = require_fields(payload, ["booking_id", "driver_id", "vehicle_id"])
    if error:
        return fail(error)
    booking = Booking.query.get_or_404(int(payload["booking_id"]))
    driver = Driver.query.get_or_404(int(payload["driver_id"]))
    vehicle = Vehicle.query.get_or_404(int(payload["vehicle_id"]))
    if Assignment.query.filter_by(booking_id=booking.id, is_active=True).first():
        return fail("This booking already has an active assignment")
    if driver.availability_status == "Unavailable":
        return fail("Selected driver is unavailable")
    if vehicle.status == "Maintenance":
        return fail("Selected vehicle is under maintenance")
    if has_schedule_conflict(booking, driver_id=driver.id):
        return fail("Driver schedule conflict detected")
    if has_schedule_conflict(booking, vehicle_id=vehicle.id):
        return fail("Vehicle schedule conflict detected")

    assignment = Assignment(
        booking=booking,
        driver=driver,
        vehicle=vehicle,
        assigned_by=current_user_id(),
        notes=payload.get("notes"),
    )
    booking.status = "Driver Assigned"
    driver.availability_status = "Assigned"
    vehicle.status = "Assigned"
    db.session.add(assignment)
    db.session.add(TripHistory(booking=booking, status="Driver Assigned", remarks="Driver and vehicle assigned", changed_by=current_user_id()))
    db.session.commit()
    return ok({"assignment": assignment.to_dict()}, 201)


@api_bp.put("/assignments/<int:assignment_id>")
@login_required
def reassign(assignment_id):
    assignment = Assignment.query.get_or_404(assignment_id)
    payload = request.get_json() or {}
    driver = Driver.query.get_or_404(int(payload.get("driver_id", assignment.driver_id)))
    vehicle = Vehicle.query.get_or_404(int(payload.get("vehicle_id", assignment.vehicle_id)))
    if driver.availability_status == "Unavailable":
        return fail("Selected driver is unavailable")
    if vehicle.status == "Maintenance":
        return fail("Selected vehicle is under maintenance")
    if has_schedule_conflict(assignment.booking, driver_id=driver.id, exclude_assignment_id=assignment.id):
        return fail("Driver schedule conflict detected")
    if has_schedule_conflict(assignment.booking, vehicle_id=vehicle.id, exclude_assignment_id=assignment.id):
        return fail("Vehicle schedule conflict detected")

    old_driver = assignment.driver
    old_vehicle = assignment.vehicle
    assignment.is_active = False
    if old_driver.id != driver.id:
        old_driver.availability_status = "Available"
    if old_vehicle.id != vehicle.id:
        old_vehicle.status = "Available"
    new_assignment = Assignment(
        booking=assignment.booking,
        driver=driver,
        vehicle=vehicle,
        assigned_by=current_user_id(),
        notes=payload.get("notes", "Reassignment"),
    )
    driver.availability_status = "Assigned"
    vehicle.status = "Assigned"
    db.session.add(new_assignment)
    db.session.add(TripHistory(booking=assignment.booking, status="Driver Assigned", remarks="Assignment updated", changed_by=current_user_id()))
    db.session.commit()
    return ok({"assignment": new_assignment.to_dict()})


@api_bp.get("/trips")
@login_required
def trips():
    bookings = Booking.query.order_by(Booking.trip_date.desc(), Booking.trip_time.desc()).all()
    return ok({"trips": [booking.to_dict() for booking in bookings]})


@api_bp.put("/trips/<int:booking_id>/status")
@login_required
def update_trip_status(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    payload = request.get_json() or {}
    status = payload.get("status")
    if status not in BOOKING_STATUSES:
        return fail("Invalid booking status")
    booking.status = status
    db.session.add(TripHistory(booking=booking, status=status, remarks=payload.get("remarks"), changed_by=current_user_id()))
    if status == "Completed":
        active_assignment = Assignment.query.filter_by(booking_id=booking.id, is_active=True).first()
        if active_assignment:
            active_assignment.driver.availability_status = "Available"
            active_assignment.vehicle.status = "Available"
    db.session.commit()
    return ok({"booking": booking.to_dict()})


@api_bp.get("/reports")
@login_required
def reports():
    period = request.args.get("period", "daily")
    today = date.today()
    days = {"daily": 1, "weekly": 7, "monthly": 30}.get(period, 1)
    start = today - timedelta(days=days - 1)

    assignments = Assignment.query.join(Booking).filter(Booking.trip_date >= start).order_by(Booking.trip_date.desc()).all()
    driver_utilization = (
        db.session.query(Driver.name, func.count(Assignment.id))
        .outerjoin(Assignment)
        .group_by(Driver.id)
        .order_by(func.count(Assignment.id).desc())
        .all()
    )
    vehicle_utilization = (
        db.session.query(Vehicle.name, func.count(Assignment.id))
        .outerjoin(Assignment)
        .group_by(Vehicle.id)
        .order_by(func.count(Assignment.id).desc())
        .all()
    )

    return ok(
        {
            "period": period,
            "assignments": [item.to_dict() for item in assignments],
            "driver_utilization": [{"label": item[0], "value": item[1]} for item in driver_utilization],
            "vehicle_utilization": [{"label": item[0], "value": item[1]} for item in vehicle_utilization],
        }
    )
@api_bp.get("/reports/export/excel")
@login_required
def export_excel():
    wb = Workbook()
    ws = wb.active
    ws.title = "Assignments Report"

    ws.append([
        "Booking ID",
        "Customer",
        "Driver",
        "Vehicle",
        "Trip Date",
        "Status"
    ])

    assignments = Assignment.query.all()

    for assignment in assignments:
        booking = assignment.booking

        ws.append([
            booking.booking_code,
            booking.customer.name if booking.customer else "",
            assignment.driver.name if assignment.driver else "",
            assignment.vehicle.name if assignment.vehicle else "",
            booking.trip_date.strftime("%Y-%m-%d"),
            booking.status
        ])

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    return send_file(
    output,
    as_attachment=True,
    download_name="Driver_Assignment_Report.xlsx",
    mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)


@api_bp.get("/reports/export/pdf")
@login_required
def export_pdf():

    buffer = BytesIO()

    pdf = SimpleDocTemplate(buffer)

    data = [[
        "Booking ID",
        "Customer",
        "Driver",
        "Vehicle",
        "Trip Date",
        "Status"
    ]]

    assignments = Assignment.query.all()

    for assignment in assignments:

        booking = assignment.booking

        data.append([
            booking.booking_code,
            booking.customer.name if booking.customer else "",
            assignment.driver.name if assignment.driver else "",
            assignment.vehicle.name if assignment.vehicle else "",
            booking.trip_date.strftime("%Y-%m-%d"),
            booking.status
        ])

    table = Table(data)

    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.darkblue),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
        ("GRID", (0, 0), (-1, -1), 1, colors.black)
    ]))

    pdf.build([table])

    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name="Driver_Assignment_Report.pdf",
        mimetype="application/pdf"
    )

@api_bp.delete("/assignments/<int:assignment_id>")
@login_required
def delete_assignment(assignment_id):

    assignment = Assignment.query.get_or_404(
        assignment_id
    )

    booking = assignment.booking

    if booking.status != "Completed":
        return fail(
            "Only completed assignments can be deleted",
            400
        )

    db.session.delete(assignment)
    db.session.commit()

    return ok({
        "message": "Assignment deleted"
    })