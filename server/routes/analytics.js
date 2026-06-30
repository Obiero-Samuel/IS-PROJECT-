const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// Analytics & Reporting Engine
router.get('/', verifyToken, requireRole('admin', 'authority'), analyticsController.listAnalytics);
router.get('/latest', verifyToken, requireRole('admin', 'authority'), analyticsController.getLatestAnalytics);
router.post('/weekly', verifyToken, requireRole('admin'), analyticsController.generateWeeklyAnalytics);

module.exports = router;
