const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// GET /api/folio/:id - Get complete folio data
router.get('/:id', auth, async (req, res) => {
    try {
        // Get reservation with guest and room info
        const reservationResult = await db.query(`
            SELECT r.*, 
                   g.first_name, g.last_name, g.phone, g.email, g.id_number, g.id_type,
                   g.vehicle_make, g.vehicle_model, g.vehicle_color, g.vehicle_plate, g.vehicle_state,
                   rm.room_number, rm.room_type, rm.floor, rm.status as room_status
            FROM reservations r
            LEFT JOIN guests g ON r.guest_id = g.id
            LEFT JOIN rooms rm ON r.room_id = rm.id
            WHERE r.id = $1
        `, [req.params.id]);

        if (reservationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        const reservation = reservationResult.rows[0];

        // Get charges
        const chargesResult = await db.query(`
            SELECT fc.*, u.full_name as added_by_name
            FROM folio_charges fc
            LEFT JOIN users u ON fc.added_by = u.id
            WHERE fc.reservation_id = $1 AND fc.voided = FALSE
            ORDER BY fc.date_added
        `, [req.params.id]);

        // Get payments
        const paymentsResult = await db.query(`
            SELECT fp.*, u.full_name as received_by_name
            FROM folio_payments fp
            LEFT JOIN users u ON fp.received_by = u.id
            WHERE fp.reservation_id = $1 AND fp.voided = FALSE
            ORDER BY fp.date_received
        `, [req.params.id]);

        // Calculate totals
        const totalCharges = chargesResult.rows.reduce((sum, c) => sum + parseFloat(c.amount) * c.quantity, 0);
        const totalPayments = paymentsResult.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        res.json({
            reservation,
            charges: chargesResult.rows,
            payments: paymentsResult.rows,
            summary: {
                totalCharges,
                totalPayments,
                balance: totalCharges - totalPayments
            }
        });
    } catch (error) {
        console.error('Get folio error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/folio/:id/charges - Add a charge
router.post('/:id/charges', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    try {
        const { category, description, amount, quantity = 1 } = req.body;

        if (!category || !description || !amount) {
            return res.status(400).json({ error: 'Category, description, and amount are required' });
        }

        const result = await db.query(`
            INSERT INTO folio_charges (reservation_id, category, description, amount, quantity, added_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [req.params.id, category, description, amount, quantity, req.user.id]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add charge error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/folio/:id/charges/:chargeId - Void a charge
router.delete('/:id/charges/:chargeId', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    try {
        const result = await db.query(`
            UPDATE folio_charges 
            SET voided = TRUE, voided_at = NOW(), voided_by = $1
            WHERE id = $2 AND reservation_id = $3
            RETURNING *
        `, [req.user.id, req.params.chargeId, req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Charge not found' });
        }

        res.json({ message: 'Charge voided', charge: result.rows[0] });
    } catch (error) {
        console.error('Void charge error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/folio/:id/payments - Add a payment
router.post('/:id/payments', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    try {
        const { amount, method = 'cash', reference = '' } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        const result = await db.query(`
            INSERT INTO folio_payments (reservation_id, amount, method, reference, received_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [req.params.id, amount, method, reference, req.user.id]);

        // Update reservation payment status
        const totals = await db.query(`
            SELECT 
                COALESCE((SELECT SUM(amount * quantity) FROM folio_charges WHERE reservation_id = $1 AND voided = FALSE), 0) as total_charges,
                COALESCE((SELECT SUM(amount) FROM folio_payments WHERE reservation_id = $1 AND voided = FALSE), 0) as total_payments
        `, [req.params.id]);

        const { total_charges, total_payments } = totals.rows[0];
        let paymentStatus = 'pending';
        if (parseFloat(total_payments) >= parseFloat(total_charges)) {
            paymentStatus = 'paid';
        } else if (parseFloat(total_payments) > 0) {
            paymentStatus = 'partial';
        }

        await db.query('UPDATE reservations SET payment_status = $1 WHERE id = $2', [paymentStatus, req.params.id]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add payment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/folio/:id/room - Change room assignment
router.patch('/:id/room', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const { newRoomId } = req.body;

        if (!newRoomId) {
            return res.status(400).json({ error: 'New room ID is required' });
        }

        // Get current reservation
        const resResult = await client.query('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
        if (resResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        const reservation = resResult.rows[0];
        const oldRoomId = reservation.room_id;

        // Check if new room is available
        const newRoomResult = await client.query('SELECT * FROM rooms WHERE id = $1', [newRoomId]);
        if (newRoomResult.rows.length === 0) {
            return res.status(404).json({ error: 'New room not found' });
        }

        const newRoom = newRoomResult.rows[0];
        if (newRoom.status === 'occupied' || newRoom.status === 'out_of_order') {
            return res.status(400).json({ error: 'Room is not available' });
        }

        // Update reservation with new room
        await client.query('UPDATE reservations SET room_id = $1, updated_at = NOW() WHERE id = $2', [newRoomId, req.params.id]);

        // Update room statuses
        if (reservation.status === 'checked_in') {
            // Mark old room as dirty
            if (oldRoomId) {
                await client.query("UPDATE rooms SET status = 'vacant_dirty', updated_at = NOW() WHERE id = $1", [oldRoomId]);
            }
            // Mark new room as occupied
            await client.query("UPDATE rooms SET status = 'occupied', updated_at = NOW() WHERE id = $1", [newRoomId]);
        }

        await client.query('COMMIT');

        res.json({ message: 'Room changed successfully', newRoom: newRoom.room_number });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Change room error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// POST /api/folio/:id/generate-room-charges - Auto-generate room charges
router.post('/:id/generate-room-charges', auth, authorize('owner', 'manager', 'frontdesk'), async (req, res) => {
    try {
        const resResult = await db.query('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
        if (resResult.rows.length === 0) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        const reservation = resResult.rows[0];
        const checkIn = new Date(reservation.check_in_date);
        const checkOut = new Date(reservation.check_out_date);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        const nightlyRate = parseFloat(reservation.nightly_rate);

        // Check if room charges already exist
        const existing = await db.query(
            "SELECT COUNT(*) FROM folio_charges WHERE reservation_id = $1 AND category = 'room' AND voided = FALSE",
            [req.params.id]
        );

        if (parseInt(existing.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Room charges already generated' });
        }

        // Generate charge for total room cost
        const result = await db.query(`
            INSERT INTO folio_charges (reservation_id, category, description, amount, quantity, added_by)
            VALUES ($1, 'room', $2, $3, $4, $5)
            RETURNING *
        `, [req.params.id, `Room charge (${nights} nights)`, nightlyRate, nights, req.user.id]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Generate room charges error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
