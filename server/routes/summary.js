/**
 * This file handles route wiring for summary report generation and retrieval.
 */
// Load Express and create a summary router.
const express = require('express');
// Router mounted at /api/summary.
const router = express.Router();
// Import auth middleware for token and role checks.
const { verifyToken, requireRole } = require('../middleware/auth');
// Controller implements generate/list/get summary logic.
const summaryController = require('../controllers/summaryController');

// Generate report (admin only)
// Admin-only: generate or refresh summary report for a period.
router.post('/generate', verifyToken, requireRole('admin'), summaryController.generateSummaryReport);

// View reports (admin and authority)
// Admin/authority: list summary reports.
router.get('/', verifyToken, requireRole('admin', 'authority'), summaryController.listSummaryReports);
// Admin/authority: fetch one summary report by id.
router.get('/:id', verifyToken, requireRole('admin', 'authority'), summaryController.getSummaryReportById);

// Export router for server mount.
module.exports = router;
