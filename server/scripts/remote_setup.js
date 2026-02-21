const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_HOST = '34.55.219.74';
const DB_USER = 'postgres';
const DB_PASSWORD = 'Mahesh897@';

async function run() {
    // 1. Connect to default 'postgres' database to create 'motelflow'
    const client = new Client({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: 'postgres',
        port: 5432,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log(`Connecting to ${DB_HOST}...`);
        await client.connect();

        // Try creating database
        try {
            await client.query('CREATE DATABASE motelflow');
            console.log('✅ Created database "motelflow"');
        } catch (e) {
            if (e.code === '42P04') { // duplicate_database
                console.log('ℹ️  Database "motelflow" already exists');
            } else {
                throw e;
            }
        }
        await client.end();

        // 2. Connect to the new 'motelflow' database and run schemas
        const mfClient = new Client({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: 'motelflow',
            port: 5432,
            ssl: { rejectUnauthorized: false }
        });

        await mfClient.connect();
        console.log('✅ Connected to "motelflow" database');

        const schemas = [
            'schema.sql',
            'folio_tables.sql',
            'night_audit_migration.sql'
        ];

        for (const file of schemas) {
            console.log(`Executing ${file}...`);
            const sql = fs.readFileSync(path.join(__dirname, '../db', file), 'utf8');
            await mfClient.query(sql);
            console.log(`✅ Success: ${file}`);
        }

        await mfClient.end();
        console.log('🎉 ALL GCP CLOUD SQL SETUP COMPLETE!');

    } catch (e) {
        console.error('❌ Error during setup:', e);
    }
}

run();
