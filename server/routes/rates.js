const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// GET /api/rates - Get all active rates
router.get('/', auth, async (req, res) => {
    try {
        const { roomType, category } = req.query;

        let query = `
            SELECT * FROM rates 
            WHERE is_active = true 
            AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
        `;
        const params = [];

        if (roomType) {
            params.push(roomType);
            query += ` AND room_type = $${params.length}`;
        }

        if (category) {
            params.push(category);
            query += ` AND rate_category = $${params.length}`;
        }

        query += ' ORDER BY room_type, rate_category';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get rates error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/rates/calculate - Calculate rate for a stay
router.get('/calculate', auth, async (req, res) => {
    try {
        const { roomType, category, checkIn, checkOut } = req.query;

        if (!roomType || !checkIn || !checkOut) {
            return res.status(400).json({
                error: 'Room type, check-in, and check-out dates are required'
            });
        }

        // Get the rate
        const rateResult = await db.query(`
            SELECT * FROM rates 
            WHERE room_type = $1 
            AND rate_category = $2
            AND is_active = true
            AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
            ORDER BY effective_from DESC
            LIMIT 1
        `, [roomType, category || 'regular']);

        if (rateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Rate not found' });
        }

        const rate = rateResult.rows[0];

        // Calculate nights and total
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        let totalAmount = 0;
        let weekdayNights = 0;
        let weekendNights = 0;

        const currentDate = new Date(checkInDate);
        while (currentDate < checkOutDate) {
            const dayOfWeek = currentDate.getDay();
            // Friday (5) and Saturday (6) are weekend rates
            if (dayOfWeek === 5 || dayOfWeek === 6) {
                totalAmount += parseFloat(rate.weekend_rate);
                weekendNights++;
            } else {
                totalAmount += parseFloat(rate.weekday_rate);
                weekdayNights++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.json({
            roomType,
            category: category || 'regular',
            weekdayRate: rate.weekday_rate,
            weekendRate: rate.weekend_rate,
            weekdayNights,
            weekendNights,
            totalNights: weekdayNights + weekendNights,
            totalAmount: totalAmount.toFixed(2)
        });
    } catch (error) {
        console.error('Calculate rate error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/rates/:id - Update a rate (owner/manager only)
router.put('/:id', auth, authorize('owner', 'manager'), async (req, res) => {
    try {
        const { weekdayRate, weekendRate } = req.body;

        const result = await db.query(`
            UPDATE rates 
            SET weekday_rate = $1, weekend_rate = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [weekdayRate, weekendRate, req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Rate not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update rate error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
