const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// Generate confirmation number
const generateConfirmationNumber = () => {
    const prefix = 'MF';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
};

// GET /api/reservations - Get all reservations
router.get('/', auth, async (req, res) => {
    try {
        const { status, date, limit = 50 } = req.query;

        let query = `
            SELECT r.*, 
                   g.first_name, g.last_name, g.phone, g.email,
                   rm.room_number, rm.room_type, rm.floor
            FROM reservations r
            LEFT JOIN guests g ON r.guest_id = g.id
            LEFT JOIN rooms rm ON r.room_id = rm.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` AND r.status = $${params.length}`;
        }

        if (date) {
            params.push(date);
            query += ` AND (r.check_in_date = $${params.length} OR r.check_out_date = $${params.length})`;
        }

        query += ` ORDER BY r.check_in_date DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get reservations error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reservations/arrivals/:date - Get today's arrivals
router.get('/arrivals/:date', auth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.*, 
                   g.first_name, g.last_name, g.phone, g.email,
                   rm.room_number, rm.room_type, rm.floor
            FROM reservations r
            LEFT JOIN guests g ON r.guest_id = g.id
            LEFT JOIN rooms rm ON r.room_id = rm.id
            WHERE r.check_in_date = $1 
            AND r.status IN ('confirmed', 'checked_in')
            ORDER BY r.created_at
        `, [req.params.date]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get arrivals error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reservations/departures/:date - Get today's departures
router.get('/departures/:date', auth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.*, 
                   g.first_name, g.last_name, g.phone, g.email,
                   rm.room_number, rm.room_type, rm.floor
            FROM reservations r
            LEFT JOIN guests g ON r.guest_id = g.id
            LEFT JOIN rooms rm ON r.room_id = rm.id
            WHERE r.check_out_date = $1 
            AND r.status = 'checked_in'
            ORDER BY rm.room_number
        `, [req.params.date]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get departures error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reservations/tape-chart/:startDate/:endDate - Get reservations for tape chart
router.get('/tape-chart/:startDate/:endDate', auth, async (req, res) => {
    try {
        const { startDate, endDate } = req.params;

        const result = await db.query(`
            SELECT r.id, r.confirmation_number, r.room_id, r.check_in_date, r.check_out_date, r.status,
                   g.first_name, g.last_name,
                   rm.room_number, rm.room_type, rm.floor
            FROM reservations r
            LEFT JOIN guests g ON r.guest_id = g.id
            LEFT JOIN rooms rm ON r.room_id = rm.id
            WHERE r.room_id IS NOT NULL
            AND r.status IN ('confirmed', 'checked_in')
            AND r.check_in_date <= $2 
            AND r.check_out_date >= $1
            ORDER BY rm.room_number, r.check_in_date
        `, [startDate, endDate]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get tape chart error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reservations/:id - Get single reservation
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.*, 
                   g.*,
                   rm.room_number, rm.room_type, rm.floor,
                   COALESCE((SELECT SUM(amount) FROM folio_payments WHERE reservation_id = r.id AND voided = FALSE), 0) as amount_paid
            FROM reservations r
            LEFT JOIN guests g ON r.guest_id = g.id
            LEFT JOIN rooms rm ON r.room_id = rm.id
            WHERE r.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get reservation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/reservations/:id - Update reservation
router.patch('/:id', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    try {
        const {
            checkInDate,
            checkOutDate,
            nightlyRate,
            numGuests,
            internalNotes,
            earlyCheckinFee,
            lateCheckoutFee,
            roomId,
        } = req.body;

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (checkInDate !== undefined) {
            paramCount++;
            updates.push(`check_in_date = $${paramCount}`);
            values.push(checkInDate);
        }
        if (checkOutDate !== undefined) {
            paramCount++;
            updates.push(`check_out_date = $${paramCount}`);
            values.push(checkOutDate);
        }
        if (nightlyRate !== undefined) {
            paramCount++;
            updates.push(`nightly_rate = $${paramCount}`);
            values.push(nightlyRate);
        }
        if (numGuests !== undefined) {
            paramCount++;
            updates.push(`num_guests = $${paramCount}`);
            values.push(numGuests);
        }
        if (notes !== undefined) {
            paramCount++;
            updates.push(`notes = $${paramCount}`);
            values.push(notes);
        }
        if (internalNotes !== undefined) {
            paramCount++;
            updates.push(`internal_notes = $${paramCount}`);
            values.push(internalNotes);
        }
        if (earlyCheckinFee !== undefined) {
            paramCount++;
            updates.push(`early_checkin_fee = $${paramCount}`);
            values.push(earlyCheckinFee);
        }
        if (lateCheckoutFee !== undefined) {
            paramCount++;
            updates.push(`late_checkout_fee = $${paramCount}`);
            values.push(lateCheckoutFee);
        }
        if (roomId !== undefined) {
            paramCount++;
            updates.push(`room_id = $${paramCount}`);
            values.push(roomId);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = NOW()');
        paramCount++;
        values.push(req.params.id);

        const result = await db.query(
            `UPDATE reservations SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update reservation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/reservations/:id/payment - Add payment to reservation
router.post('/:id/payment', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    try {
        const { amount, method } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        // Check if payments table exists, create if not
        await db.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                reservation_id INTEGER REFERENCES reservations(id),
                amount DECIMAL(10, 2) NOT NULL,
                method VARCHAR(20) DEFAULT 'cash',
                received_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const result = await db.query(`
            INSERT INTO payments (reservation_id, amount, method, received_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [req.params.id, amount, method || 'cash', req.user.id]);

        // Update payment status
        const totalPaid = await db.query(
            'SELECT SUM(amount) as total FROM payments WHERE reservation_id = $1',
            [req.params.id]
        );

        const reservation = await db.query(
            'SELECT nightly_rate, check_in_date, check_out_date, early_checkin_fee, late_checkout_fee FROM reservations WHERE id = $1',
            [req.params.id]
        );

        if (reservation.rows.length > 0) {
            const res_data = reservation.rows[0];
            const nights = Math.ceil((new Date(res_data.check_out_date) - new Date(res_data.check_in_date)) / (1000 * 60 * 60 * 24));
            const total = (nights * parseFloat(res_data.nightly_rate)) +
                parseFloat(res_data.early_checkin_fee || 0) +
                parseFloat(res_data.late_checkout_fee || 0);
            const paid = parseFloat(totalPaid.rows[0].total) || 0;

            let paymentStatus = 'pending';
            if (paid >= total) paymentStatus = 'paid';
            else if (paid > 0) paymentStatus = 'partial';

            await db.query(
                'UPDATE reservations SET payment_status = $1 WHERE id = $2',
                [paymentStatus, req.params.id]
            );
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add payment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/reservations - Create new reservation (walk-in)
router.post('/', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const {
            roomId,
            checkInDate,
            checkOutDate,
            rateCategory,
            nightlyRate,
            numGuests,
            earlyCheckinFee,
            paymentMethod,
            notes,
            guest
        } = req.body;

        // Create or find guest
        let guestId;

        if (guest.id) {
            guestId = guest.id;
        } else {
            const guestResult = await client.query(`
                INSERT INTO guests (first_name, last_name, phone, email, id_number, id_type,
                    vehicle_make, vehicle_model, vehicle_color, vehicle_plate, vehicle_state, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `, [
                guest.firstName, guest.lastName, guest.phone, guest.email,
                guest.idNumber, guest.idType, guest.vehicleMake, guest.vehicleModel,
                guest.vehicleColor, guest.vehiclePlate, guest.vehicleState, guest.notes
            ]);
            guestId = guestResult.rows[0].id;
        }

        // Calculate total
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        const totalAmount = (nightlyRate * nights) + (earlyCheckinFee || 0);

        // Create reservation
        const confirmationNumber = generateConfirmationNumber();

        const reservationResult = await client.query(`
            INSERT INTO reservations (
                confirmation_number, room_id, guest_id, check_in_date, check_out_date,
                rate_category, nightly_rate, total_amount, early_checkin_fee,
                num_guests, status, payment_method, notes, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            confirmationNumber, roomId, guestId, checkInDate, checkOutDate,
            rateCategory || 'regular', nightlyRate, totalAmount, earlyCheckinFee || 0,
            numGuests || 1, 'confirmed', paymentMethod, notes, req.user.id
        ]);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Reservation created successfully',
            reservation: reservationResult.rows[0],
            confirmationNumber
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create reservation error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PATCH /api/reservations/:id/checkin - Check in guest
router.patch('/:id/checkin', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Get reservation
        const resResult = await client.query(
            'SELECT * FROM reservations WHERE id = $1',
            [req.params.id]
        );

        if (resResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        const reservation = resResult.rows[0];

        if (reservation.status !== 'confirmed') {
            return res.status(400).json({ error: 'Reservation cannot be checked in' });
        }

        // Prevent check-in before the reservation date
        const checkInDate = new Date(reservation.check_in_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        checkInDate.setHours(0, 0, 0, 0);

        if (checkInDate > today) {
            return res.status(400).json({
                error: `Cannot check in before ${checkInDate.toLocaleDateString()}. Check-in is available on the reservation date.`
            });
        }

        // Update reservation
        await client.query(`
            UPDATE reservations 
            SET status = 'checked_in', actual_check_in = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [req.params.id]);

        // Update room status
        if (reservation.room_id) {
            await client.query(`
                UPDATE rooms SET status = 'occupied', updated_at = NOW()
                WHERE id = $1
            `, [reservation.room_id]);
        }

        await client.query('COMMIT');

        res.json({ message: 'Guest checked in successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Check in error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PATCH /api/reservations/:id/checkout - Check out guest
router.patch('/:id/checkout', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Get reservation
        const resResult = await client.query(
            'SELECT * FROM reservations WHERE id = $1',
            [req.params.id]
        );

        if (resResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        const reservation = resResult.rows[0];

        if (reservation.status !== 'checked_in') {
            return res.status(400).json({ error: 'Reservation cannot be checked out' });
        }

        const { lateCheckoutFee, paymentStatus } = req.body;

        // Update reservation
        await client.query(`
            UPDATE reservations 
            SET status = 'checked_out', 
                actual_check_out = NOW(), 
                late_checkout_fee = $2,
                payment_status = $3,
                updated_at = NOW()
            WHERE id = $1
        `, [req.params.id, lateCheckoutFee || 0, paymentStatus || 'paid']);

        // Update room status to dirty
        if (reservation.room_id) {
            await client.query(`
                UPDATE rooms SET status = 'vacant_dirty', updated_at = NOW()
                WHERE id = $1
            `, [reservation.room_id]);
        }

        await client.query('COMMIT');

        res.json({ message: 'Guest checked out successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Check out error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PATCH /api/reservations/:id/cancel - Cancel reservation with reason
router.patch('/:id/cancel', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    try {
        const { reason } = req.body || {};
        console.log('Cancel request - id:', req.params.id, 'reason:', reason);
        const result = await db.query(`
            UPDATE reservations 
            SET status = 'cancelled', 
                cancellation_reason = $2,
                updated_at = NOW()
            WHERE id = $1 AND status = 'confirmed'
            RETURNING *
        `, [req.params.id, reason || null]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reservation not found or cannot be cancelled' });
        }

        res.json({ message: 'Reservation cancelled successfully' });
    } catch (error) {
        console.error('Cancel reservation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
