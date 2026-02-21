require('dotenv').config();
const db = require('./config/db');

async function getUser() {
    try {
        const res = await db.query("SELECT id, username, role FROM users WHERE username = 'owner'");
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

getUser();
