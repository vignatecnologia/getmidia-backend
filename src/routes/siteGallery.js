const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
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
        const { data: rows, error } = await supabase
            .from('site_gallery_images')
            .select('*')
            .eq('page_slug', pageSlug)
            .order('display_order', { ascending: true });

        if (error) throw error;
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
        const { error } = await supabase
            .from('site_gallery_images')
            .insert([
                { page_slug: pageSlug, image_url: imageUrl, title, description }
            ]);

        if (error) throw error;
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
        const { error } = await supabase
            .from('site_gallery_images')
            .update({ title, description })
            .eq('id', id);

        if (error) throw error;
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

    try {
        const { error } = await supabase
            .from('site_gallery_images')
            .upsert(updates, { onConflict: 'id' });

        if (error) throw error;
        res.json({ message: 'Ordem atualizada com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete from Site Gallery
router.delete('/:id', authMiddleware, async (req, res) => {
    if (!ADMIN_EMAILS.includes(req.user.email)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    try {
        const { data: rows, error: getError } = await supabase
            .from('site_gallery_images')
            .select('image_url')
            .eq('id', id);

        if (!getError && rows.length > 0) {
            const relativePath = rows[0].image_url;
            const filePath = path.join(__dirname, '..', '..', relativePath.replace(/^\//, ''));
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        const { error: deleteError } = await supabase
            .from('site_gallery_images')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;
        res.json({ message: 'Imagem excluída com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
