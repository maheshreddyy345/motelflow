const { pool } = require('../config/db');

async function addInternalNotes() {
    try {
        console.log('Adding internal_notes column to reservations table...');
        await pool.query(`
            ALTER TABLE reservations 
            ADD COLUMN IF NOT EXISTS internal_notes TEXT;
        `);
        console.log('✅ Column internal_notes added successfully');
    } catch (error) {
        console.error('❌ Error adding column:', error);
    } finally {
        await pool.end();
    }
}

addInternalNotes();
