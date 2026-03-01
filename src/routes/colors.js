const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Get all module configs
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM module_config ORDER BY module_mode');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching module configs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upsert module configs (Admin only check should be here)
router.post('/upsert', authMiddleware, async (req, res) => {
    const configs = req.body; // Array of { module_mode, primary_color, label }

    if (!Array.isArray(configs)) {
        return res.status(400).json({ error: 'Body must be an array of configs' });
    }

    try {
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            for (const config of configs) {
                await connection.query(
                    'INSERT INTO module_config (module_mode, primary_color, label) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE primary_color = VALUES(primary_color), label = VALUES(label)',
                    [config.module_mode, config.primary_color, config.label]
                );
            }
            await connection.commit();
            res.json({ message: 'Configs updated successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error upserting module configs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
