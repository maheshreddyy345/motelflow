-- Motel Flow Database Schema
-- PostgreSQL

-- Drop tables if exist (for fresh start)
DROP TABLE IF EXISTS reservation_history CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS guests CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS rates CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (for authentication)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'frontdesk', 'housekeeping')),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rooms table
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(10) UNIQUE NOT NULL,
    floor INTEGER NOT NULL CHECK (floor BETWEEN 1 AND 3),
    room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('SK', 'DQ', 'DQS', 'ACC')),
    status VARCHAR(20) DEFAULT 'vacant_clean' CHECK (status IN ('vacant_clean', 'vacant_dirty', 'occupied', 'inspected', 'out_of_order')),
    is_out_of_order BOOLEAN DEFAULT FALSE,
    out_of_order_reason TEXT,
    out_of_order_since TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Room type descriptions for reference
COMMENT ON TABLE rooms IS 'SK=Single King, DQ=Double Queen, DQS=Double Queen Suite, ACC=Accessible';

-- Guests table
CREATE TABLE guests (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    id_number VARCHAR(50),
    id_type VARCHAR(30),
    vehicle_make VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_color VARCHAR(30),
    vehicle_plate VARCHAR(20),
    vehicle_state VARCHAR(5),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rates table (configurable pricing)
CREATE TABLE rates (
    id SERIAL PRIMARY KEY,
    room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('SK', 'DQ', 'DQS', 'ACC')),
    rate_category VARCHAR(20) NOT NULL CHECK (rate_category IN ('regular', 'aaa', 'military', 'government', 'senior')),
    weekday_rate DECIMAL(10, 2) NOT NULL,
    weekend_rate DECIMAL(10, 2) NOT NULL,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_type, rate_category, effective_from)
);

-- Reservations table
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    confirmation_number VARCHAR(20) UNIQUE NOT NULL,
    room_id INTEGER REFERENCES rooms(id),
    guest_id INTEGER REFERENCES guests(id) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    actual_check_in TIMESTAMP,
    actual_check_out TIMESTAMP,
    rate_category VARCHAR(20) NOT NULL DEFAULT 'regular',
    nightly_rate DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2),
    early_checkin_fee DECIMAL(10, 2) DEFAULT 0,
    late_checkout_fee DECIMAL(10, 2) DEFAULT 0,
    num_guests INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
    payment_method VARCHAR(20),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reservation history for audit trail
CREATE TABLE reservation_history (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER REFERENCES reservations(id),
    action VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table for configurable values
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value, description) VALUES
    ('check_in_time', '15:00', 'Default check-in time (3 PM)'),
    ('check_out_time', '11:00', 'Default check-out time (11 AM)'),
    ('early_checkin_fee_before_noon', '40.00', 'Early check-in fee if before 12 PM'),
    ('early_checkin_fee_after_noon', '25.00', 'Early check-in fee if after 12 PM'),
    ('late_checkout_fee', '25.00', 'Late check-out fee'),
    ('motel_name', 'Motel Flow', 'Motel display name'),
    ('motel_address', '', 'Motel address'),
    ('motel_phone', '', 'Motel phone number');

-- Insert default admin user (password: motelflow123)
-- Note: This hash should be generated by bcrypt in the application
INSERT INTO users (username, password_hash, role, full_name, email)
VALUES ('owner', '$2b$10$placeholder_will_be_set_by_app', 'owner', 'System Owner', 'owner@motelflow.com');

-- Insert default rates
INSERT INTO rates (room_type, rate_category, weekday_rate, weekend_rate) VALUES
    -- Single King rates
    ('SK', 'regular', 79.00, 99.00),
    ('SK', 'aaa', 71.10, 89.10),
    ('SK', 'military', 67.15, 84.15),
    ('SK', 'government', 75.00, 95.00),
    ('SK', 'senior', 71.10, 89.10),
    -- Double Queen rates
    ('DQ', 'regular', 89.00, 109.00),
    ('DQ', 'aaa', 80.10, 98.10),
    ('DQ', 'military', 75.65, 92.65),
    ('DQ', 'government', 85.00, 105.00),
    ('DQ', 'senior', 80.10, 98.10),
    -- Double Queen Suite rates
    ('DQS', 'regular', 109.00, 139.00),
    ('DQS', 'aaa', 98.10, 125.10),
    ('DQS', 'military', 92.65, 118.15),
    ('DQS', 'government', 105.00, 135.00),
    ('DQS', 'senior', 98.10, 125.10),
    -- Accessible rates (same as Single King)
    ('ACC', 'regular', 79.00, 99.00),
    ('ACC', 'aaa', 71.10, 89.10),
    ('ACC', 'military', 67.15, 84.15),
    ('ACC', 'government', 75.00, 95.00),
    ('ACC', 'senior', 71.10, 89.10);

