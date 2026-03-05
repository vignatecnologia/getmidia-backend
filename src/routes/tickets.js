const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

// Create Ticket
router.post('/', authMiddleware, async (req, res) => {
    const { type, description } = req.body;
    try {
        const { data: ticket, error } = await supabase
            .from('tickets')
            .insert([
                { user_id: req.user.id, type, description }
            ])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(ticket);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get My Tickets
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: List All Tickets
router.get('/admin/list', authMiddleware, async (req, res) => {
    const ADMIN_EMAILS = ['vignatecnologia@gmail.com', 'projeto.getmidia@gmail.com'];
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('*, profiles(full_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Ticket Status (Admin)
router.patch('/admin/:id', authMiddleware, async (req, res) => {
    const ADMIN_EMAILS = ['vignatecnologia@gmail.com', 'projeto.getmidia@gmail.com'];
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { status } = req.body;

    try {
        const { data, error } = await supabase
            .from('tickets')
            .update({ status })
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Ticket atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
