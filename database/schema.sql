CREATE DATABASE IF NOT EXISTS driver_assignment_dashboard;
USE driver_assignment_dashboard;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(160),
  address TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_name (name)
);

CREATE TABLE drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  license_number VARCHAR(80) NOT NULL UNIQUE,
  experience INT NOT NULL DEFAULT 0,
  availability_status ENUM('Available','Assigned','Unavailable') NOT NULL DEFAULT 'Available',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_driver_status (availability_status)
);

CREATE TABLE vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  vehicle_number VARCHAR(80) NOT NULL UNIQUE,
  vehicle_type VARCHAR(80) NOT NULL,
  capacity INT NOT NULL,
  status ENUM('Available','Assigned','Maintenance') NOT NULL DEFAULT 'Available',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vehicle_status (status)
);

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_code VARCHAR(30) NOT NULL UNIQUE,
  invoice_number VARCHAR(30) UNIQUE,
  customer_id INT NOT NULL,
  pickup_location VARCHAR(220) NOT NULL,
  drop_location VARCHAR(220) NOT NULL,
  trip_date DATE NOT NULL,
  trip_time TIME NOT NULL,
  vehicle_type VARCHAR(80) NOT NULL,
  status ENUM('Pending','Confirmed','Driver Assigned','Trip Started','Completed') NOT NULL DEFAULT 'Pending',
  payment_status ENUM('Pending','Partial','Paid') NOT NULL DEFAULT 'Pending',
  follow_up_date DATE,
  follow_up_note TEXT,
  follow_up_status ENUM('Pending','Completed','Missed') NOT NULL DEFAULT 'Pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_booking_date (trip_date),
  INDEX idx_booking_status (status)
);

CREATE TABLE assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  driver_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  assigned_by INT NULL,
  notes TEXT,
  route_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assignments_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assignments_user FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_assignment_active (is_active),
  INDEX idx_assignment_driver (driver_id),
  INDEX idx_assignment_vehicle (vehicle_id)
);

CREATE TABLE trip_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  status VARCHAR(60) NOT NULL,
  remarks TEXT,
  changed_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trip_history_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_trip_history_booking (booking_id)
);

CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(80) NOT NULL,
  booking_id INT NULL,
  assignment_id INT NULL,
  detail TEXT,
  changed_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  CONSTRAINT fk_activity_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL,
  CONSTRAINT fk_activity_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_activity_action (action)
);
