// Test script to make a cancel request
const http = require('http');

// First, let's login to get a token
const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });

const loginOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

const login = () => new Promise((resolve, reject) => {
    const req = http.request(loginOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                reject(e);
            }
        });
    });
    req.on('error', reject);
    req.write(loginData);
    req.end();
});

const cancelReservation = (token, id, reason) => new Promise((resolve, reject) => {
    const cancelData = JSON.stringify({ reason });
    console.log('Sending cancel body:', cancelData);

    const options = {
        hostname: 'localhost',
        port: 5000,
        path: `/api/reservations/${id}`,
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Content-Length': cancelData.length
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('Response status:', res.statusCode);
            console.log('Response body:', data);
            resolve(data);
        });
    });
    req.on('error', reject);
    req.write(cancelData);
    req.end();
});

async function test() {
    try {
        console.log('Logging in...');
        const { token } = await login();
        console.log('Token:', token ? 'obtained' : 'missing');

        // Get a confirmed reservation ID first
        require('dotenv').config();
        const db = require('./config/db');
        const confirmed = await db.query(
            "SELECT id, confirmation_number FROM reservations WHERE status = 'confirmed' LIMIT 1"
        );

        if (confirmed.rows.length === 0) {
            console.log('No confirmed reservations to cancel');
            process.exit(0);
        }

        const res = confirmed.rows[0];
        console.log(`\nCancelling reservation ${res.confirmation_number} (ID: ${res.id}) with reason "cc_declined"...`);

        await cancelReservation(token, res.id, 'cc_declined');

        // Check if it was saved
        const check = await db.query(
            'SELECT id, confirmation_number, status, cancellation_reason FROM reservations WHERE id = $1',
            [res.id]
        );
        console.log('\nAfter cancel:');
        console.log(check.rows[0]);

    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

test();
