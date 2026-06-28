const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// All endpoints here require 'admin' role
router.use(verifyToken, requireRole('admin'));

// Users
router.get('/users', adminController.listUsers);
router.patch('/users/:id', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

// Wards
router.get('/wards', adminController.listWards);
router.post('/wards', adminController.createWard);
router.patch('/wards/:id', adminController.updateWard);
router.delete('/wards/:id', adminController.deleteWard);

// Categories
router.get('/categories', adminController.listCategories);
router.post('/categories', adminController.createCategory);
router.patch('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Authorities
router.get('/authorities', adminController.listAuthorities);
router.post('/authorities', adminController.createAuthority);
router.patch('/authorities/:id', adminController.updateAuthority);

// Mappings
router.post('/category-authority-map', adminController.mapCategoryToAuthority);
router.delete('/category-authority-map', adminController.unmapCategoryFromAuthority);

module.exports = router;
