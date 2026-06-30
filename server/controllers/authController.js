const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');

const SALT_ROUNDS = 12;
const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PROFILE_MAX_EDITS = parseInt(process.env.PROFILE_MAX_EDITS || '5', 10);
const EXPOSE_DEV_OTP = !IS_PRODUCTION && String(process.env.EXPOSE_DEV_OTP || '').toLowerCase() === 'true';

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
    if (!IS_PRODUCTION) {
      return {
        messageId: 'dev-no-smtp',
        response: 'SMTP not configured. OTP not emailed; use debug OTP in response for local development.',
        delivered: false,
      };
    }

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

  return {
    ...info,
    delivered: true,
  };
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

const toAuthUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  ward_id: user.ward_id,
});

const toProfile = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  ward_id: user.ward_id,
  full_name: user.full_name ?? user.username,
  phone_number: user.phone_number ?? null,
  date_of_birth: user.date_of_birth ?? null,
  residence: user.residence ?? null,
  profile_photo_url: user.profile_photo_url ?? null,
  bio: user.bio ?? null,
  created_at: user.created_at,
});

const profileEditsMeta = (user) => {
  const used = Number(user.profile_edit_count || 0);
  const max = Number.isFinite(PROFILE_MAX_EDITS) && PROFILE_MAX_EDITS > 0 ? PROFILE_MAX_EDITS : 5;
  return {
    used,
    max,
    remaining: Math.max(max - used, 0),
  };
};

