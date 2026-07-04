/**
 * This file handles officer route wiring for queue status updates and case notes.
 */
// Load Express and create a router for officer endpoints.
const express = require('express');
// Router mounted at /api/officer.
const router = express.Router();

// Auth middleware validates login and role.
const { verifyToken, requireRole } = require('../middleware/auth');
// Officer controller handles queue operations.
const officerController = require('../controllers/officerController');

// All officer routes require authenticated authority user.
router.use(verifyToken, requireRole('authority'));
// Get officer queue (assigned reports).
router.get('/queue', officerController.getAssignedReports);
// Update queue report status by id.
router.patch('/queue/:id/status', officerController.updateReportStatus);
// Save queue note by report id.
router.post('/queue/:id/notes', officerController.addResolutionNote);

// Export router to be mounted by server.
module.exports = router;
