const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Create Ticket
router.post('/create', authMiddleware, async (req, res) => {
    const { type, description } = req.body;
    const user_id = req.user.id;
    const id = uuidv4();

    try {
        await pool.query(
            'INSERT INTO tickets (id, user_id, type, description, status) VALUES (?, ?, ?, ?, ?)',
            [id, user_id, type, description, 'open']
        );
        res.status(201).json({ id, message: 'Ticket criado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
const { ADMIN_EMAILS } = require('../constants/admins');


// List Tickets (Admin)
router.get('/admin/list', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Ticket Status (Admin)
router.patch('/admin/:id', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { status } = req.body;

    try {
        await pool.query('UPDATE tickets SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: 'Ticket atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
