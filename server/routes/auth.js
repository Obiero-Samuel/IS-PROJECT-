const express = require('express');
const router = express.Router();

const {
    register,
    login,
    getMe,
    verifyEmailOtp,
    resendVerificationOtp,
    listWards,
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

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

module.exports = router;
