const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// GET /api/housekeeping/rooms - Get all rooms with status for housekeeping
router.get('/rooms', auth, async (req, res) => {
    try {
        const { floor, status } = req.query;

        let query = `
            SELECT r.*, 
                   res.guest_id, res.check_out_date,
                   g.last_name as guest_name
            FROM rooms r
            LEFT JOIN reservations res ON r.id = res.room_id 
                AND res.status = 'checked_in'
            LEFT JOIN guests g ON res.guest_id = g.id
            WHERE 1=1
        `;
        const params = [];

        if (floor) {
            params.push(floor);
            query += ` AND r.floor = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND r.status = $${params.length}`;
        }

        query += ' ORDER BY r.floor, r.room_number';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get housekeeping rooms error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/housekeeping/summary - Get housekeeping summary
router.get('/summary', auth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                floor,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'vacant_clean') as clean,
                COUNT(*) FILTER (WHERE status = 'vacant_dirty') as dirty,
                COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                COUNT(*) FILTER (WHERE status = 'inspected') as inspected,
                COUNT(*) FILTER (WHERE status = 'out_of_order') as out_of_order
            FROM rooms
            GROUP BY floor
            ORDER BY floor
        `);

        // Also get total summary
        const totalResult = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'vacant_clean') as clean,
                COUNT(*) FILTER (WHERE status = 'vacant_dirty') as dirty,
                COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                COUNT(*) FILTER (WHERE status = 'inspected') as inspected,
                COUNT(*) FILTER (WHERE status = 'out_of_order') as out_of_order
            FROM rooms
        `);

        res.json({
            byFloor: result.rows,
            total: totalResult.rows[0]
        });
    } catch (error) {
        console.error('Get housekeeping summary error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/housekeeping/rooms/:id - Update room status (housekeeping can do this)
router.patch('/rooms/:id', auth, async (req, res) => {
    try {
        const { status, outOfOrderReason } = req.body;

        // Housekeeping can only set to vacant_clean or inspected
        // Other roles can set any status
        const housekeepingAllowed = ['vacant_clean', 'inspected'];
        const allStatuses = ['vacant_clean', 'vacant_dirty', 'occupied', 'inspected', 'out_of_order'];

        if (req.user.role === 'housekeeping' && !housekeepingAllowed.includes(status)) {
            return res.status(403).json({
                error: 'Housekeeping can only mark rooms as clean or inspected'
            });
        }

        if (!allStatuses.includes(status)) {
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
        console.error('Update housekeeping status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/housekeeping/bulk-update - Update multiple rooms at once
router.post('/bulk-update', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    try {
        const { roomIds, status, outOfOrderReason } = req.body;

        if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
            return res.status(400).json({ error: 'Room IDs are required' });
        }

        const validStatuses = ['vacant_clean', 'vacant_dirty', 'inspected', 'out_of_order'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status for bulk update' });
        }

        let query, params;

        if (status === 'out_of_order') {
            query = `
                UPDATE rooms 
                SET status = $1, is_out_of_order = true, out_of_order_reason = $2,
                    out_of_order_since = NOW(), updated_at = NOW()
                WHERE id = ANY($3) AND status != 'occupied'
                RETURNING *
            `;
            params = [status, outOfOrderReason || 'Bulk update', roomIds];
        } else {
            query = `
                UPDATE rooms 
                SET status = $1, is_out_of_order = false, out_of_order_reason = NULL,
                    out_of_order_since = NULL, updated_at = NOW()
                WHERE id = ANY($2) AND status != 'occupied'
                RETURNING *
            `;
            params = [status, roomIds];
        }

        const result = await db.query(query, params);

        res.json({
            message: `${result.rows.length} rooms updated`,
            rooms: result.rows
        });
    } catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
