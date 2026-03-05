const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

// Get all module configs
router.get('/', async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('module_config')
            .select('*')
            .order('module_mode');

        if (error) throw error;
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
        const { error } = await supabase
            .from('module_config')
            .upsert(configs, { onConflict: 'module_mode' });

        if (error) throw error;
        res.json({ message: 'Configs updated successfully' });
    } catch (error) {
        console.error('Error upserting module configs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
