require('dotenv').config();
const db = require('./config/db');

async function test() {
    try {
        // Check columns
        const cols = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'reservations'
        `);
        console.log('Columns:', cols.rows.map(x => x.column_name).join(', '));

        // Check cancelled reservations with reason
        const cancelled = await db.query(`
            SELECT id, confirmation_number, status, cancellation_reason, updated_at 
            FROM reservations 
            WHERE status = 'cancelled' 
            ORDER BY updated_at DESC 
            LIMIT 5
        `);
        console.log('\nCancelled reservations:');
        cancelled.rows.forEach(r => {
            console.log(`  ${r.confirmation_number}: reason=${r.cancellation_reason}, status=${r.status}`);
        });
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit(0);
    }
}

test();
