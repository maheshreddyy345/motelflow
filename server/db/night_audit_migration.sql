-- Night Audit table
CREATE TABLE IF NOT EXISTS night_audits (
    id              SERIAL PRIMARY KEY,
    audit_date      DATE UNIQUE NOT NULL,
    run_by          INTEGER REFERENCES users(id),
    run_at          TIMESTAMP DEFAULT NOW(),
    total_rooms     INTEGER,
    occupied_rooms  INTEGER,
    occupancy_pct   DECIMAL(5,2),
    adr             DECIMAL(10,2),
    revenue_posted  DECIMAL(10,2),
    total_revenue   DECIMAL(10,2),
    total_payments  DECIMAL(10,2),
    no_shows        INTEGER DEFAULT 0,
    checked_in      INTEGER DEFAULT 0,
    checked_out     INTEGER DEFAULT 0,
    notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_night_audits_date ON night_audits(audit_date DESC);
