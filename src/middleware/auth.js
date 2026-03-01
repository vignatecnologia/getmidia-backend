const { verifyToken } = require('../services/auth');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.get('Authorization') || req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = decoded;
    next();
};

module.exports = authMiddleware;
