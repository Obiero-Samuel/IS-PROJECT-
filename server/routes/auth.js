const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const {
    register,
    login,
    getMe,
    getMyProfile,
    updateMyProfile,
    verifyEmailOtp,
    resendVerificationOtp,
    listWards,
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `profile-${uniqueSuffix}${ext}`);
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
    limits: { fileSize: 5 * 1024 * 1024 },
});

// GET /api/auth/wards
router.get('/wards', listWards);

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/verify-email-otp
router.post('/verify-email-otp', verifyEmailOtp);

// POST /api/auth/resend-verification-otp
router.post('/resend-verification-otp', resendVerificationOtp);

// GET /api/auth/me  — protected
router.get('/me', verifyToken, getMe);

// GET /api/auth/profile — protected
router.get('/profile', verifyToken, getMyProfile);

// PATCH /api/auth/profile — protected (supports optional profile photo upload)
router.patch('/profile', verifyToken, upload.single('photo'), updateMyProfile);

module.exports = router;
