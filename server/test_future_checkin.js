const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'motelflow_secret_key_change_in_production_12345';

// Mock user for token
const user = {
    id: 1,
    username: 'owner',
    role: 'owner'
};

const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
console.log('Generated token for user:', user.username);

// Helper to create a future reservation
const createFutureReservation = (token) => new Promise((resolve, reject) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5); // 5 days in future
    const checkOut = new Date(futureDate);
    checkOut.setDate(checkOut.getDate() + 1);

    const data = JSON.stringify({
        checkInDate: futureDate.toISOString().split('T')[0],
        checkOutDate: checkOut.toISOString().split('T')[0],
        guest: {
            firstName: 'Future',
            lastName: 'Tester',
            phone: '555-0000',
            email: 'test@example.com'
        },
        roomType: 'single',
        rateCategory: 'regular',
        nightlyRate: 100,
        numGuests: 1
    });

    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/reservations',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Content-Length': data.length
        }
    };

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                console.log('Failed to parse response:', body);
                reject(e);
            }
        });
    });
    req.write(data);
    req.end();
});

// Attempt check-in
const attemptCheckIn = (token, id) => new Promise((resolve, reject) => {
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: `/api/reservations/${id}/checkin`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.end();
});

async function test() {
    try {
        console.log('Creating future reservation...');
        const reservation = await createFutureReservation(token);

        if (!reservation.reservation || !reservation.reservation.id) {
            console.error('Failed to create reservation:', reservation);
            return;
        }
        const resId = reservation.reservation.id;
        console.log('Created reservation:', resId, 'for', reservation.reservation.check_in_date);

        console.log('Attempting check-in (should fail)...');
        const result = await attemptCheckIn(token, resId);

        console.log('Status:', result.status);
        console.log('Response:', result.body);

        if (result.status === 400 && result.body.error && result.body.error.includes('Cannot check in before')) {
            console.log('✅ TEST PASSED: Future check-in blocked correctly.');
        } else {
            console.log('❌ TEST FAILED: Check-in was not blocked as expected.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
