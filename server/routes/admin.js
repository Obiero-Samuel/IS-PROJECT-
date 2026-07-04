/**
 * This file handles admin-only route wiring for management and export endpoints.
 */
// Load Express to create a modular router.
const express = require('express');
// Create a router instance for all /api/admin endpoints.
const router = express.Router();
// Import authentication + role-check middleware.
const { verifyToken, requireRole } = require('../middleware/auth');
// Import admin controller functions (actual endpoint logic).
const adminController = require('../controllers/adminController');

// First verify token, then enforce admin role for every route below.
router.use(verifyToken, requireRole('admin'));

// Users: list, role update, lifecycle update, and delete.
// Get all users for admin table.
router.get('/users', adminController.listUsers);
// Change a user's role (resident/authority/admin).
router.patch('/users/:id', adminController.updateUserRole);
// Activate/deactivate account with lifecycle metadata.
router.patch('/users/:id/lifecycle', adminController.updateUserLifecycle);
// Permanently remove user record.
router.delete('/users/:id', adminController.deleteUser);

// Reports oversight: filter reports + reassign + override close.
// Get paginated reports for admin monitoring.
router.get('/reports', adminController.listReports);
// Reassign report to a different authority/category.
router.patch('/reports/:id/reassign', adminController.reassignReport);
// Force-close report with admin justification note.
router.patch('/reports/:id/override-close', adminController.overrideCloseReport);

// Wards reference data management.
// List wards.
router.get('/wards', adminController.listWards);
// Create ward.
router.post('/wards', adminController.createWard);
// Edit ward.
router.patch('/wards/:id', adminController.updateWard);
// Delete ward.
router.delete('/wards/:id', adminController.deleteWard);

// Categories reference data management.
// List categories.
router.get('/categories', adminController.listCategories);
// Create category.
router.post('/categories', adminController.createCategory);
// Edit category.
router.patch('/categories/:id', adminController.updateCategory);
// Delete category.
router.delete('/categories/:id', adminController.deleteCategory);

// Authorities reference data management.
// List authorities.
router.get('/authorities', adminController.listAuthorities);
// Create authority.
router.post('/authorities', adminController.createAuthority);
// Edit authority.
router.patch('/authorities/:id', adminController.updateAuthority);

// Category-authority mappings with response deadlines.
// List mappings.
router.get('/category-authority-map', adminController.listCategoryAuthorityMappings);
// Create or update mapping (upsert behavior in controller).
router.post('/category-authority-map', adminController.mapCategoryToAuthority);
// Also supports update using PATCH for same mapping endpoint.
router.patch('/category-authority-map', adminController.mapCategoryToAuthority);
// Remove mapping.
router.delete('/category-authority-map', adminController.unmapCategoryFromAuthority);

// Weekly exports: list, generate, and download artifacts.
// List generated weekly export files.
router.get('/weekly-exports', adminController.listWeeklyExports);
// Generate new weekly export (CSV/PDF).
router.post('/weekly-exports', adminController.generateWeeklyExport);
// Download one generated export file by id.
router.get('/weekly-exports/:id/download', adminController.downloadWeeklyExport);

// Export router so server.js can mount it at /api/admin.
module.exports = router;
