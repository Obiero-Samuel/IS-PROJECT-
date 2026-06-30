const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/auth');
const escalationController = require('../controllers/escalationController');

// Escalation Engine & Audit Logger
router.use(verifyToken, requireRole('authority', 'admin'));
router.post('/', escalationController.createEscalation);
router.get('/', escalationController.getEscalationsForAuthority);
router.patch('/:id', escalationController.updateEscalationStatus);

module.exports = router;
