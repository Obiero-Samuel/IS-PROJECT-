const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const summaryController = require('../controllers/summaryController');

// Generate report (admin only)
router.post('/generate', verifyToken, requireRole('admin'), summaryController.generateSummaryReport);

// View reports (admin and authority)
router.get('/', verifyToken, requireRole('admin', 'authority'), summaryController.listSummaryReports);
router.get('/:id', verifyToken, requireRole('admin', 'authority'), summaryController.getSummaryReportById);

module.exports = router;
