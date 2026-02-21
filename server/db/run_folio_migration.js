// Run folio tables migration
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'folio_tables.sql'), 'utf8');
        await db.query(sql);
        console.log('✅ Folio tables created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
