const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const { ADMIN_EMAILS } = require('../constants/admins');

// Get Profile
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (error || !profile) {
            return res.status(404).json({ error: 'Perfil não encontrado' });
        }
        res.json(profile);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile
router.patch('/me', authMiddleware, async (req, res) => {
    const { full_name, phone, whatsapp, cpf_cnpj } = req.body;

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ full_name, phone, whatsapp, cpf_cnpj })
            .eq('id', req.user.id);

        if (error) throw error;
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
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*');

        if (error) throw error;
        res.json(profiles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Consume Credits
router.post('/consume-credits', authMiddleware, async (req, res) => {
    const { amount } = req.body;
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', req.user.id)
            .single();

        if (error || !profile || profile.credits < amount) {
            return res.status(403).json({ error: 'Créditos insuficientes' });
        }

        const newCredits = profile.credits - amount;
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ credits: newCredits })
            .eq('id', req.user.id);

        if (updateError) throw updateError;
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
        const { error } = await supabase
            .from('profiles')
            .update({ credits })
            .eq('id', userId);

        if (error) throw error;
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
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            return res.status(404).json({ error: 'Perfil não encontrado' });
        }
        res.json(profile);
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
    const updateData = req.body;

    try {
        if (updateData.allowed_features) {
            updateData.allowed_features = JSON.stringify(updateData.allowed_features);
        }

        const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (error) throw error;
        res.json({ message: 'Perfil atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Manual Renewal
router.post('/admin/manual-renewal', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { userId } = req.body;

    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('plan, current_period_end')
            .eq('id', userId)
            .single();

        if (error || !profile) throw new Error('Perfil não encontrado');

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

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                credits: newCredits,
                current_period_end: newEnd.toISOString(),
                subscription_status: 'active'
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        await supabase
            .from('subscription_history')
            .insert([
                { user_id: userId, action: 'manual_renewal', details: `Renovação manual executada. Novos créditos: ${newCredits}` }
            ]);

        res.json({ message: 'Renovação concluída', new_credits: newCredits, new_period_end: newEnd });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get Subscription History
router.get('/admin/subscription-history/:userId', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { userId } = req.params;
    try {
        const { data: history, error } = await supabase
            .from('subscription_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
