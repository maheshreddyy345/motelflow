const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// GET /api/settings - Get all settings
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM settings ORDER BY setting_key');

        // Convert to object for easier access
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        res.json(settings);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/settings/:key - Get single setting
router.get('/:key', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM settings WHERE setting_key = $1',
            [req.params.key]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get setting error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/settings/:key - Update setting (owner/manager only)
router.put('/:key', auth, authorize('owner', 'manager'), async (req, res) => {
    try {
        const { value } = req.body;

        const result = await db.query(`
            UPDATE settings 
            SET setting_value = $1, updated_at = NOW()
            WHERE setting_key = $2
            RETURNING *
        `, [value, req.params.key]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/settings - Create new setting (owner only)
router.post('/', auth, authorize('owner'), async (req, res) => {
    try {
        const { key, value, description } = req.body;

        const result = await db.query(`
            INSERT INTO settings (setting_key, setting_value, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2
            RETURNING *
        `, [key, value, description]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create setting error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
