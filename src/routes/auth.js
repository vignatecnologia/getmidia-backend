const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { generateToken } = require('../services/auth');

// Register
router.post('/register', async (req, res) => {
    const { email, password, full_name, phone, cpf_cnpj } = req.body;

    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Usuário já existe' });
        }

        const id = uuidv4();
        const password_hash = await bcrypt.hash(password, 10);

        // Transaction for User & Profile
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.query(
                'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
                [id, email, password_hash]
            );

            await connection.query(
                'INSERT INTO profiles (id, full_name, phone, cpf_cnpj) VALUES (?, ?, ?, ?)',
                [id, full_name, phone, cpf_cnpj]
            );

            await connection.commit();

            const token = generateToken({ id, email });
            res.status(201).json({ user: { id, email }, token });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await pool.query(`
            SELECT u.id, u.email, u.password_hash, p.full_name 
            FROM users u 
            LEFT JOIN profiles p ON u.id = p.id 
            WHERE u.email = ?
        `, [email]);

        if (users.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = generateToken(user);
        res.json({ user: { id: user.id, email: user.email, full_name: user.full_name }, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
