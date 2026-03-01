const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const { ADMIN_EMAILS } = require('../constants/admins');

// Get Profile
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const [profiles] = await pool.query('SELECT * FROM profiles WHERE id = ?', [req.user.id]);
        if (profiles.length === 0) {
            return res.status(404).json({ error: 'Perfil não encontrado' });
        }
        res.json(profiles[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile
router.patch('/me', authMiddleware, async (req, res) => {
    const { full_name, phone, whatsapp, cpf_cnpj } = req.body;

    try {
        await pool.query(
            'UPDATE profiles SET full_name = ?, phone = ?, whatsapp = ?, cpf_cnpj = ? WHERE id = ?',
            [full_name, phone, whatsapp, cpf_cnpj, req.user.id]
        );
        res.json({ message: 'Perfil atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: List Users (Profiles)
router.get('/admin/list', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
        const [profiles] = await pool.query(`
      SELECT p.*, u.email, u.created_at 
      FROM profiles p 
      JOIN users u ON p.id = u.id
    `);
        res.json(profiles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Consume Credits
router.post('/consume-credits', authMiddleware, async (req, res) => {
    const { amount } = req.body;
    try {
        const [profiles] = await pool.query('SELECT credits FROM profiles WHERE id = ?', [req.user.id]);
        if (profiles.length === 0 || profiles[0].credits < amount) {
            return res.status(403).json({ error: 'Créditos insuficientes' });
        }
        const newCredits = profiles[0].credits - amount;
        await pool.query('UPDATE profiles SET credits = ? WHERE id = ?', [newCredits, req.user.id]);
        res.json({ credits: newCredits });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update Specific User Credits
router.post('/admin/update-credits', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { userId, credits } = req.body;
    try {
        await pool.query('UPDATE profiles SET credits = ? WHERE id = ?', [credits, userId]);
        res.json({ message: 'Créditos atualizados com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get Specific User Profile
router.get('/admin/profile/:userId', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { userId } = req.params;
    try {
        const [profiles] = await pool.query('SELECT * FROM profiles WHERE id = ?', [userId]);
        if (profiles.length === 0) {
            return res.status(404).json({ error: 'Perfil não encontrado' });
        }
        res.json(profiles[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update Specific User Profile
router.patch('/admin/profile/:userId', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { userId } = req.params;
    const {
        full_name, phone, whatsapp, cpf_cnpj,
        plan, allowed_features,
        subscription_status, subscription_start, current_period_end, payment_method
    } = req.body;

    try {
        // Build dynamic query to avoid overwriting with undefined
        let query = 'UPDATE profiles SET ';
        const params = [];
        const fields = {
            full_name, phone, whatsapp, cpf_cnpj,
            plan, allowed_features: allowed_features ? JSON.stringify(allowed_features) : undefined,
            subscription_status, subscription_start, current_period_end, payment_method
        };

        Object.keys(fields).forEach((key, index) => {
            if (fields[key] !== undefined) {
                query += `${key} = ?, `;
                params.push(fields[key]);
            }
        });

        query = query.slice(0, -2); // Remove last comma
        query += ' WHERE id = ?';
        params.push(userId);

        if (params.length > 1) {
            await pool.query(query, params);
        }

        res.json({ message: 'Perfil atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Manual Renewal
router.post('/admin/manual-renewal', authMiddleware, async (req, res) => {
    const ADMIN_EMAILS = ['vignatecnologia@gmail.com', 'projeto.getmidia@gmail.com'];
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { userId } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [profiles] = await connection.query('SELECT plan, current_period_end FROM profiles WHERE id = ?', [userId]);
        if (profiles.length === 0) throw new Error('Perfil não encontrado');

        const profile = profiles[0];
        const plan = (profile.plan || 'testando').toLowerCase();

        const PLAN_LIMITS = {
            'testando': 50,
            'essencial': 80,
            'avancado': 120,
            'profissional': 200
        };
        const newCredits = PLAN_LIMITS[plan] || 50;

        const currentEnd = profile.current_period_end ? new Date(profile.current_period_end) : new Date();
        const newEnd = new Date(currentEnd.setMonth(currentEnd.getMonth() + 1));

        await connection.query(
            'UPDATE profiles SET credits = ?, current_period_end = ?, subscription_status = ? WHERE id = ?',
            [newCredits, newEnd, 'active', userId]
        );

        await connection.query(
            'INSERT INTO subscription_history (user_id, action, details) VALUES (?, ?, ?)',
            [userId, 'manual_renewal', `Renovação manual executada. Novos créditos: ${newCredits}`]
        );

        await connection.commit();
        res.json({ message: 'Renovação concluída', new_credits: newCredits, new_period_end: newEnd });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Admin: Get Subscription History
router.get('/admin/subscription-history/:userId', authMiddleware, async (req, res) => {
    const ADMIN_EMAILS = ['vignatecnologia@gmail.com', 'projeto.getmidia@gmail.com'];
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { userId } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT * FROM subscription_history WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
