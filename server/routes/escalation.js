/**
 * This file handles escalation route wiring for create, list, and update actions.
 */
// Load Express to define grouped escalation endpoints.
const express = require('express');
// Router mounted at /api/escalations.
const router = express.Router();

// Middleware for token and role checks.
const { verifyToken, requireRole } = require('../middleware/auth');
// Controller delegates to escalation business logic.
const escalationController = require('../controllers/escalationController');

// Restrict escalation endpoints to authority and admin users.
router.use(verifyToken, requireRole('authority', 'admin'));
// Create a new escalation.
router.post('/', escalationController.createEscalation);
// List escalations visible to caller scope.
router.get('/', escalationController.getEscalationsForAuthority);
// Update one escalation status by id.
router.patch('/:id', escalationController.updateEscalationStatus);

// Export router for mounting in server.js.
module.exports = router;
