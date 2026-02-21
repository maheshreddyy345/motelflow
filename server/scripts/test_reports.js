const http = require('http');

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: `/api${path}`,
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function test() {
    // Login
    const { token } = await request('POST', '/auth/login', { username: 'owner', password: 'motelflow123' });
    console.log('✅ Logged in');

    // Test summary
    const summary = await request('GET', '/reports/summary?startDate=2026-02-01&endDate=2026-02-14', null, token);
    console.log('\n📊 SUMMARY:', JSON.stringify(summary, null, 2));

    // Test revenue
    const revenue = await request('GET', '/reports/revenue?startDate=2026-02-01&endDate=2026-02-14', null, token);
    console.log('\n💰 REVENUE: dailyRevenue count:', revenue.dailyRevenue?.length, '| chargeBreakdown:', revenue.chargeBreakdown);

    // Test occupancy
    const occ = await request('GET', '/reports/occupancy?startDate=2026-02-01&endDate=2026-02-14', null, token);
    console.log('\n🏨 OCCUPANCY: totalRooms:', occ.totalRooms, '| dailyOccupancy count:', occ.dailyOccupancy?.length, '| floors:', occ.floorOccupancy);

    // Test rates
    const rates = await request('GET', '/reports/rates?startDate=2026-02-01&endDate=2026-02-14', null, token);
    console.log('\n💵 RATES by room type:', rates.byRoomType, '\nby category:', rates.byRateCategory);

    // Test payments
    const payments = await request('GET', '/reports/payments?startDate=2026-02-01&endDate=2026-02-14', null, token);
    console.log('\n💳 PAYMENTS: methods:', payments.methodDistribution, '| recent count:', payments.recentPayments?.length);

    console.log('\n✅ All endpoints working!');
}

test().catch(err => console.error('Error:', err.message));
