const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/auth');
const officerController = require('../controllers/officerController');

// Officer Login & Case Access
router.use(verifyToken, requireRole('authority'));
router.get('/queue', officerController.getAssignedReports);
router.patch('/queue/:id/status', officerController.updateReportStatus);
router.post('/queue/:id/notes', officerController.addResolutionNote);

module.exports = router;
