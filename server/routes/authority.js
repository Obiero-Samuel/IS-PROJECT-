/**
 * This file handles authority route wiring for queue, routing lookup, and escalations.
 */
// Load Express for modular route grouping.
const express = require('express');
// Router mounted at /api/authority.
const router = express.Router();
// Middleware for token validation + role authorization.
const { verifyToken, requireRole } = require('../middleware/auth');
// Controller with authority and escalation business logic.
const authorityController = require('../controllers/authorityController');

// Routing lookup: given category_id, return responsible authorities.
router.get('/routing', authorityController.getAuthoritiesForCategory);

// Officer queue endpoints (authority role required).
// Get assigned queue items for this officer's authority.
router.get('/reports', verifyToken, requireRole('authority'), authorityController.getAssignedReports);
// Update report status (pending/in-progress/resolved).
router.patch('/reports/:id/status', verifyToken, requireRole('authority'), authorityController.updateReportStatus);
// Save status note without changing status.
router.post('/reports/:id/notes', verifyToken, requireRole('authority'), authorityController.addResolutionNote);

// Escalation management (authority and admin can access).
// Create escalation record for a report.
router.post('/escalations', verifyToken, requireRole('authority', 'admin'), authorityController.createEscalation);
// List escalations scoped by authority rules.
router.get('/escalations', verifyToken, requireRole('authority', 'admin'), authorityController.getEscalationsForAuthority);
// Update escalation status (acknowledged/resolved/rejected).
router.patch('/escalations/:id', verifyToken, requireRole('authority', 'admin'), authorityController.updateEscalationStatus);

// Export router so server can mount these endpoints.
module.exports = router;
