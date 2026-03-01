const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { ADMIN_EMAILS } = require('../constants/admins');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// Multer Storage for Site Gallery
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // pageSlug might be in body if sent via FormData
        const pageSlug = req.body.pageSlug || 'default';
        const dir = path.join(__dirname, '..', '..', 'uploads', 'site-gallery', pageSlug);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// List Site Gallery Images
router.get('/:pageSlug', async (req, res) => {
    const { pageSlug } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT * FROM site_gallery_images WHERE page_slug = ? ORDER BY display_order ASC, created_at DESC',
            [pageSlug]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Upload to Site Gallery
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { pageSlug, title, description } = req.body;
    const fileName = req.file.filename;
    const imageUrl = `/uploads/site-gallery/${pageSlug}/${fileName}`;

    try {
        await pool.query(
            'INSERT INTO site_gallery_images (page_slug, image_url, title, description) VALUES (?, ?, ?, ?)',
            [pageSlug, imageUrl, title, description]
        );
        res.json({ message: 'Imagem adicionada com sucesso', imageUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update Site Gallery Item (Metadata)
router.patch('/:id', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { title, description } = req.body;

    try {
        await pool.query(
            'UPDATE site_gallery_images SET title = ?, description = ? WHERE id = ?',
            [title, description, id]
        );
        res.json({ message: 'Imagem atualizada com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Bulk Update Order
router.post('/update-order', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { updates } = req.body; // Array of { id, display_order }
    if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ error: 'Dados inválidos' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const u of updates) {
            await connection.query(
                'UPDATE site_gallery_images SET display_order = ? WHERE id = ?',
                [u.display_order, u.id]
            );
        }
        await connection.commit();
        res.json({ message: 'Ordem atualizada com sucesso' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Admin: Delete from Site Gallery
router.delete('/:id', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT image_url FROM site_gallery_images WHERE id = ?', [id]);
        if (rows.length > 0) {
            // image_url is like /uploads/site-gallery/...
            // We need to map this to the actual filesystem path
            const relativePath = rows[0].image_url;
            const filePath = path.join(__dirname, '..', '..', relativePath.replace(/^\//, ''));
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await pool.query('DELETE FROM site_gallery_images WHERE id = ?', [id]);
        res.json({ message: 'Imagem excluída com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
