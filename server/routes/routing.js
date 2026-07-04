/**
 * This file handles route wiring for category-to-authority resolution.
 */
// Load Express and build router for routing helper endpoints.
const express = require('express');
// Router mounted at /api/routing.
const router = express.Router();

// Auth middleware keeps routing lookups scoped to signed-in users.
const { verifyToken, requireRole } = require('../middleware/auth');
// Routing controller resolves category -> authority mappings.
const routingController = require('../controllers/routingController');

// Authority Routing Engine
// Return authorities responsible for the provided category_id.
router.get(
    '/category-authorities',
    verifyToken,
    requireRole('resident', 'authority', 'admin'),
    routingController.getAuthoritiesForCategory
);

// Export router so app can mount this module.
module.exports = router;
