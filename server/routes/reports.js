/**
 * This file handles public and resident report route wiring.
 */
// Load Express for route grouping.
const express = require('express');
// Multer is used for photo uploads in report creation.
const multer = require('multer');
// Path helps build safe upload directory/file names.
const path = require('path');
// Router mounted at /api/reports.
const router = express.Router();

// Auth middleware protects resident-only operations.
const { verifyToken, requireRole } = require('../middleware/auth');
// Report controller contains list/create/detail/upvote logic.
const {
  getCategories,
  createReport,
  getReports,
  getMyReports,
  getReportById,
  upvoteReport
} = require('../controllers/reportController');

// --- Multer upload config ---------------------------------------------------
// Choose where uploaded report photos are stored.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  // Rename photo to unique filename to avoid collisions.
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `report-${uniqueSuffix}${ext}`);
  }
});

// Allow only image files for report photo evidence.
const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp).'));
  }
};

// Final upload middleware with type + size limits.
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// --- Routes -----------------------------------------------------------------

// Public: list reports with optional pagination/filters.
router.get('/', getReports);

// Public: list categories used in report form.
router.get('/categories', getCategories);

// Authenticated: get current user's submitted reports.
router.get('/mine', verifyToken, getMyReports);

// Public: get one report by id.
router.get('/:id', getReportById);

// Resident-only: submit new report with optional photo upload.
router.post('/', verifyToken, requireRole('resident'), upload.single('photo'), createReport);

// Authenticated: toggle upvote on selected report.
router.post('/:id/upvote', verifyToken, upvoteReport);

// Export router for server mount.
module.exports = router;
