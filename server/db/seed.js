// Seed script to populate sample data
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });
const db = require('../config/db');

const seedData = async () => {
    console.log('🌱 Starting database seed...');

    try {
        // Create sample guests
        const guests = [
            { firstName: 'John', lastName: 'Smith', phone: '832-555-0101', email: 'jsmith@email.com', idNumber: 'TX1234567', vehicleMake: 'Toyota', vehicleModel: 'Camry', vehicleColor: 'Silver', vehiclePlate: 'ABC123', vehicleState: 'TX' },
            { firstName: 'Maria', lastName: 'Garcia', phone: '713-555-0102', email: 'mgarcia@email.com', idNumber: 'TX2345678', vehicleMake: 'Honda', vehicleModel: 'Accord', vehicleColor: 'White', vehiclePlate: 'DEF456', vehicleState: 'TX' },
            { firstName: 'Robert', lastName: 'Johnson', phone: '281-555-0103', email: 'rjohnson@email.com', idNumber: 'LA3456789', vehicleMake: 'Ford', vehicleModel: 'F-150', vehicleColor: 'Black', vehiclePlate: 'GHI789', vehicleState: 'LA' },
            { firstName: 'Lisa', lastName: 'Williams', phone: '832-555-0104', email: 'lwilliams@email.com', idNumber: 'TX4567890', vehicleMake: 'Chevrolet', vehicleModel: 'Malibu', vehicleColor: 'Red', vehiclePlate: 'JKL012', vehicleState: 'TX' },
            { firstName: 'Michael', lastName: 'Brown', phone: '713-555-0105', email: 'mbrown@email.com', idNumber: 'OK5678901', vehicleMake: 'Nissan', vehicleModel: 'Altima', vehicleColor: 'Blue', vehiclePlate: 'MNO345', vehicleState: 'OK' },
            { firstName: 'Jennifer', lastName: 'Davis', phone: '281-555-0106', email: 'jdavis@email.com', idNumber: 'TX6789012', vehicleMake: 'Hyundai', vehicleModel: 'Sonata', vehicleColor: 'Gray', vehiclePlate: 'PQR678', vehicleState: 'TX' },
            { firstName: 'David', lastName: 'Miller', phone: '832-555-0107', email: 'dmiller@email.com', idNumber: 'AR7890123', vehicleMake: 'Kia', vehicleModel: 'Optima', vehicleColor: 'White', vehiclePlate: 'STU901', vehicleState: 'AR' },
            { firstName: 'Sarah', lastName: 'Wilson', phone: '713-555-0108', email: 'swilson@email.com', idNumber: 'TX8901234', vehicleMake: 'BMW', vehicleModel: '3 Series', vehicleColor: 'Black', vehiclePlate: 'VWX234', vehicleState: 'TX' },
            { firstName: 'James', lastName: 'Taylor', phone: '281-555-0109', email: 'jtaylor@email.com', idNumber: 'NM9012345', vehicleMake: 'Mercedes', vehicleModel: 'C-Class', vehicleColor: 'Silver', vehiclePlate: 'YZA567', vehicleState: 'NM' },
            { firstName: 'Emily', lastName: 'Anderson', phone: '832-555-0110', email: 'eanderson@email.com', idNumber: 'TX0123456', vehicleMake: 'Audi', vehicleModel: 'A4', vehicleColor: 'Blue', vehiclePlate: 'BCD890', vehicleState: 'TX' },
            { firstName: 'William', lastName: 'Thomas', phone: '713-555-0111', email: 'wthomas@email.com', idNumber: 'TX1111111', vehicleMake: 'Lexus', vehicleModel: 'ES', vehicleColor: 'Pearl', vehiclePlate: 'EFG123', vehicleState: 'TX' },
            { firstName: 'Ashley', lastName: 'Jackson', phone: '281-555-0112', email: 'ajackson@email.com', idNumber: 'CO2222222', vehicleMake: 'Subaru', vehicleModel: 'Outback', vehicleColor: 'Green', vehiclePlate: 'HIJ456', vehicleState: 'CO' },
        ];

        const guestIds = [];
        for (const guest of guests) {
            const result = await db.query(`
                INSERT INTO guests (first_name, last_name, phone, email, id_number, id_type, vehicle_make, vehicle_model, vehicle_color, vehicle_plate, vehicle_state)
                VALUES ($1, $2, $3, $4, $5, 'license', $6, $7, $8, $9, $10)
                RETURNING id
            `, [guest.firstName, guest.lastName, guest.phone, guest.email, guest.idNumber, guest.vehicleMake, guest.vehicleModel, guest.vehicleColor, guest.vehiclePlate, guest.vehicleState]);
            guestIds.push(result.rows[0].id);
        }
        console.log(`✅ Created ${guests.length} guests`);

        // Get room IDs
        const roomsResult = await db.query('SELECT id, room_number, room_type FROM rooms ORDER BY room_number LIMIT 30');
        const rooms = roomsResult.rows;

        // Helper to generate confirmation number
        const genConfNum = () => 'MF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

        // Today's date
        const today = new Date();
        const formatDate = (d) => d.toISOString().split('T')[0];

        // Create reservations
        const reservations = [];

        // 3 checked-in guests (currently staying)
        for (let i = 0; i < 3; i++) {
            const checkIn = new Date(today);
            checkIn.setDate(checkIn.getDate() - Math.floor(Math.random() * 3)); // Checked in 0-2 days ago
            const checkOut = new Date(checkIn);
            checkOut.setDate(checkOut.getDate() + Math.floor(Math.random() * 3) + 2); // Staying 2-4 nights

            reservations.push({
                guestId: guestIds[i],
                roomId: rooms[i].id,
                checkIn: formatDate(checkIn),
                checkOut: formatDate(checkOut),
                status: 'checked_in',
                nightlyRate: 89.00,
                actualCheckIn: checkIn.toISOString(),
            });
        }

        // 4 confirmed arrivals for today
        for (let i = 3; i < 7; i++) {
            const checkIn = formatDate(today);
            const checkOut = new Date(today);
            checkOut.setDate(checkOut.getDate() + Math.floor(Math.random() * 2) + 1);

            reservations.push({
                guestId: guestIds[i],
                roomId: rooms[i].id,
                checkIn: checkIn,
                checkOut: formatDate(checkOut),
                status: 'confirmed',
                nightlyRate: 99.00,
            });
        }

        // 3 future reservations
        for (let i = 7; i < 10; i++) {
            const checkIn = new Date(today);
            checkIn.setDate(checkIn.getDate() + i - 5); // 2-4 days from now
            const checkOut = new Date(checkIn);
            checkOut.setDate(checkOut.getDate() + 2);

            reservations.push({
                guestId: guestIds[i],
                roomId: rooms[i + 5].id,
                checkIn: formatDate(checkIn),
                checkOut: formatDate(checkOut),
                status: 'confirmed',
                nightlyRate: 79.00,
            });
        }

        // 2 departures today (checked-in that need to check out)
        for (let i = 10; i < 12; i++) {
            const checkIn = new Date(today);
            checkIn.setDate(checkIn.getDate() - 2);

            reservations.push({
                guestId: guestIds[i],
                roomId: rooms[i + 3].id,
                checkIn: formatDate(checkIn),
                checkOut: formatDate(today),
                status: 'checked_in',
                nightlyRate: 89.00,
                actualCheckIn: checkIn.toISOString(),
            });
        }

        // Insert reservations
        for (const res of reservations) {
            await db.query(`
                INSERT INTO reservations (
                    confirmation_number, room_id, guest_id, check_in_date, check_out_date, 
                    actual_check_in, nightly_rate, status, rate_category, payment_status, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'regular', 'pending', 1)
            `, [
                genConfNum(),
                res.roomId,
                res.guestId,
                res.checkIn,
                res.checkOut,
                res.actualCheckIn || null,
                res.nightlyRate,
                res.status
            ]);

            // Update room status for checked-in guests
            if (res.status === 'checked_in') {
                await db.query('UPDATE rooms SET status = $1 WHERE id = $2', ['occupied', res.roomId]);
            }
        }
        console.log(`✅ Created ${reservations.length} reservations`);

        // Mark a couple rooms as dirty
        await db.query("UPDATE rooms SET status = 'vacant_dirty' WHERE room_number IN ('105', '106', '201', '202')");
        console.log('✅ Set some rooms as vacant_dirty');

        // Mark one room as out of order
        await db.query("UPDATE rooms SET status = 'out_of_order', is_out_of_order = true, out_of_order_reason = 'AC repair needed', out_of_order_since = NOW() WHERE room_number = '110'");
        console.log('✅ Set room 110 as out of order');

        console.log('\n🎉 Seed completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    }
};

seedData();
