const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/auth');
const routingController = require('../controllers/routingController');

// Authority Routing Engine
router.get(
    '/category-authorities',
    verifyToken,
    requireRole('resident', 'authority', 'admin'),
    routingController.getAuthoritiesForCategory
);

module.exports = router;
