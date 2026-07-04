/**
 * This file defines authentication-related routes.
 * It handles signup/login, email OTP verification, and profile read/update endpoints.
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const {
    register,
    login,
    logout,
    getMe,
    getMyProfile,
    updateMyProfile,
    verifyEmailOtp,
    resendVerificationOtp,
    listWards,
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Store profile photos in uploads/ with unique names.
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

// Accept images only for profile uploads.
const fileFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp).'));
    }
};

// Multer guardrails: type filter + 5 MB max file size.
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

// Ward options for registration/profile forms.
router.get('/wards', listWards);

// Create account.
router.post('/register', register);

// Login and issue JWT.
router.post('/login', login);

// Logout and clear session cookie.
router.post('/logout', logout);

// Verify email OTP.
router.post('/verify-email-otp', verifyEmailOtp);

// Resend verification OTP.
router.post('/resend-verification-otp', resendVerificationOtp);

// Basic authenticated session identity.
router.get('/me', verifyToken, getMe);

// Get profile details.
router.get('/profile', verifyToken, getMyProfile);

// Update profile fields and optional photo.
router.patch('/profile', verifyToken, upload.single('photo'), updateMyProfile);

module.exports = router;
