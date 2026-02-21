/**
 * Fresh Reseed Script for Motel Flow
 * 
 * Wipes ALL reservation, folio, guest, and audit data.
 * Generates ~120 realistic reservations anchored to TODAY.
 * 
 * Distribution:
 *   - ~30% Currently Occupied (checked_in, stayovers)
 *   - ~10% Arriving Today (confirmed, check_in_date = today)
 *   - ~10% Departing Today (checked_in, check_out_date = today)
 *   - ~15% Checked Out (past guests, completed stays)
 *   - ~5%  No Shows (past confirmed that never arrived)
 *   - ~5%  Cancelled
 *   - ~25% Future Reservations (arriving in next 1-14 days)
 */

const { pool } = require('../config/db');

// ── Name Data ──────────────────────────────────────────
const firstNames = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael',
    'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan',
    'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Daniel',
    'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Betty', 'Mark', 'Margaret',
    'Donald', 'Sandra', 'Steven', 'Ashley', 'Paul', 'Dorothy', 'Andrew',
    'Kimberly', 'Joshua', 'Emily', 'Kenneth', 'Donna', 'Kevin', 'Michelle',
    'Brian', 'Carol', 'George', 'Amanda', 'Timothy', 'Melissa', 'Ronald',
    'Deborah', 'Edward', 'Stephanie', 'Jason', 'Rebecca', 'Jeffrey', 'Sharon',
    'Ryan', 'Laura', 'Jacob', 'Cynthia', 'Gary', 'Kathleen', 'Nicholas',
    'Amy', 'Eric', 'Angela', 'Jonathan', 'Shirley', 'Stephen', 'Anna',
    'Larry', 'Brenda', 'Justin', 'Pamela', 'Scott', 'Emma', 'Brandon',
    'Nicole', 'Benjamin', 'Helen', 'Samuel', 'Samantha', 'Raymond', 'Katherine',
    'Gregory', 'Christine', 'Frank', 'Debra', 'Alexander', 'Rachel', 'Patrick',
    'Carolyn', 'Jack', 'Janet', 'Dennis', 'Catherine', 'Jerry', 'Maria'
];

const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
    'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
    'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
    'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
    'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
    'Carter', 'Roberts'
];

const rateCategories = ['regular', 'aaa', 'military', 'government', 'senior'];

const rates = {
    SK: { regular: 79, aaa: 71.10, military: 67.15, government: 75, senior: 71.10 },
    DQ: { regular: 89, aaa: 80.10, military: 75.65, government: 85, senior: 80.10 },
    DQS: { regular: 119, aaa: 107.10, military: 101.15, government: 115, senior: 107.10 },
    ACC: { regular: 79, aaa: 71.10, military: 67.15, government: 75, senior: 71.10 },
};

// ── Helpers ─────────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function fmt(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function genConfirmation() {
    return 'MF' + Date.now().toString(36).toUpperCase().slice(-4) + randInt(1000, 9999);
}

