USE driver_assignment_dashboard;

INSERT INTO users (name, email, password_hash, role) VALUES
('Admin User', 'admin@manivthatours.com', 'pbkdf2:sha256:1000000$manivtha-seed$9463d7bfd554c5a0cfa3c182bbf422972e5ec1fa174c4b42f5f8505ca3abb198', 'admin');

INSERT INTO customers (name, phone, email, address) VALUES
('Aarav Sharma', '9876543210', 'aarav@example.com', 'Anna Nagar, Chennai'),
('Priya Menon', '9876501234', 'priya@example.com', 'Indiranagar, Bengaluru'),
('Rohan Iyer', '9845012345', 'rohan@example.com', 'Hitech City, Hyderabad');

INSERT INTO drivers (name, phone, license_number, experience, availability_status) VALUES
('Suresh Kumar', '9000011111', 'DL-TN-48291', 8, 'Assigned'),
('Manoj Reddy', '9000022222', 'DL-KA-77421', 5, 'Available'),
('Vikram Das', '9000033333', 'DL-TS-59210', 6, 'Available');

INSERT INTO vehicles (name, vehicle_number, vehicle_type, capacity, status) VALUES
('Toyota Innova Crysta', 'TN 10 AB 1234', 'SUV', 6, 'Assigned'),
('Maruti Ertiga', 'KA 05 CD 7788', 'MUV', 6, 'Available'),
('Tempo Traveller', 'TS 09 EF 4211', 'Traveller', 12, 'Available');

INSERT INTO bookings (booking_code, customer_id, pickup_location, drop_location, trip_date, trip_time, vehicle_type, status) VALUES
('MTT-20260611-0001', 1, 'Chennai Central', 'Mahabalipuram', '2026-06-11', '09:30:00', 'SUV', 'Driver Assigned'),
('MTT-20260612-0002', 2, 'Bengaluru Airport', 'Mysuru', '2026-06-12', '07:00:00', 'MUV', 'Confirmed'),
('MTT-20260613-0003', 3, 'Hyderabad Station', 'Ramoji Film City', '2026-06-13', '10:15:00', 'Traveller', 'Pending');

INSERT INTO assignments (booking_id, driver_id, vehicle_id, assigned_by, notes, is_active) VALUES
(1, 1, 1, 1, 'Primary assignment for confirmed day trip', TRUE);

INSERT INTO trip_history (booking_id, status, remarks, changed_by) VALUES
(1, 'Driver Assigned', 'Initial driver and vehicle assignment completed', 1);
