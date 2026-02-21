const { Pool } = require('pg');
require('dotenv').config();

console.log(`[DB] Connecting to ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'motelflow'} (SSL: ${process.env.DB_SSL === 'true'})`);

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'motelflow',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    // Many cloud providers (like GCP and Render) require SSL connections
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    // Timeouts to prevent hanging on Cloud Run
    connectionTimeoutMillis: 10000,  // 10 second connection timeout
    idleTimeoutMillis: 30000,        // close idle connections after 30s
    max: 10,                         // limit pool size
});

// Test database connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Database pool error (non-fatal):', err.message);
    // Do NOT crash the process — Cloud Run needs the server alive
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
