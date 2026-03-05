const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
const authRoutes = require('./src/routes/auth');
const profileRoutes = require('./src/routes/profile');
const ticketRoutes = require('./src/routes/tickets');
const aiRoutes = require('./src/routes/ai');
const paymentRoutes = require('./src/routes/payment');
const colorRoutes = require('./src/routes/colors');
const siteGalleryRoutes = require('./src/routes/siteGallery');
const storageRoutes = require('./src/routes/storage');
const reportRoutes = require('./src/routes/reports');

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/colors', colorRoutes);
app.use('/api/site-gallery', siteGalleryRoutes);
app.use('/api/reports', reportRoutes);

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
const pool = require('./src/config/db');
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            status: 'ok',
            message: 'GetMídia API is running',
            database: 'connected',
            env: {
                DB_HOST_CONFIG: process.env.DB_HOST || 'Missing',
                ACTUAL_HOST_USED: process.env.DB_HOST === 'srv1659.hstgr.io' || process.env.DB_HOST === 'localhost' ? '127.0.0.1' : (process.env.DB_HOST || 'None'),
                JWT_SECRET: process.env.JWT_SECRET ? 'Configured' : 'Missing'
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'GetMídia API is running but database connection failed',
            error: err.message,
            debug: {
                DB_HOST_CONFIG: process.env.DB_HOST || 'Missing',
                ACTUAL_HOST_USED: process.env.DB_HOST === 'srv1659.hstgr.io' || process.env.DB_HOST === 'localhost' ? '127.0.0.1' : (process.env.DB_HOST || 'None')
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
