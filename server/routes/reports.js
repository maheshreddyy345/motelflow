const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// All reports are restricted to owner and manager
const reportAuth = [auth, authorize('owner', 'manager')];

// GET /api/reports/summary — KPI snapshot for date range
router.get('/summary', ...reportAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        // Total revenue (non-voided payments received in date range)
        const revenueResult = await db.query(`
            SELECT COALESCE(SUM(amount), 0) as total_revenue
            FROM folio_payments
            WHERE voided = FALSE
              AND date_received::date BETWEEN $1::date AND $2::date
        `, [startDate, endDate]);

        // Total rooms available (excluding out-of-order)
        const roomsResult = await db.query(`
            SELECT COUNT(*) as total_rooms,
                   COUNT(*) FILTER (WHERE status != 'out_of_order') as available_rooms
            FROM rooms
        `);

        // Reservations in date range
        const bookingsResult = await db.query(`
            SELECT 
                COUNT(*) as total_bookings,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                COUNT(*) FILTER (WHERE status IN ('checked_in', 'checked_out')) as completed
            FROM reservations
            WHERE check_in_date::date BETWEEN $1::date AND $2::date
        `, [startDate, endDate]);

        // Average occupancy over the date range
        // Count room-nights occupied vs available room-nights
        const occupancyResult = await db.query(`
            WITH date_series AS (
                SELECT generate_series($1::date, $2::date, '1 day'::interval)::date as d
            ),
            daily_occupied AS (
                SELECT ds.d, COUNT(DISTINCT r.room_id) as occupied
                FROM date_series ds
                LEFT JOIN reservations r ON r.check_in_date <= ds.d 
                    AND r.check_out_date > ds.d
                    AND r.status IN ('checked_in', 'checked_out', 'confirmed')
                GROUP BY ds.d
            )
            SELECT 
                COALESCE(AVG(occupied), 0) as avg_occupied,
                COALESCE(MAX(occupied), 0) as peak_occupied
            FROM daily_occupied
        `, [startDate, endDate]);

        // ADR (Average Daily Rate) — average nightly rate of booked rooms
        const adrResult = await db.query(`
            SELECT COALESCE(AVG(nightly_rate), 0) as adr
            FROM reservations
            WHERE check_in_date::date BETWEEN $1::date AND $2::date
              AND status NOT IN ('cancelled')
        `, [startDate, endDate]);

        const totalRooms = parseInt(roomsResult.rows[0].available_rooms);
        const avgOccupied = parseFloat(occupancyResult.rows[0].avg_occupied);
        const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue);
        const adr = parseFloat(adrResult.rows[0].adr);
        const totalBookings = parseInt(bookingsResult.rows[0].total_bookings);
        const cancelled = parseInt(bookingsResult.rows[0].cancelled);

        // Calculate number of days in range
        const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

        // RevPAR = Total Room Revenue / (Available Rooms × Days)
        const revpar = totalRooms > 0 && days > 0 ? totalRevenue / (totalRooms * days) : 0;
        const avgOccupancyPct = totalRooms > 0 ? (avgOccupied / totalRooms) * 100 : 0;
        const cancellationRate = totalBookings > 0 ? (cancelled / totalBookings) * 100 : 0;

        res.json({
            totalRevenue: totalRevenue,
            avgOccupancy: parseFloat(avgOccupancyPct.toFixed(1)),
            peakOccupied: parseInt(occupancyResult.rows[0].peak_occupied),
            adr: parseFloat(adr.toFixed(2)),
            revpar: parseFloat(revpar.toFixed(2)),
            totalBookings: totalBookings,
            completedBookings: parseInt(bookingsResult.rows[0].completed),
            cancellationRate: parseFloat(cancellationRate.toFixed(1)),
            totalRooms: totalRooms,
            days: days
        });
    } catch (error) {
        console.error('Reports summary error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/revenue — Daily revenue totals + charge category breakdown
router.get('/revenue', ...reportAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        // Daily revenue from payments
        const dailyRevenue = await db.query(`
            WITH date_series AS (
                SELECT generate_series($1::date, $2::date, '1 day'::interval)::date as d
            )
            SELECT ds.d as date, COALESCE(SUM(fp.amount), 0) as revenue
            FROM date_series ds
            LEFT JOIN folio_payments fp ON fp.date_received::date = ds.d AND fp.voided = FALSE
            GROUP BY ds.d
            ORDER BY ds.d
        `, [startDate, endDate]);

        // Charge breakdown by category
        const chargeBreakdown = await db.query(`
            SELECT fc.category, 
                   COALESCE(SUM(fc.amount * fc.quantity), 0) as total
            FROM folio_charges fc
            WHERE fc.voided = FALSE
              AND fc.date_added::date BETWEEN $1::date AND $2::date
            GROUP BY fc.category
            ORDER BY total DESC
        `, [startDate, endDate]);

        res.json({
            dailyRevenue: dailyRevenue.rows,
            chargeBreakdown: chargeBreakdown.rows
        });
    } catch (error) {
        console.error('Reports revenue error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/occupancy — Daily occupancy percentages
router.get('/occupancy', ...reportAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const totalRoomsResult = await db.query(`
            SELECT COUNT(*) as total FROM rooms WHERE status != 'out_of_order'
        `);
        const totalRooms = parseInt(totalRoomsResult.rows[0].total);

        // Daily occupancy
        const dailyOccupancy = await db.query(`
            WITH date_series AS (
                SELECT generate_series($1::date, $2::date, '1 day'::interval)::date as d
            )
            SELECT ds.d as date, COUNT(DISTINCT r.room_id) as occupied
            FROM date_series ds
            LEFT JOIN reservations r ON r.check_in_date <= ds.d 
                AND r.check_out_date > ds.d
                AND r.status IN ('checked_in', 'checked_out', 'confirmed')
            GROUP BY ds.d
            ORDER BY ds.d
        `, [startDate, endDate]);

        // Occupancy by floor
        const floorOccupancy = await db.query(`
            SELECT rm.floor, COUNT(DISTINCT r.room_id) as occupied,
                   COUNT(DISTINCT rm.id) as total_rooms
            FROM rooms rm
            LEFT JOIN reservations r ON r.room_id = rm.id
                AND r.check_in_date <= CURRENT_DATE
                AND r.check_out_date > CURRENT_DATE
                AND r.status IN ('checked_in', 'confirmed')
            WHERE rm.status != 'out_of_order'
            GROUP BY rm.floor
            ORDER BY rm.floor
        `);

        res.json({
            totalRooms,
            dailyOccupancy: dailyOccupancy.rows,
            floorOccupancy: floorOccupancy.rows
        });
    } catch (error) {
        console.error('Reports occupancy error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/rates — Revenue by room type and rate category
router.get('/rates', ...reportAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        // Revenue by room type
        const byRoomType = await db.query(`
            SELECT rm.room_type, 
                   COUNT(*) as bookings,
                   COALESCE(SUM(r.nightly_rate * 
                       GREATEST(1, DATE_PART('day', r.check_out_date::timestamp - r.check_in_date::timestamp))
                   ), 0) as revenue,
                   COALESCE(AVG(r.nightly_rate), 0) as avg_rate
            FROM reservations r
            JOIN rooms rm ON r.room_id = rm.id
            WHERE r.check_in_date::date BETWEEN $1::date AND $2::date
              AND r.status NOT IN ('cancelled')
            GROUP BY rm.room_type
            ORDER BY revenue DESC
        `, [startDate, endDate]);

        // Bookings by rate category
        const byRateCategory = await db.query(`
            SELECT rate_category, COUNT(*) as bookings,
                   COALESCE(AVG(nightly_rate), 0) as avg_rate
            FROM reservations
            WHERE check_in_date::date BETWEEN $1::date AND $2::date
              AND status NOT IN ('cancelled')
            GROUP BY rate_category
            ORDER BY bookings DESC
        `, [startDate, endDate]);

        res.json({
            byRoomType: byRoomType.rows,
            byRateCategory: byRateCategory.rows
        });
    } catch (error) {
        console.error('Reports rates error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/payments — Payment method distribution + recent payments
router.get('/payments', ...reportAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        // Payment method distribution
        const methodDistribution = await db.query(`
            SELECT method, 
                   COUNT(*) as count,
                   COALESCE(SUM(amount), 0) as total
            FROM folio_payments
            WHERE voided = FALSE
              AND date_received::date BETWEEN $1::date AND $2::date
            GROUP BY method
            ORDER BY total DESC
        `, [startDate, endDate]);

        // Recent payments (latest 20)
        const recentPayments = await db.query(`
            SELECT fp.*, 
                   r.confirmation_number,
                   g.first_name, g.last_name,
                   u.full_name as received_by_name
            FROM folio_payments fp
            JOIN reservations r ON fp.reservation_id = r.id
            JOIN guests g ON r.guest_id = g.id
            LEFT JOIN users u ON fp.received_by = u.id
            WHERE fp.voided = FALSE
              AND fp.date_received::date BETWEEN $1::date AND $2::date
            ORDER BY fp.date_received DESC
            LIMIT 20
        `, [startDate, endDate]);

        res.json({
            methodDistribution: methodDistribution.rows,
            recentPayments: recentPayments.rows
        });
    } catch (error) {
        console.error('Reports payments error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
