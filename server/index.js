const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const roomsRoutes = require('./routes/rooms');
const reservationsRoutes = require('./routes/reservations');
const housekeepingRoutes = require('./routes/housekeeping');
const ratesRoutes = require('./routes/rates');
const settingsRoutes = require('./routes/settings');
const folioRoutes = require('./routes/folio');
const reportsRoutes = require('./routes/reports');
const paymentsRoutes = require('./routes/payments');
const nightAuditRoutes = require('./routes/night-audit');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/rates', ratesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/folio', folioRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/night-audit', nightAuditRoutes);

// ── Production: Serve React frontend ──
const path = require('path');
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/dist')));

    // Catch-all: send all non-API requests to React
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(__dirname, '../client/dist/index.html'));
        }
    });
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dashboard summary endpoint
app.get('/api/dashboard', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const today = new Date().toISOString().split('T')[0];

        // Get room summary
        const roomSummary = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'vacant_clean' OR status = 'inspected') as available,
                COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                COUNT(*) FILTER (WHERE status = 'vacant_dirty') as dirty,
                COUNT(*) FILTER (WHERE status = 'out_of_order') as out_of_order
            FROM rooms
        `);

        // Get today's arrivals count
        const arrivals = await db.query(`
            SELECT COUNT(*) as count FROM reservations 
            WHERE check_in_date::date = $1::date AND status IN ('confirmed', 'checked_in')
        `, [today]);

        // Get today's departures count
        const departures = await db.query(`
            SELECT COUNT(*) as count FROM reservations 
            WHERE check_out_date::date = $1::date AND status = 'checked_in'
        `, [today]);

        // Get current in-house guests
        const inHouse = await db.query(`
            SELECT COUNT(*) as count FROM reservations 
            WHERE status = 'checked_in'
        `);

        const rooms = roomSummary.rows[0];
        const occupancyRate = rooms.total > 0
            ? ((rooms.occupied / (rooms.total - rooms.out_of_order)) * 100).toFixed(1)
            : 0;

        res.json({
            rooms: rooms,
            occupancyRate: parseFloat(occupancyRate),
            todayArrivals: parseInt(arrivals.rows[0].count),
            todayDepartures: parseInt(departures.rows[0].count),
            inHouseGuests: parseInt(inHouse.rows[0].count),
            date: today
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize database and start server
const initDatabase = async () => {
    try {
        // Check if owner user exists
        const userCheck = await db.query(
            "SELECT id, password_hash FROM users WHERE username = 'owner'"
        );

        if (userCheck.rows.length === 0) {
            // Hash the default password and create user
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash('motelflow123', salt);

            await db.query(`
                INSERT INTO users (username, password_hash, role, full_name, email)
                VALUES ('owner', $1, 'owner', 'System Owner', 'owner@motelflow.com')
            `, [passwordHash]);

            console.log('✅ Default owner account created (username: owner, password: motelflow123)');
        } else if (userCheck.rows[0].password_hash.includes('placeholder')) {
            // Fix placeholder password - update with proper hash
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash('motelflow123', salt);

            await db.query(
                "UPDATE users SET password_hash = $1 WHERE username = 'owner'",
                [passwordHash]
            );

            console.log('✅ Owner password updated (username: owner, password: motelflow123)');
        }

        console.log('✅ Database initialized');
    } catch (error) {
        console.error('Database initialization error:', error.message);
        console.log('⚠️  Make sure to run the schema.sql file to create the database tables');
    }
};

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🏨 MOTEL FLOW - Property Management System     ║
║                                                  ║
║   Server running on http://localhost:${PORT}       ║
║                                                  ║
╚══════════════════════════════════════════════════╝
    `);

    await initDatabase();
});

module.exports = app;
