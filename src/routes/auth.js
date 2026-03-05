const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

// Register
router.post('/register', async (req, res) => {
    const { email, password, full_name, phone, cpf_cnpj } = req.body;

    try {
        // 1. Sign up user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });

        if (authError) throw authError;

        const user = authData.user;
        if (!user) throw new Error('Falha ao criar usuário');

        // 2. Create profile in public.profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([
                { id: user.id, full_name, phone, cpf_cnpj }
            ]);

        if (profileError) throw profileError;

        const token = generateToken(user);
        res.status(201).json({ user: { id: user.id, email: user.email }, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) throw authError;

        const user = authData.user;

        // 2. Get profile for full_name
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

        const token = generateToken(user);
        res.json({
            user: {
                id: user.id,
                email: user.email,
                full_name: profile ? profile.full_name : null
            },
            token
        });
    } catch (err) {
        res.status(401).json({ error: 'Credenciais inválidas ou erro no servidor' });
    }
});

const authMiddleware = require('../middleware/auth');
const { ADMIN_EMAILS } = require('../constants/admins');

// Admin: Update User Password
router.post('/admin/update-user', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { user_id, password } = req.body;
    try {
        const password_hash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, user_id]);
        res.json({ message: 'Senha atualizada com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete User
router.post('/admin/delete-user', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { user_id } = req.body;
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [user_id]);
        res.json({ message: 'Usuário excluído com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
