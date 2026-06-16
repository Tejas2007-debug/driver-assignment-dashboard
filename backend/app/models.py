from datetime import datetime

from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db


class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(db.Model, TimestampMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(40), default="admin", nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email, "role": self.role}


class Customer(db.Model, TimestampMixin):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(140), nullable=False, index=True)
    phone = db.Column(db.String(30), nullable=False)
    email = db.Column(db.String(160))
    address = db.Column(db.Text)
    bookings = db.relationship("Booking", back_populates="customer", cascade="all, delete-orphan")

    def to_dict(self, include_bookings=False):
        data = {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "address": self.address,
        }
        if include_bookings:
            data["bookings"] = [booking.to_dict() for booking in self.bookings]
        return data


class Driver(db.Model, TimestampMixin):
    __tablename__ = "drivers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(140), nullable=False, index=True)
    phone = db.Column(db.String(30), nullable=False)
    license_number = db.Column(db.String(80), unique=True, nullable=False)
    experience = db.Column(db.Integer, nullable=False, default=0)
    availability_status = db.Column(db.Enum("Available", "Assigned", "Unavailable", name="driver_availability_enum"), default="Available", nullable=False)
    assignments = db.relationship("Assignment", back_populates="driver")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "license_number": self.license_number,
            "experience": self.experience,
            "availability_status": self.availability_status,
        }


class Vehicle(db.Model, TimestampMixin):
    __tablename__ = "vehicles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(140), nullable=False)
    vehicle_number = db.Column(db.String(80), unique=True, nullable=False, index=True)
    vehicle_type = db.Column(db.String(80), nullable=False)
    capacity = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Enum("Available", "Assigned", "Maintenance", name="vehicle_status_enum"), default="Available", nullable=False)
    assignments = db.relationship("Assignment", back_populates="vehicle")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "vehicle_number": self.vehicle_number,
            "vehicle_type": self.vehicle_type,
            "capacity": self.capacity,
            "status": self.status,
        }


class Booking(db.Model, TimestampMixin):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True)
    booking_code = db.Column(db.String(30), unique=True, nullable=False, index=True)
    invoice_number = db.Column(db.String(30), unique=True, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    pickup_location = db.Column(db.String(220), nullable=False)
    drop_location = db.Column(db.String(220), nullable=False)
    trip_date = db.Column(db.Date, nullable=False, index=True)
    trip_time = db.Column(db.Time, nullable=False)
    vehicle_type = db.Column(db.String(80), nullable=False)
    status = db.Column(
        db.Enum("Pending", "Confirmed", "Driver Assigned", "Trip Started", "Completed", name="booking_status_enum"),
        default="Pending",
        nullable=False,
        index=True,
    )
    payment_status = db.Column(db.Enum("Pending", "Partial", "Paid", name="payment_status_enum"), default="Pending", nullable=False)
    follow_up_date = db.Column(db.Date)
    follow_up_note = db.Column(db.Text)
    follow_up_status = db.Column(db.Enum("Pending", "Completed", "Missed", name="follow_up_status_enum"), default="Pending", nullable=False)
    customer = db.relationship("Customer", back_populates="bookings")
    assignments = db.relationship("Assignment", back_populates="booking", cascade="all, delete-orphan")
    trip_history = db.relationship("TripHistory", back_populates="booking", cascade="all, delete-orphan")

    def to_dict(self):
        active_assignment = next((item for item in self.assignments if item.is_active), None)
        return {
            "id": self.id,
            "booking_code": self.booking_code,
            "invoice_number": self.invoice_number,
            "customer_id": self.customer_id,
            "customer_name": self.customer.name if self.customer else None,
            "pickup_location": self.pickup_location,
            "drop_location": self.drop_location,
            "trip_date": self.trip_date.isoformat(),
            "trip_time": self.trip_time.strftime("%H:%M"),
            "vehicle_type": self.vehicle_type,
            "status": self.status,
            "payment_status": self.payment_status,
            "follow_up_date": self.follow_up_date.isoformat() if self.follow_up_date else None,
            "follow_up_note": self.follow_up_note,
            "follow_up_status": self.follow_up_status,
            "assignment": active_assignment.to_dict(compact=True) if active_assignment else None,
        }


class Assignment(db.Model, TimestampMixin):
    __tablename__ = "assignments"

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    driver_id = db.Column(db.Integer, db.ForeignKey("drivers.id", ondelete="RESTRICT"), nullable=False)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id", ondelete="RESTRICT"), nullable=False)
    assigned_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    notes = db.Column(db.Text)
    route_notes = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    booking = db.relationship("Booking", back_populates="assignments")
    driver = db.relationship("Driver", back_populates="assignments")
    vehicle = db.relationship("Vehicle", back_populates="assignments")
    admin = db.relationship("User")

    def to_dict(self, compact=False):
        data = {
            "id": self.id,
            "booking_id": self.booking_id,
            "booking_code": self.booking.booking_code if self.booking else None,
            "driver_id": self.driver_id,
            "driver_name": self.driver.name if self.driver else None,
            "vehicle_id": self.vehicle_id,
            "vehicle_name": self.vehicle.name if self.vehicle else None,
            "vehicle_number": self.vehicle.vehicle_number if self.vehicle else None,
            "notes": self.notes,
            "route_notes": self.route_notes,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }
        if not compact and self.booking:
            data.update(
                {
                    "customer_name": self.booking.customer.name,
                    "invoice_number": self.booking.invoice_number,
                    "pickup_location": self.booking.pickup_location,
                    "drop_location": self.booking.drop_location,
                    "trip_date": self.booking.trip_date.isoformat(),
                    "trip_time": self.booking.trip_time.strftime("%H:%M"),
                    "payment_status": self.booking.payment_status,
                    "status": self.booking.status,
                }
            )
        return data


class TripHistory(db.Model, TimestampMixin):
    __tablename__ = "trip_history"

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    status = db.Column(db.String(60), nullable=False)
    remarks = db.Column(db.Text)
    changed_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    booking = db.relationship("Booking", back_populates="trip_history")
    admin = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "booking_code": self.booking.booking_code if self.booking else None,
            "status": self.status,
            "remarks": self.remarks,
            "created_at": self.created_at.isoformat(),
        }


class ActivityLog(db.Model, TimestampMixin):
    __tablename__ = "activity_logs"

    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(80), nullable=False, index=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id", ondelete="SET NULL"))
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id", ondelete="SET NULL"))
    detail = db.Column(db.Text)
    changed_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    booking = db.relationship("Booking")
    assignment = db.relationship("Assignment")
    admin = db.relationship("User")

    def to_dict(self):
        booking = self.booking or (self.assignment.booking if self.assignment and self.assignment.booking else None)
        assignment = self.assignment
        return {
            "id": self.id,
            "action": self.action,
            "booking_id": booking.id if booking else None,
            "booking_code": booking.booking_code if booking else None,
            "invoice_number": booking.invoice_number if booking else None,
            "driver_name": assignment.driver.name if assignment and assignment.driver else None,
            "vehicle_name": assignment.vehicle.name if assignment and assignment.vehicle else None,
            "detail": self.detail,
            "created_at": self.created_at.isoformat(),
        }
