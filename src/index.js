const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const ticketRoutes = require('./routes/tickets');
const aiRoutes = require('./routes/ai');
const paymentRoutes = require('./routes/payment');
const colorRoutes = require('./routes/colors');
const siteGalleryRoutes = require('./routes/siteGallery');
const storageRoutes = require('./routes/storage');
const ticketRoutes = require('./routes/tickets');
const reportRoutes = require('./routes/reports');
const path = require('path');

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
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'GetMídia API is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
