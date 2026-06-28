const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const {
  getCategories,
  createReport,
  getReports,
  getMyReports,
  getReportById,
  upvoteReport
} = require('../controllers/reportController');

// --- Multer storage config ---------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `report-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp).'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// --- Routes -----------------------------------------------------------------

// GET /api/reports — public paginated list
router.get('/', getReports);

// GET /api/reports/categories — public categories for report form
router.get('/categories', getCategories);

// GET /api/reports/mine — authenticated user's own reports
router.get('/mine', verifyToken, getMyReports);

// GET /api/reports/:id — single report detail
router.get('/:id', getReportById);

// POST /api/reports — submit new issue (auth + optional photo)
router.post('/', verifyToken, upload.single('photo'), createReport);

// POST /api/reports/:id/upvote — toggle upvote
router.post('/:id/upvote', verifyToken, upvoteReport);

module.exports = router;