-- Create rooms (100 total)
-- Floor 1: Rooms 101-130 (30 rooms)
INSERT INTO rooms (room_number, floor, room_type) VALUES
    ('101', 1, 'ACC'), ('102', 1, 'ACC'), ('103', 1, 'SK'), ('104', 1, 'SK'),
    ('105', 1, 'SK'), ('106', 1, 'SK'), ('107', 1, 'DQ'), ('108', 1, 'DQ'),
    ('109', 1, 'DQ'), ('110', 1, 'DQ'), ('111', 1, 'DQ'), ('112', 1, 'DQ'),
    ('113', 1, 'DQ'), ('114', 1, 'DQ'), ('115', 1, 'DQ'), ('116', 1, 'DQ'),
    ('117', 1, 'DQ'), ('118', 1, 'DQ'), ('119', 1, 'DQ'), ('120', 1, 'DQ'),
    ('121', 1, 'DQS'), ('122', 1, 'DQS'), ('123', 1, 'SK'), ('124', 1, 'SK'),
    ('125', 1, 'SK'), ('126', 1, 'SK'), ('127', 1, 'DQ'), ('128', 1, 'DQ'),
    ('129', 1, 'DQ'), ('130', 1, 'DQ');

-- Floor 2: Rooms 201-235 (35 rooms)
INSERT INTO rooms (room_number, floor, room_type) VALUES
    ('201', 2, 'SK'), ('202', 2, 'SK'), ('203', 2, 'SK'), ('204', 2, 'SK'),
    ('205', 2, 'SK'), ('206', 2, 'DQ'), ('207', 2, 'DQ'), ('208', 2, 'DQ'),
    ('209', 2, 'DQ'), ('210', 2, 'DQ'), ('211', 2, 'DQ'), ('212', 2, 'DQ'),
    ('213', 2, 'DQ'), ('214', 2, 'DQ'), ('215', 2, 'DQ'), ('216', 2, 'DQ'),
    ('217', 2, 'DQ'), ('218', 2, 'DQ'), ('219', 2, 'DQ'), ('220', 2, 'DQ'),
    ('221', 2, 'DQ'), ('222', 2, 'DQ'), ('223', 2, 'DQ'), ('224', 2, 'DQ'),
    ('225', 2, 'DQS'), ('226', 2, 'DQS'), ('227', 2, 'DQS'), ('228', 2, 'SK'),
    ('229', 2, 'SK'), ('230', 2, 'DQ'), ('231', 2, 'DQ'), ('232', 2, 'DQ'),
    ('233', 2, 'DQ'), ('234', 2, 'DQ'), ('235', 2, 'DQ');

-- Floor 3: Rooms 301-335 (35 rooms)
INSERT INTO rooms (room_number, floor, room_type) VALUES
    ('301', 3, 'SK'), ('302', 3, 'SK'), ('303', 3, 'SK'), ('304', 3, 'SK'),
    ('305', 3, 'SK'), ('306', 3, 'DQ'), ('307', 3, 'DQ'), ('308', 3, 'DQ'),
    ('309', 3, 'DQ'), ('310', 3, 'DQ'), ('311', 3, 'DQ'), ('312', 3, 'DQ'),
    ('313', 3, 'DQ'), ('314', 3, 'DQ'), ('315', 3, 'DQ'), ('316', 3, 'DQ'),
    ('317', 3, 'DQ'), ('318', 3, 'DQ'), ('319', 3, 'DQ'), ('320', 3, 'DQ'),
    ('321', 3, 'DQ'), ('322', 3, 'DQ'), ('323', 3, 'DQ'), ('324', 3, 'DQ'),
    ('325', 3, 'DQS'), ('326', 3, 'DQS'), ('327', 3, 'DQS'), ('328', 3, 'SK'),
    ('329', 3, 'SK'), ('330', 3, 'DQ'), ('331', 3, 'DQ'), ('332', 3, 'DQ'),
    ('333', 3, 'DQ'), ('334', 3, 'DQ'), ('335', 3, 'DQ');

-- Create indexes for performance
CREATE INDEX idx_rooms_floor ON rooms(floor);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_guests_name ON guests(last_name, first_name);
