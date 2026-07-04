/**
 * This file handles analytics route wiring for metrics and weekly generation.
 */
// Load Express to define grouped analytics routes.
const express = require('express');
// Router instance mounted under /api/analytics.
const router = express.Router();

// Auth middleware protects analytics endpoints.
const { verifyToken, requireRole } = require('../middleware/auth');
// Controller contains query and generation logic.
const analyticsController = require('../controllers/analyticsController');

// Analytics & Reporting Engine routes.
// Return recent analytics snapshots for dashboard tables.
router.get('/', verifyToken, requireRole('admin', 'authority'), analyticsController.listAnalytics);
// Return only the latest analytics snapshot for KPI cards.
router.get('/latest', verifyToken, requireRole('admin', 'authority'), analyticsController.getLatestAnalytics);
// Manually trigger weekly analytics generation (admin only).
router.post('/weekly', verifyToken, requireRole('admin'), analyticsController.generateWeeklyAnalytics);

// Export router for mounting in server.js.
module.exports = router;
