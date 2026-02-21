const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// GET /api/rooms - Get all rooms
router.get('/', auth, async (req, res) => {
    try {
        const { floor, status, roomType } = req.query;

        let query = 'SELECT * FROM rooms WHERE 1=1';
        const params = [];

        if (floor) {
            params.push(floor);
            query += ` AND floor = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        if (roomType) {
            params.push(roomType);
            query += ` AND room_type = $${params.length}`;
        }

        query += ' ORDER BY room_number';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/rooms/summary - Get room status summary
router.get('/summary', auth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'vacant_clean') as vacant_clean,
                COUNT(*) FILTER (WHERE status = 'vacant_dirty') as vacant_dirty,
                COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                COUNT(*) FILTER (WHERE status = 'inspected') as inspected,
                COUNT(*) FILTER (WHERE status = 'out_of_order') as out_of_order
            FROM rooms
        `);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/rooms/:id - Get single room
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM rooms WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get room error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/rooms/:id/status - Update room status
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status, outOfOrderReason } = req.body;

        const validStatuses = ['vacant_clean', 'vacant_dirty', 'occupied', 'inspected', 'out_of_order'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        let query, params;

        if (status === 'out_of_order') {
            query = `
                UPDATE rooms 
                SET status = $1, is_out_of_order = true, out_of_order_reason = $2, 
                    out_of_order_since = NOW(), updated_at = NOW()
                WHERE id = $3
                RETURNING *
            `;
            params = [status, outOfOrderReason || '', req.params.id];
        } else {
            query = `
                UPDATE rooms 
                SET status = $1, is_out_of_order = false, out_of_order_reason = NULL,
                    out_of_order_since = NULL, updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `;
            params = [status, req.params.id];
        }

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update room status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/rooms/floor/:floor - Get rooms by floor
router.get('/floor/:floor', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM rooms WHERE floor = $1 ORDER BY room_number',
            [req.params.floor]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get rooms by floor error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/rooms/available - Get available rooms for date range
router.get('/available/:checkIn/:checkOut', auth, async (req, res) => {
    try {
        const { checkIn, checkOut } = req.params;
        const { roomType } = req.query;

        let query = `
            SELECT r.* FROM rooms r
            WHERE r.status != 'out_of_order'
            AND r.id NOT IN (
                SELECT room_id FROM reservations 
                WHERE status IN ('confirmed', 'checked_in')
                AND check_in_date < $2 
                AND check_out_date > $1
                AND room_id IS NOT NULL
            )
        `;
        const params = [checkIn, checkOut];

        if (roomType) {
            params.push(roomType);
            query += ` AND r.room_type = $${params.length}`;
        }

        query += ' ORDER BY r.room_number';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get available rooms error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
