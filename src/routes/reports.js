const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { ADMIN_EMAILS } = require('../constants/admins');


// List Reported Images (Admin)
router.get('/admin/list', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { status } = req.query; // optional: 'pending', 'resolved', 'dismissed'

    try {
        let query = supabase.from('reported_images').select('*');
        if (status) {
            query = query.eq('status', status);
        }
        const { data: rows, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Report Status (Admin)
router.patch('/admin/:id', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { status } = req.body;

    try {
        const { error } = await supabase
            .from('reported_images')
            .update({ status })
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Denúncia atualizada com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Refund Report (Give credits back)
router.post('/admin/:id/refund', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;

    try {
        // 1. Get report details
        const { data: report, error: getError } = await supabase
            .from('reported_images')
            .select('*')
            .eq('id', id)
            .single();

        if (getError || !report) throw new Error('Denúncia não encontrada');
        if (report.status === 'refunded') throw new Error('Já reembolsado');

        // 2. Get user profile for current credits
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', report.user_id)
            .single();

        if (profileError) throw profileError;

        // 3. Give credits back and Update report status
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ credits: (profile.credits || 0) + (report.cost || 1) })
            .eq('id', report.user_id);

        if (updateError) throw updateError;

        const { error: reportUpdateError } = await supabase
            .from('reported_images')
            .update({ status: 'refunded' })
            .eq('id', id);

        if (reportUpdateError) throw reportUpdateError;

        res.json({ message: 'Reembolso concluído com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Reject Report
router.post('/admin/:id/reject', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('reported_images')
            .update({ status: 'rejected' })
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Denúncia rejeitada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete Report and Image
router.delete('/admin/:id', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const fs = require('fs');
    const path = require('path');

    try {
        // Get path first
        const { data: report, error: getError } = await supabase
            .from('reported_images')
            .select('image_path, user_id')
            .eq('id', id)
            .single();

        if (!getError && report) {
            if (report.image_path) {
                const fullPath = path.join(__dirname, '..', '..', 'uploads', report.user_id, 'reported-images', report.image_path);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }
        }

        const { error: deleteError } = await supabase
            .from('reported_images')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;
        res.json({ message: 'Denúncia excluída' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Count Pending
router.get('/admin/count-pending', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
        const { count, error } = await supabase
            .from('reported_images')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (error) throw error;
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
