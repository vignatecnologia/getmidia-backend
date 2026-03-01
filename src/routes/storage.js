const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');

const { ADMIN_EMAILS } = require('../constants/admins');

// Helper to get target userId
const getTargetUserId = (req) => {
    if (ADMIN_EMAILS.includes(req.user.email) && (req.query.userId || req.body.userId)) {
        return req.query.userId || req.body.userId;
    }
    return req.user.id;
};

// Setup Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = req.params.type; // 'logos' or 'store-images'
        const userId = getTargetUserId(req);
        const dir = path.join(__dirname, '..', '..', 'uploads', type, userId);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // For logos, we usually want to overwrite or have a consistent name
        if (req.params.type === 'logos') {
            cb(null, 'logo.png');
        } else {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    }
});

const upload = multer({ storage });

// Upload File
router.post('/upload/:type', authMiddleware, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const type = req.params.type;
    const userId = getTargetUserId(req);
    const fileName = req.file.filename;
    const url = `/uploads/${type}/${userId}/${fileName}`;

    res.json({ url, name: fileName });
});

// List Files (for store-images)
router.get('/list/:type', authMiddleware, (req, res) => {
    const type = req.params.type;
    const userId = getTargetUserId(req);
    const dir = path.join(__dirname, '..', '..', 'uploads', type, userId);

    if (!fs.existsSync(dir)) {
        return res.json([]);
    }

    const files = fs.readdirSync(dir).map(file => {
        const stats = fs.statSync(path.join(dir, file));
        return {
            name: file,
            url: `/uploads/${type}/${userId}/${file}`,
            createdAt: stats.birthtime
        };
    });

    res.json(files);
});

// Delete File
router.delete('/:type/:filename', authMiddleware, (req, res) => {
    const { type, filename } = req.params;
    const userId = getTargetUserId(req);
    const filePath = path.join(__dirname, '..', '..', 'uploads', type, userId, filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ message: 'Arquivo excluído' });
    } else {
        res.status(404).json({ error: 'Arquivo não encontrado' });
    }
});

module.exports = router;
