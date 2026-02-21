const { pool } = require('../config/db');

async function fix() {
    try {
        console.log('Fixing rate_category...');
        await pool.query("UPDATE reservations SET rate_category = 'aaa' WHERE notes LIKE '%AAA%'");
        await pool.query("UPDATE reservations SET rate_category = 'weekly' WHERE notes LIKE '%Weekly%'");
        await pool.query("UPDATE reservations SET rate_category = 'regular' WHERE rate_category IS NULL");

        const r = await pool.query('SELECT rate_category, COUNT(*) FROM reservations GROUP BY rate_category');
        console.log('Rate category distribution:');
        r.rows.forEach(row => console.log(`  ${row.rate_category}: ${row.count}`));

        // Also verify status distribution
        const s = await pool.query('SELECT status, COUNT(*) FROM reservations GROUP BY status');
        console.log('Status distribution:');
        s.rows.forEach(row => console.log(`  ${row.status}: ${row.count}`));

        // Verify today's data
        const today = new Date().toISOString().split('T')[0];
        const arrivals = await pool.query("SELECT COUNT(*) FROM reservations WHERE check_in_date::date = $1::date AND status IN ('confirmed', 'checked_in')", [today]);
        const departures = await pool.query("SELECT COUNT(*) FROM reservations WHERE check_out_date::date = $1::date AND status = 'checked_in'", [today]);
        const inHouse = await pool.query("SELECT COUNT(*) FROM reservations WHERE status = 'checked_in'");

        console.log(`\nToday (${today}):`);
        console.log(`  Arrivals: ${arrivals.rows[0].count}`);
        console.log(`  Departures: ${departures.rows[0].count}`);
        console.log(`  In-House: ${inHouse.rows[0].count}`);

        console.log('\n✅ Fix complete!');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        pool.end();
    }
}

fix();
