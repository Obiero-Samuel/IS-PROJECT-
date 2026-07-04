/**
 * This file handles automation route wiring for manual trigger runs.
 */
// Load Express router utilities.
const express = require('express');
// Router mounted at /api/automation.
const router = express.Router();

// Import auth middleware to secure automation endpoints.
const { verifyToken, requireRole } = require('../middleware/auth');
// Import controller with automation trigger logic.
const automationController = require('../controllers/automationController');

// Only admin users can run/view automation sessions.
router.use(verifyToken, requireRole('admin'));
// Trigger one automation cycle (overdue scan + analytics run).
router.post('/run', automationController.runAutomatedTriggers);
// List past automation sessions for audit/history.
router.get('/sessions', automationController.listAutomationSessions);

// Export router for server mount.
module.exports = router;
