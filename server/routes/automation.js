const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/auth');
const automationController = require('../controllers/automationController');

// Automated Triggers module (manual admin controls + session visibility)
router.use(verifyToken, requireRole('admin'));
router.post('/run', automationController.runAutomatedTriggers);
router.get('/sessions', automationController.listAutomationSessions);

module.exports = router;