// ── Main ────────────────────────────────────────────────
async function reseed() {
    const client = await pool.connect();
    try {
        console.log('🗑️  Wiping old data...');
        await client.query('BEGIN');

        // Delete in dependency order — use TRUNCATE CASCADE to handle all FKs
        await client.query('TRUNCATE night_audits, folio_payments, folio_charges, reservation_history, reservations, guests RESTART IDENTITY CASCADE');
        // Also clear any other payment tables
        try { await client.query('TRUNCATE payments RESTART IDENTITY CASCADE'); } catch (e) { /* may not exist */ }

        // Reset ALL room statuses
        await client.query(`UPDATE rooms SET status = 'vacant_clean', is_out_of_order = false, out_of_order_reason = NULL, out_of_order_since = NULL, updated_at = NOW()`);

        // Mark 2 rooms as out of order for realism
        await client.query(`UPDATE rooms SET status = 'out_of_order', is_out_of_order = true, out_of_order_reason = 'Plumbing repair', out_of_order_since = NOW() WHERE room_number IN ('215', '322')`);

        console.log('✅ Old data cleared. Generating fresh reservations...');

        // Get all available rooms
        const roomsRes = await client.query('SELECT * FROM rooms WHERE is_out_of_order = false ORDER BY floor, room_number');
        const rooms = roomsRes.rows;

        const today = new Date();
        today.setHours(12, 0, 0, 0);

        let totalCreated = 0;
        const usedConfirmations = new Set();

        // Helper to create a guest
        async function createGuest() {
            const fn = pick(firstNames);
            const ln = pick(lastNames);
            const res = await client.query(
                `INSERT INTO guests (first_name, last_name, phone, email)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [
                    fn, ln,
                    `${randInt(200, 999)}-${randInt(100, 999)}-${randInt(1000, 9999)}`,
                    `${fn.toLowerCase()}.${ln.toLowerCase()}${randInt(1, 99)}@email.com`
                ]
            );
            return res.rows[0].id;
        }

        // Helper to create a reservation
        async function createRes(roomId, guestId, checkIn, checkOut, status, roomType) {
            let conf;
            do { conf = genConfirmation(); } while (usedConfirmations.has(conf));
            usedConfirmations.add(conf);

            const rateCat = pick(rateCategories);
            const nightlyRate = rates[roomType]?.[rateCat] || 89;
            const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
            const total = nightlyRate * nights;
            const numGuests = randInt(1, roomType === 'DQ' || roomType === 'DQS' ? 4 : 2);

            const actualCheckIn = (status === 'checked_in' || status === 'checked_out')
                ? new Date(checkIn.getTime() + randInt(0, 4) * 60 * 60 * 1000) // 0-4 hours after noon
                : null;
            const actualCheckOut = status === 'checked_out'
                ? new Date(checkOut.getTime() - randInt(0, 3) * 60 * 60 * 1000)
                : null;

            const paymentStatus = status === 'checked_out' ? 'paid'
                : (status === 'checked_in' && Math.random() > 0.5) ? 'partial'
                    : 'pending';

            await client.query(`
                INSERT INTO reservations (
                    confirmation_number, room_id, guest_id,
                    check_in_date, check_out_date,
                    actual_check_in, actual_check_out,
                    rate_category, nightly_rate, total_amount,
                    num_guests, status, payment_status,
                    notes, created_by
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,1)
            `, [
                conf, roomId, guestId,
                fmt(checkIn), fmt(checkOut),
                actualCheckIn, actualCheckOut,
                rateCat, nightlyRate, total,
                numGuests, status, paymentStatus,
                `${rateCat.charAt(0).toUpperCase() + rateCat.slice(1)} rate`,
                // created_by = 1 (owner)
            ]);

            // Add folio charge for checked-in/checked-out guests
            if (status === 'checked_in' || status === 'checked_out') {
                // Post a room charge for each night stayed so far
                const stayedNights = status === 'checked_out'
                    ? nights
                    : Math.max(1, Math.ceil((today - checkIn) / (1000 * 60 * 60 * 24)));

                // Get the reservation ID
                const resIdResult = await client.query(
                    'SELECT id FROM reservations WHERE confirmation_number = $1', [conf]
                );
                const resId = resIdResult.rows[0].id;

                for (let n = 0; n < stayedNights; n++) {
                    const chargeDate = addDays(checkIn, n);
                    await client.query(`
                        INSERT INTO folio_charges (reservation_id, category, description, amount, quantity, date_added, added_by)
                        VALUES ($1, 'room', $2, $3, 1, $4, 1)
                    `, [resId, `Room charge - ${fmt(chargeDate)}`, nightlyRate, chargeDate]);
                }

                // Add a payment for checked-out guests
                if (status === 'checked_out') {
                    const method = pick(['cash', 'card', 'card', 'card']); // cards more common
                    await client.query(`
                        INSERT INTO folio_payments (reservation_id, amount, method, reference, date_received, received_by)
                        VALUES ($1, $2, $3, $4, $5, 1)
                    `, [resId, total, method, method === 'card' ? `****${randInt(1000, 9999)}` : null, actualCheckOut]);
                }

                // Partial payment for some checked-in guests
                if (status === 'checked_in' && paymentStatus === 'partial') {
                    const resIdR = resIdResult.rows[0].id;
                    await client.query(`
                        INSERT INTO folio_payments (reservation_id, amount, method, reference, date_received, received_by)
                        VALUES ($1, $2, 'card', $3, $4, 1)
                    `, [resIdR, nightlyRate, `****${randInt(1000, 9999)}`, actualCheckIn]);
                }
            }

            totalCreated++;
        }

        // ── DISTRIBUTION ─────────────────────────────────────
        // Shuffle rooms for variety
        const shuffled = [...rooms].sort(() => Math.random() - 0.5);
        let roomIdx = 0;

        // 1) CURRENTLY OCCUPIED — Stayovers (30 rooms)
        const stayoverCount = 30;
        console.log(`  Creating ${stayoverCount} stayover (occupied) reservations...`);
        for (let i = 0; i < stayoverCount && roomIdx < shuffled.length; i++, roomIdx++) {
            const room = shuffled[roomIdx];
            const guestId = await createGuest();
            const daysAgo = randInt(1, 5);
            const stayLength = randInt(daysAgo + 1, daysAgo + 5); // still here
            const checkIn = addDays(today, -daysAgo);
            const checkOut = addDays(checkIn, stayLength);
            await createRes(room.id, guestId, checkIn, checkOut, 'checked_in', room.room_type);
            await client.query(`UPDATE rooms SET status = 'occupied' WHERE id = $1`, [room.id]);
        }

        // 2) ARRIVING TODAY (10 rooms — confirmed, check_in_date = today)
        const arrivingCount = 10;
        console.log(`  Creating ${arrivingCount} arriving-today reservations...`);
        for (let i = 0; i < arrivingCount && roomIdx < shuffled.length; i++, roomIdx++) {
            const room = shuffled[roomIdx];
            const guestId = await createGuest();
            const stayLength = randInt(1, 4);
            await createRes(room.id, guestId, today, addDays(today, stayLength), 'confirmed', room.room_type);
        }

        // 3) DEPARTING TODAY (10 rooms — checked_in, check_out_date = today)
        const departingCount = 10;
        console.log(`  Creating ${departingCount} departing-today reservations...`);
        for (let i = 0; i < departingCount && roomIdx < shuffled.length; i++, roomIdx++) {
            const room = shuffled[roomIdx];
            const guestId = await createGuest();
            const daysAgo = randInt(1, 3);
            const checkIn = addDays(today, -daysAgo);
            await createRes(room.id, guestId, checkIn, today, 'checked_in', room.room_type);
            await client.query(`UPDATE rooms SET status = 'occupied' WHERE id = $1`, [room.id]);
        }

        // 4) CHECKED OUT — Recent departures (15 reservations, rooms now vacant)
        const checkedOutCount = 15;
        console.log(`  Creating ${checkedOutCount} checked-out reservations...`);
        for (let i = 0; i < checkedOutCount && roomIdx < shuffled.length; i++, roomIdx++) {
            const room = shuffled[roomIdx];
            const guestId = await createGuest();
            const daysAgo = randInt(2, 7);
            const stayLength = randInt(1, 4);
            const checkIn = addDays(today, -(daysAgo + stayLength));
            const checkOut = addDays(today, -daysAgo);
            await createRes(room.id, guestId, checkIn, checkOut, 'checked_out', room.room_type);
            // Room already reset to vacant_clean — some should be dirty
            if (Math.random() > 0.6) {
                await client.query(`UPDATE rooms SET status = 'vacant_dirty' WHERE id = $1`, [room.id]);
            }
        }

        // 5) NO SHOWS (5 reservations)
        const noShowCount = 5;
        console.log(`  Creating ${noShowCount} no-show reservations...`);
        for (let i = 0; i < noShowCount && roomIdx < shuffled.length; i++, roomIdx++) {
            const room = shuffled[roomIdx];
            const guestId = await createGuest();
            const daysAgo = randInt(1, 5);
            const checkIn = addDays(today, -daysAgo);
            const checkOut = addDays(checkIn, randInt(1, 3));

            let conf;
            do { conf = genConfirmation(); } while (usedConfirmations.has(conf));
            usedConfirmations.add(conf);

            const rateCat = pick(rateCategories);
            const nightlyRate = rates[room.room_type]?.[rateCat] || 89;
            const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

            await client.query(`
                INSERT INTO reservations (
                    confirmation_number, room_id, guest_id,
                    check_in_date, check_out_date,
                    rate_category, nightly_rate, total_amount,
                    num_guests, status, notes, created_by
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'no_show','No show - guest did not arrive',1)
            `, [conf, room.id, guestId, fmt(checkIn), fmt(checkOut), rateCat, nightlyRate, nightlyRate * nights, randInt(1, 2)]);
            totalCreated++;
        }

        // 6) CANCELLED (5 reservations)
        const cancelledCount = 5;
        console.log(`  Creating ${cancelledCount} cancelled reservations...`);
        for (let i = 0; i < cancelledCount; i++) {
            const room = pick(shuffled);
            const guestId = await createGuest();
            const daysFromNow = randInt(1, 10);
            const checkIn = addDays(today, daysFromNow);
            const checkOut = addDays(checkIn, randInt(1, 3));

            let conf;
            do { conf = genConfirmation(); } while (usedConfirmations.has(conf));
            usedConfirmations.add(conf);

            const rateCat = pick(rateCategories);
            const nightlyRate = rates[room.room_type]?.[rateCat] || 89;
            const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

            await client.query(`
                INSERT INTO reservations (
                    confirmation_number, room_id, guest_id,
                    check_in_date, check_out_date,
                    rate_category, nightly_rate, total_amount,
                    num_guests, status, notes, created_by
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'cancelled',$10,1)
            `, [conf, room.id, guestId, fmt(checkIn), fmt(checkOut), rateCat, nightlyRate, nightlyRate * nights, randInt(1, 2), pick(['Guest requested cancellation', 'Change of plans', 'Found alternative accommodation'])]);
            totalCreated++;
        }

        // 7) FUTURE RESERVATIONS (25+ bookings arriving in 1-14 days)
        const futureCount = 25;
        console.log(`  Creating ${futureCount} future reservations...`);
        for (let i = 0; i < futureCount; i++) {
            const room = pick(shuffled);
            const guestId = await createGuest();
            const daysFromNow = randInt(1, 14);
            const checkIn = addDays(today, daysFromNow);
            const checkOut = addDays(checkIn, randInt(1, 5));

            let conf;
            do { conf = genConfirmation(); } while (usedConfirmations.has(conf));
            usedConfirmations.add(conf);

            const rateCat = pick(rateCategories);
            const nightlyRate = rates[room.room_type]?.[rateCat] || 89;
            const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

            await client.query(`
                INSERT INTO reservations (
                    confirmation_number, room_id, guest_id,
                    check_in_date, check_out_date,
                    rate_category, nightly_rate, total_amount,
                    num_guests, status, notes, created_by
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed','Upcoming reservation',1)
            `, [conf, room.id, guestId, fmt(checkIn), fmt(checkOut), rateCat, nightlyRate, nightlyRate * nights, randInt(1, 4)]);
            totalCreated++;
        }

        await client.query('COMMIT');

        // Summary
        const stats = await pool.query(`
            SELECT status, COUNT(*) as count FROM reservations GROUP BY status ORDER BY status
        `);
        const roomStats = await pool.query(`
            SELECT status, COUNT(*) as count FROM rooms GROUP BY status ORDER BY status
        `);

        console.log(`\n✅ Successfully created ${totalCreated} reservations!\n`);
        console.log('📊 Reservation breakdown:');
        stats.rows.forEach(r => console.log(`   ${r.status}: ${r.count}`));
        console.log('\n🏨 Room status breakdown:');
        roomStats.rows.forEach(r => console.log(`   ${r.status}: ${r.count}`));

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding:', e.message);
        console.error(e.stack);
    } finally {
        client.release();
        pool.end();
    }
}

reseed();
