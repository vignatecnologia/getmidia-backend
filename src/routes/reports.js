const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { ADMIN_EMAILS } = require('../constants/admins');


// List Reported Images (Admin)
router.get('/admin/list', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { status } = req.query; // optional: 'pending', 'resolved', 'dismissed'

    try {
        let query = 'SELECT * FROM reported_images';
        const params = [];
        if (status) {
            query += ' WHERE status = ?';
            params.push(status);
        }
        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.query(query, params);
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
        await pool.query('UPDATE reported_images SET status = ? WHERE id = ?', [status, id]);
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
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Get report details
        const [reports] = await connection.query('SELECT * FROM reported_images WHERE id = ?', [id]);
        if (reports.length === 0) throw new Error('Denúncia não encontrada');
        const report = reports[0];

        if (report.status === 'refunded') throw new Error('Já reembolsado');

        // 2. Give credits back
        await connection.query('UPDATE profiles SET credits = credits + ? WHERE id = ?', [report.cost || 1, report.user_id]);

        // 3. Update report status
        await connection.query('UPDATE reported_images SET status = "refunded" WHERE id = ?', [id]);

        await connection.commit();
        res.json({ message: 'Reembolso concluído com sucesso' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Admin: Reject Report
router.post('/admin/:id/reject', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    try {
        await pool.query('UPDATE reported_images SET status = "rejected" WHERE id = ?', [id]);
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
        const [reports] = await pool.query('SELECT image_path, user_id FROM reported_images WHERE id = ?', [id]);
        if (reports.length > 0) {
            const report = reports[0];
            if (report.image_path) {
                const fullPath = path.join(__dirname, '..', '..', 'uploads', report.user_id, 'reported-images', report.image_path);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }
        }

        await pool.query('DELETE FROM reported_images WHERE id = ?', [id]);
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
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM reported_images WHERE status = "pending"');
        res.json({ count: rows[0].count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
