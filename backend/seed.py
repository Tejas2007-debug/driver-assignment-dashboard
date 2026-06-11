from app import create_app
from app.extensions import db
from app.models import Assignment, Booking, Customer, Driver, TripHistory, User, Vehicle
from app.utils import parse_date, parse_time


def seed():
    app = create_app()
    with app.app_context():
        db.create_all()
        if User.query.filter_by(email="admin@manivthatours.com").first():
            print("Sample data already exists.")
            return

        admin = User(name="Admin User", email="admin@manivthatours.com", role="admin")
        admin.set_password("Admin@123")
        db.session.add(admin)

        customers = [
            Customer(name="Aarav Sharma", phone="9876543210", email="aarav@example.com", address="Anna Nagar, Chennai"),
            Customer(name="Priya Menon", phone="9876501234", email="priya@example.com", address="Indiranagar, Bengaluru"),
            Customer(name="Rohan Iyer", phone="9845012345", email="rohan@example.com", address="Hitech City, Hyderabad"),
        ]
        drivers = [
            Driver(name="Suresh Kumar", phone="9000011111", license_number="DL-TN-48291", experience=8, availability_status="Assigned"),
            Driver(name="Manoj Reddy", phone="9000022222", license_number="DL-KA-77421", experience=5),
            Driver(name="Vikram Das", phone="9000033333", license_number="DL-TS-59210", experience=6),
        ]
        vehicles = [
            Vehicle(name="Toyota Innova Crysta", vehicle_number="TN 10 AB 1234", vehicle_type="SUV", capacity=6, status="Assigned"),
            Vehicle(name="Maruti Ertiga", vehicle_number="KA 05 CD 7788", vehicle_type="MUV", capacity=6),
            Vehicle(name="Tempo Traveller", vehicle_number="TS 09 EF 4211", vehicle_type="Traveller", capacity=12),
        ]
        db.session.add_all(customers + drivers + vehicles)
        db.session.flush()

        bookings = [
            Booking(
                booking_code="MTT-20260611-0001",
                customer=customers[0],
                pickup_location="Chennai Central",
                drop_location="Mahabalipuram",
                trip_date=parse_date("2026-06-11"),
                trip_time=parse_time("09:30"),
                vehicle_type="SUV",
                status="Driver Assigned",
            ),
            Booking(
                booking_code="MTT-20260612-0002",
                customer=customers[1],
                pickup_location="Bengaluru Airport",
                drop_location="Mysuru",
                trip_date=parse_date("2026-06-12"),
                trip_time=parse_time("07:00"),
                vehicle_type="MUV",
                status="Confirmed",
            ),
            Booking(
                booking_code="MTT-20260613-0003",
                customer=customers[2],
                pickup_location="Hyderabad Station",
                drop_location="Ramoji Film City",
                trip_date=parse_date("2026-06-13"),
                trip_time=parse_time("10:15"),
                vehicle_type="Traveller",
                status="Pending",
            ),
        ]
        db.session.add_all(bookings)
        db.session.flush()

        assignment = Assignment(booking=bookings[0], driver=drivers[0], vehicle=vehicles[0], admin=admin, notes="Primary assignment")
        db.session.add(assignment)
        db.session.add(TripHistory(booking=bookings[0], status="Driver Assigned", remarks="Initial assignment completed", admin=admin))
        db.session.commit()
        print("Sample data created. Login: admin@manivthatours.com / Admin@123")


if __name__ == "__main__":
    seed()
