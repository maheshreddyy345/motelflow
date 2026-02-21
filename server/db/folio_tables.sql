-- Folio Charges table
CREATE TABLE IF NOT EXISTS folio_charges (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    category VARCHAR(20) NOT NULL CHECK (category IN ('room', 'deposit', 'extra', 'purchase', 'damage', 'fee')),
    description VARCHAR(200) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    quantity INTEGER DEFAULT 1,
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by INTEGER REFERENCES users(id),
    voided BOOLEAN DEFAULT FALSE,
    voided_at TIMESTAMP,
    voided_by INTEGER REFERENCES users(id)
);

-- Folio Payments table
CREATE TABLE IF NOT EXISTS folio_payments (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'card', 'check', 'refund')),
    reference VARCHAR(50),
    date_received TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    received_by INTEGER REFERENCES users(id),
    voided BOOLEAN DEFAULT FALSE,
    voided_at TIMESTAMP,
    voided_by INTEGER REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_folio_charges_reservation ON folio_charges(reservation_id);
CREATE INDEX IF NOT EXISTS idx_folio_payments_reservation ON folio_payments(reservation_id);
