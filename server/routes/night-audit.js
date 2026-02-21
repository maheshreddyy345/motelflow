const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// Helper to get a client for transactions
const getClient = () => db.pool.connect();

// Only owner/manager can run night audit
const auditAuth = [auth, authorize('owner', 'manager')];

// ─── GET /api/night-audit/preview ───────────────────────────────────────
// Preview what the audit will do before running it
router.get('/preview', ...auditAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Check if already audited today
        const existing = await db.query(
            'SELECT * FROM night_audits WHERE audit_date = $1', [today]
        );

        // In-house guests (checked_in) — will get room charges posted
        const inHouse = await db.query(`
            SELECT r.id, r.confirmation_number, r.nightly_rate, r.room_id,
                   r.check_in_date, r.check_out_date,
                   rm.room_number, rm.room_type,
                   g.first_name, g.last_name
            FROM reservations r
            JOIN rooms rm ON r.room_id = rm.id
            JOIN guests g ON r.guest_id = g.id
            WHERE r.status = 'checked_in'
            ORDER BY rm.room_number
        `);

        // Check if room charges already posted today for each reservation
        const chargesPosted = await db.query(`
            SELECT reservation_id, COUNT(*) as count
            FROM folio_charges
            WHERE category = 'room'
              AND date_added::date = $1
              AND voided = false
            GROUP BY reservation_id
        `, [today]);
        const postedSet = new Set(chargesPosted.rows.map(r => r.reservation_id));

        // No-show candidates (confirmed for today, not checked in)
        const noShows = await db.query(`
            SELECT r.id, r.confirmation_number, r.nightly_rate,
                   r.check_in_date, r.room_id,
                   rm.room_number, rm.room_type,
                   g.first_name, g.last_name, g.phone
            FROM reservations r
            JOIN guests g ON r.guest_id = g.id
            LEFT JOIN rooms rm ON r.room_id = rm.id
            WHERE r.status = 'confirmed'
              AND r.check_in_date <= $1
            ORDER BY r.check_in_date
        `, [today]);

        // Today's stats
        const totalRooms = await db.query(
            'SELECT COUNT(*) as count FROM rooms WHERE is_out_of_order = false'
        );
        const occupiedRooms = await db.query(
            "SELECT COUNT(*) as count FROM rooms WHERE status = 'occupied'"
        );
        const todayRevenue = await db.query(`
            SELECT COALESCE(SUM(amount * quantity), 0) as total
            FROM folio_charges
            WHERE date_added::date = $1 AND voided = false
        `, [today]);
        const todayPayments = await db.query(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM folio_payments
            WHERE date_received::date = $1 AND voided = false
        `, [today]);
        const todayCheckIns = await db.query(`
            SELECT COUNT(*) as count FROM reservations
            WHERE actual_check_in::date = $1
        `, [today]);
        const todayCheckOuts = await db.query(`
            SELECT COUNT(*) as count FROM reservations
            WHERE actual_check_out::date = $1
        `, [today]);

        // Dirty rooms warning
        const dirtyRooms = await db.query(
            "SELECT COUNT(*) as count FROM rooms WHERE status = 'vacant_dirty'"
        );

        const totalAvailable = parseInt(totalRooms.rows[0].count);
        const occupied = parseInt(occupiedRooms.rows[0].count);
        const roomChargeTotal = inHouse.rows
            .filter(r => !postedSet.has(r.id))
            .reduce((sum, r) => sum + parseFloat(r.nightly_rate), 0);

        res.json({
            auditDate: today,
            alreadyAudited: existing.rows.length > 0,
            previousAudit: existing.rows[0] || null,
            inHouseGuests: inHouse.rows.map(r => ({
                ...r,
                chargeAlreadyPosted: postedSet.has(r.id)
            })),
            noShowCandidates: noShows.rows,
            stats: {
                totalRooms: totalAvailable,
                occupiedRooms: occupied,
                occupancyPct: totalAvailable > 0 ? ((occupied / totalAvailable) * 100).toFixed(1) : 0,
                roomChargeTotal,
                todayRevenue: parseFloat(todayRevenue.rows[0].total),
                todayPayments: parseFloat(todayPayments.rows[0].total),
                todayCheckIns: parseInt(todayCheckIns.rows[0].count),
                todayCheckOuts: parseInt(todayCheckOuts.rows[0].count),
                dirtyRooms: parseInt(dirtyRooms.rows[0].count),
            },
            chargesToPost: inHouse.rows.filter(r => !postedSet.has(r.id)).length,
        });
    } catch (error) {
        console.error('Night audit preview error:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

// ─── POST /api/night-audit/run ──────────────────────────────────────────
// Execute the night audit
router.post('/run', ...auditAuth, async (req, res) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        const today = new Date().toISOString().split('T')[0];
        const { notes } = req.body;

        // Prevent double-run
        const existing = await client.query(
            'SELECT id FROM night_audits WHERE audit_date = $1', [today]
        );
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Night audit already completed for today' });
        }

        // 1. POST ROOM CHARGES for all checked-in guests
        const inHouse = await client.query(`
            SELECT r.id, r.nightly_rate, rm.room_number
            FROM reservations r
            JOIN rooms rm ON r.room_id = rm.id
            WHERE r.status = 'checked_in'
        `);

        let revenuePosted = 0;
        let chargesPosted = 0;

        for (const reservation of inHouse.rows) {
            // Check if charge already posted today
            const alreadyPosted = await client.query(`
                SELECT id FROM folio_charges
                WHERE reservation_id = $1
                  AND category = 'room'
                  AND date_added::date = $2
                  AND voided = false
            `, [reservation.id, today]);

            if (alreadyPosted.rows.length === 0) {
                await client.query(`
                    INSERT INTO folio_charges (reservation_id, category, description, amount, quantity, added_by)
                    VALUES ($1, 'room', $2, $3, 1, $4)
                `, [
                    reservation.id,
                    `Room ${reservation.room_number} - Night Audit ${today}`,
                    reservation.nightly_rate,
                    req.user.id
                ]);
                revenuePosted += parseFloat(reservation.nightly_rate);
                chargesPosted++;
            }
        }

        // 2. MARK NO-SHOWS
        const noShowResult = await client.query(`
            UPDATE reservations
            SET status = 'no_show', updated_at = NOW()
            WHERE status = 'confirmed'
              AND check_in_date <= $1
            RETURNING id
        `, [today]);
        const noShowCount = noShowResult.rows.length;

        // Free up rooms assigned to no-shows
        if (noShowCount > 0) {
            const noShowIds = noShowResult.rows.map(r => r.id);
            await client.query(`
                UPDATE rooms SET status = 'vacant_dirty', updated_at = NOW()
                WHERE id IN (
                    SELECT room_id FROM reservations WHERE id = ANY($1) AND room_id IS NOT NULL
                )
            `, [noShowIds]);
        }

        // 3. RESET HOUSEKEEPING — occupied rooms to dirty
        await client.query(`
            UPDATE rooms SET status = 'vacant_dirty', updated_at = NOW()
            WHERE status = 'occupied'
        `);

        // 4. SNAPSHOT — gather daily totals
        const totalRooms = await client.query(
            'SELECT COUNT(*) as count FROM rooms WHERE is_out_of_order = false'
        );
        const totalRevenue = await client.query(`
            SELECT COALESCE(SUM(amount * quantity), 0) as total
            FROM folio_charges
            WHERE date_added::date = $1 AND voided = false
        `, [today]);
        const totalPayments = await client.query(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM folio_payments
            WHERE date_received::date = $1 AND voided = false
        `, [today]);
        const checkIns = await client.query(
            "SELECT COUNT(*) as count FROM reservations WHERE actual_check_in::date = $1", [today]
        );
        const checkOuts = await client.query(
            "SELECT COUNT(*) as count FROM reservations WHERE actual_check_out::date = $1", [today]
        );

        const totalRoomCount = parseInt(totalRooms.rows[0].count);
        const occupiedCount = inHouse.rows.length;
        const occupancyPct = totalRoomCount > 0
            ? ((occupiedCount / totalRoomCount) * 100).toFixed(2)
            : 0;
        const adr = occupiedCount > 0
            ? (parseFloat(totalRevenue.rows[0].total) / occupiedCount).toFixed(2)
            : 0;

        // 5. SAVE AUDIT RECORD
        const auditResult = await client.query(`
            INSERT INTO night_audits (
                audit_date, run_by, total_rooms, occupied_rooms,
                occupancy_pct, adr, revenue_posted, total_revenue,
                total_payments, no_shows, checked_in, checked_out, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            today, req.user.id, totalRoomCount, occupiedCount,
            occupancyPct, adr, revenuePosted,
            parseFloat(totalRevenue.rows[0].total),
            parseFloat(totalPayments.rows[0].total),
            noShowCount,
            parseInt(checkIns.rows[0].count),
            parseInt(checkOuts.rows[0].count),
            notes || null
        ]);

        await client.query('COMMIT');

        console.log(`🌙 Night Audit completed for ${today} by user ${req.user.id}`);

        res.json({
            success: true,
            audit: auditResult.rows[0],
            summary: {
                chargesPosted,
                revenuePosted,
                noShowsMarked: noShowCount,
                roomsReset: inHouse.rows.length,
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Night audit run error:', error);
        res.status(500).json({ error: 'Night audit failed: ' + error.message });
    } finally {
        client.release();
    }
});

// ─── GET /api/night-audit/history ───────────────────────────────────────
router.get('/history', ...auditAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT na.*, u.full_name as run_by_name
            FROM night_audits na
            LEFT JOIN users u ON na.run_by = u.id
            ORDER BY na.audit_date DESC
            LIMIT 30
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Night audit history error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

module.exports = router;