const buildOtpDebug = (otpResult) => {
  if (IS_PRODUCTION) return undefined;

  const mustExposeOtp = EXPOSE_DEV_OTP || otpResult?.mailInfo?.delivered === false;

  return {
    ...(mustExposeOtp ? { otp: otpResult.otp } : {}),
    expiresInMinutes: OTP_TTL_MINUTES,
    smtpMessageId: otpResult.mailInfo?.messageId,
    smtpResponse: otpResult.mailInfo?.response,
    ...(otpResult?.mailInfo?.delivered === false
      ? { delivery: 'not-sent-dev-fallback' }
      : { delivery: 'sent' }),
  };
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
      message: otpResult.mailInfo?.delivered === false
        ? 'Registration successful. SMTP is not configured in local development. Use the debug OTP to verify your account.'
        : 'Registration successful. A verification OTP has been sent to your email.',
      requiresVerification: true,
      email: user.email
    };

    const debug = buildOtpDebug(otpResult);
    if (debug) responseBody.debug = debug;

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
    const { username, email, password, ward_id, role_context } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!username || !normalizedEmail || !password) {
      return res.status(400).json({ error: { message: 'username, email, and password are required.' } });
    }

    // Look up user
    const result = await db.query(
      `SELECT id, username, email, password_hash, role, ward_id, is_email_verified
       FROM users
       WHERE email = $1 AND username = $2`,
      [normalizedEmail, username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Invalid credentials.' } });
    }

    const user = result.rows[0];

    if (typeof role_context === 'string' && role_context.trim() && role_context !== user.role) {
      return res.status(403).json({
        error: { message: `This account is not allowed for ${role_context} portal access.` },
      });
    }

    if (user.role === 'resident') {
      if (!ward_id) {
        return res.status(400).json({ error: { message: 'ward_id is required for resident login.' } });
      }

      if (Number(ward_id) !== Number(user.ward_id)) {
        return res.status(401).json({ error: { message: 'Invalid credentials.' } });
      }
    }

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
      user: toAuthUser(user)
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
        user: toAuthUser(user),
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
      user: toAuthUser(user),
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

    const responseBody = {
      message: otpResult.mailInfo?.delivered === false
        ? 'SMTP is not configured in local development. Use the debug OTP to verify your account.'
        : 'A new verification OTP has been sent.',
    };
    const debug = buildOtpDebug(otpResult);
    if (debug) responseBody.debug = debug;

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
      `SELECT id, username, email, role, ward_id, full_name, phone_number, date_of_birth,
              residence, profile_photo_url, bio, profile_edit_count, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }
    const user = result.rows[0];
    res.json({
      user: toAuthUser(user),
      profile: toProfile(user),
      profileEdits: profileEditsMeta(user),
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/auth/profile  (protected)
// ---------------------------------------------------------------------------
const getMyProfile = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, role, ward_id, full_name, phone_number, date_of_birth,
              residence, profile_photo_url, bio, profile_edit_count, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    const user = result.rows[0];
    res.json({
      profile: toProfile(user),
      profileEdits: profileEditsMeta(user),
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/auth/profile  (protected)
// Accepts multipart/form-data (optional photo) or JSON payload
// ---------------------------------------------------------------------------
const updateMyProfile = async (req, res, next) => {
  try {
    const userResult = await db.query(
      `SELECT id, username, email, role, ward_id, full_name, phone_number, date_of_birth,
              residence, profile_photo_url, bio, profile_edit_count, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    const currentUser = userResult.rows[0];
    const editMeta = profileEditsMeta(currentUser);
    if (editMeta.remaining <= 0) {
      return res.status(403).json({
        error: { message: `Profile update limit reached. Maximum allowed updates: ${editMeta.max}.` },
        profileEdits: editMeta,
      });
    }

    const updates = [];
    const values = [];

    const incomingName = req.body.full_name ?? req.body.name;
    if (incomingName !== undefined) {
      const fullName = String(incomingName).trim();
      if (!fullName) {
        return res.status(400).json({ error: { message: 'name is required when updating profile name.' } });
      }
      values.push(fullName);
      updates.push(`full_name = $${values.length}`);
    }

    if (req.body.phone_number !== undefined) {
      const rawPhone = String(req.body.phone_number || '').trim();
      if (rawPhone && !/^[0-9+\-\s()]{7,20}$/.test(rawPhone)) {
        return res.status(400).json({ error: { message: 'Invalid phone number format.' } });
      }
      values.push(rawPhone || null);
      updates.push(`phone_number = $${values.length}`);
    }

    if (req.body.email !== undefined) {
      const normalizedEmail = normalizeEmail(req.body.email);
      if (!normalizedEmail) {
        return res.status(400).json({ error: { message: 'email is required when updating profile email.' } });
      }

      if (normalizedEmail !== currentUser.email) {
        const emailCheck = await db.query(
          'SELECT id FROM users WHERE email = $1 AND id <> $2',
          [normalizedEmail, req.user.id]
        );
        if (emailCheck.rows.length > 0) {
          return res.status(409).json({ error: { message: 'Email is already in use by another account.' } });
        }
      }

      values.push(normalizedEmail);
      updates.push(`email = $${values.length}`);
    }

    if (req.body.date_of_birth !== undefined) {
      const rawDob = String(req.body.date_of_birth || '').trim();
      if (rawDob && !/^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
        return res.status(400).json({ error: { message: 'date_of_birth must use YYYY-MM-DD format.' } });
      }
      values.push(rawDob || null);
      updates.push(`date_of_birth = $${values.length}`);
    }

    if (req.body.residence !== undefined) {
      const residence = String(req.body.residence || '').trim();
      values.push(residence || null);
      updates.push(`residence = $${values.length}`);
    }

    if (req.body.bio !== undefined) {
      const bio = String(req.body.bio || '').trim();
      if (bio.length > 500) {
        return res.status(400).json({ error: { message: 'Bio cannot exceed 500 characters.' } });
      }
      values.push(bio || null);
      updates.push(`bio = $${values.length}`);
    }

    if (req.file) {
      values.push(`/uploads/${req.file.filename}`);
      updates.push(`profile_photo_url = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No profile changes provided.' } });
    }

    updates.push('profile_edit_count = profile_edit_count + 1');
    updates.push('updated_at = NOW()');

    values.push(req.user.id);
    const updatedUserResult = await db.query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, username, email, role, ward_id, full_name, phone_number, date_of_birth,
                 residence, profile_photo_url, bio, profile_edit_count, created_at`,
      values
    );

    const updatedUser = updatedUserResult.rows[0];
    const token = signToken(updatedUser);

    res.json({
      message: 'Profile updated successfully.',
      token,
      user: toAuthUser(updatedUser),
      profile: toProfile(updatedUser),
      profileEdits: profileEditsMeta(updatedUser),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
  getMyProfile,
  updateMyProfile,
  verifyEmailOtp,
  resendVerificationOtp,
  listWards,
};
