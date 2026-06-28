const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const authorityController = require('../controllers/authorityController');

// Routing: Category to Authorities
router.get('/routing', authorityController.getAuthoritiesForCategory);

// Officer Endpoints (Require 'authority' role)
router.get('/reports', verifyToken, requireRole('authority'), authorityController.getAssignedReports);
router.patch('/reports/:id/status', verifyToken, requireRole('authority'), authorityController.updateReportStatus);
router.post('/reports/:id/notes', verifyToken, requireRole('authority'), authorityController.addResolutionNote);

// Escalation Management
router.post('/escalations', verifyToken, requireRole('authority', 'admin'), authorityController.createEscalation);
router.get('/escalations', verifyToken, requireRole('authority', 'admin'), authorityController.getEscalationsForAuthority);
router.patch('/escalations/:id', verifyToken, requireRole('authority', 'admin'), authorityController.updateEscalationStatus);

module.exports = router;
