const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');

const SALT_ROUNDS = 12;
const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;

const getMailer = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: parseInt(SMTP_PORT, 10) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const sendVerificationOtpEmail = async (email, username, otp) => {
  const transporter = getMailer();

  if (!transporter) {
    throw new Error('Email service is not configured. Please set SMTP credentials in .env.');
  }

  const smtpUser = process.env.SMTP_USER;
  const recipientEmail = normalizeEmail(email);
  const configuredFrom = process.env.MAIL_FROM;
  const fromEmail = configuredFrom || (smtpUser ? `IS PROJECT <${smtpUser}>` : undefined);

  if (!smtpUser) {
    throw new Error('SMTP_USER is required for sending verification emails.');
  }

  const info = await transporter.sendMail({
    from: fromEmail,
    to: recipientEmail,
    replyTo: smtpUser,
    envelope: {
      from: smtpUser,
      to: recipientEmail,
    },
    subject: 'IS PROJECT - Verify your account',
    text: `Hi ${username}, your verification OTP is ${otp}. It will expire in ${OTP_TTL_MINUTES} minutes.`,
    html: `<p>Hi <strong>${username}</strong>,</p><p>Your verification OTP is:</p><h2 style="letter-spacing: 2px;">${otp}</h2><p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>`,
  });

  const accepted = Array.isArray(info.accepted) ? info.accepted : [];
  if (accepted.length === 0) {
    throw new Error('Email provider did not accept the recipient address. Please confirm the email and retry.');
  }

  return info;
};

const issueAndStoreOtp = async (userId, email, username) => {
  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  await db.query(
    `UPDATE users
     SET email_verification_otp_hash = $1,
         email_verification_otp_expires_at = NOW() + ($2 || ' minutes')::interval
     WHERE id = $3`,
    [otpHash, OTP_TTL_MINUTES.toString(), userId]
  );

  const mailInfo = await sendVerificationOtpEmail(email, username, otp);

  if (!IS_PRODUCTION) {
    console.log(
      `[OTP][DEV] email=${email} otp=${otp} expiresIn=${OTP_TTL_MINUTES}m messageId=${mailInfo.messageId} smtpResponse=${mailInfo.response}`
    );
  }

  return { otp, mailInfo };
};

/**
 * Helper: sign a JWT for a given user record
 */
const signToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
const register = async (req, res, next) => {
  try {
    const { username, email, password, ward_id } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Basic validation
    if (!username || !normalizedEmail || !password || !ward_id) {
      return res.status(400).json({ error: { message: 'username, email, password, and ward_id are required.' } });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: { message: 'Password must be at least 8 characters.' } });
    }

    // Check ward exists
    const wardCheck = await db.query('SELECT id FROM wards WHERE id = $1', [ward_id]);
    if (wardCheck.rows.length === 0) {
      return res.status(400).json({ error: { message: 'Invalid ward_id.' } });
    }

    // Check duplicate email or username
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [normalizedEmail, username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { message: 'Email or username already in use.' } });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, role, ward_id, is_email_verified)
       VALUES ($1, $2, $3, 'resident', $4, FALSE)
       RETURNING id, username, email, role, ward_id, created_at`,
      [username, normalizedEmail, password_hash, ward_id]
    );

    const user = result.rows[0];

    const otpResult = await issueAndStoreOtp(user.id, user.email, user.username);

    const responseBody = {
      message: 'Registration successful. A verification OTP has been sent to your email.',
      requiresVerification: true,
      email: user.email
    };

    if (!IS_PRODUCTION) {
      responseBody.debug = {
        otp: otpResult.otp,
        expiresInMinutes: OTP_TTL_MINUTES,
        smtpMessageId: otpResult.mailInfo?.messageId,
        smtpResponse: otpResult.mailInfo?.response,
      };
    }

    res.status(201).json(responseBody);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
const login = async (req, res, next) => {
  try {
    const { username, email, password, ward_id } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!username || !normalizedEmail || !password || !ward_id) {
      return res.status(400).json({ error: { message: 'username, email, password, and ward_id are required.' } });
    }

    // Look up user
    const result = await db.query(
      `SELECT id, username, email, password_hash, role, ward_id, is_email_verified
       FROM users
       WHERE email = $1 AND username = $2 AND ward_id = $3`,
      [normalizedEmail, username, ward_id]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Invalid credentials.' } });
    }

    const user = result.rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: { message: 'Invalid credentials.' } });
    }

    if (!user.is_email_verified) {
      return res.status(403).json({
        error: { message: 'Email not verified. Please enter OTP to verify first.' },
        requiresVerification: true,
        email: user.email,
      });
    }

    const token = signToken(user);

    res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role, ward_id: user.ward_id }
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/verify-email-otp
// ---------------------------------------------------------------------------
const verifyEmailOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !otp) {
      return res.status(400).json({ error: { message: 'email and otp are required.' } });
    }

    const userRes = await db.query(
      `SELECT id, username, email, role, ward_id, is_email_verified,
              email_verification_otp_hash, email_verification_otp_expires_at
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    const user = userRes.rows[0];

    if (user.is_email_verified) {
      const token = signToken(user);
      return res.json({
        message: 'Email already verified.',
        token,
        user: { id: user.id, username: user.username, email: user.email, role: user.role, ward_id: user.ward_id },
      });
    }

    if (!user.email_verification_otp_hash || !user.email_verification_otp_expires_at) {
      return res.status(400).json({ error: { message: 'No active OTP. Please request a new one.' } });
    }

    if (new Date(user.email_verification_otp_expires_at) < new Date()) {
      return res.status(400).json({ error: { message: 'OTP has expired. Please request a new one.' } });
    }

    const providedHash = hashOtp(otp);
    if (providedHash !== user.email_verification_otp_hash) {
      return res.status(400).json({ error: { message: 'Invalid OTP.' } });
    }

    await db.query(
      `UPDATE users
       SET is_email_verified = TRUE,
           email_verified_at = NOW(),
           email_verification_otp_hash = NULL,
           email_verification_otp_expires_at = NULL
       WHERE id = $1`,
      [user.id]
    );

    const token = signToken(user);

    res.json({
      message: 'Email verified successfully.',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role, ward_id: user.ward_id },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/resend-verification-otp
// ---------------------------------------------------------------------------
const resendVerificationOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: { message: 'email is required.' } });
    }

    const userRes = await db.query(
      `SELECT id, username, email, is_email_verified
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    const user = userRes.rows[0];
    if (user.is_email_verified) {
      return res.status(400).json({ error: { message: 'This account is already verified.' } });
    }

    const otpResult = await issueAndStoreOtp(user.id, user.email, user.username);

    const responseBody = { message: 'A new verification OTP has been sent.' };
    if (!IS_PRODUCTION) {
      responseBody.debug = {
        otp: otpResult.otp,
        expiresInMinutes: OTP_TTL_MINUTES,
        smtpMessageId: otpResult.mailInfo?.messageId,
        smtpResponse: otpResult.mailInfo?.response,
      };
    }

    res.json(responseBody);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/auth/wards
// ---------------------------------------------------------------------------
const listWards = async (req, res, next) => {
  try {
    const { county, constituency, focus } = req.query;
    const conditions = ['is_active = TRUE'];
    const values = [];

    if (typeof county === 'string' && county.trim()) {
      values.push(county.trim());
      conditions.push(`county = $${values.length}`);
    }

    if (typeof constituency === 'string' && constituency.trim()) {
      const constituencyList = constituency
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      if (constituencyList.length > 0) {
        values.push(constituencyList);
        conditions.push(`constituency = ANY($${values.length}::text[])`);
      }
    }

    if (typeof focus === 'string' && focus.toLowerCase() === 'nairobi-west') {
      values.push('Nairobi');
      conditions.push(`county = $${values.length}`);
      conditions.push(`code LIKE 'NBIW-%'`);
    }

    const result = await db.query(
      `SELECT id, name, code, county, constituency
       FROM wards
       WHERE ${conditions.join(' AND ')}
       ORDER BY constituency ASC NULLS LAST, name ASC`,
      values
    );

    res.json({ wards: result.rows });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/auth/me  (protected)
// ---------------------------------------------------------------------------
const getMe = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
  verifyEmailOtp,
  resendVerificationOtp,
  listWards,
};
