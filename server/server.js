/**
 * This file starts the backend API.
 * It sets common middleware, connects route modules, checks DB health, and runs scheduled jobs.
 */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const authorityRoutes = require('./routes/authority');
const adminRoutes = require('./routes/admin');
const summaryRoutes = require('./routes/summary');
const routingRoutes = require('./routes/routing');
const officerRoutes = require('./routes/officer');
const escalationRoutes = require('./routes/escalation');
const analyticsRoutes = require('./routes/analytics');
const automationRoutes = require('./routes/automation');
const cron = require('node-cron');
const { checkOverdueEscalations } = require('./jobs/escalationOverdueJob');
const { runWeeklyAnalytics } = require('./jobs/weeklyAnalyticsJob');

const app = express();
const PORT = process.env.PORT || 5000;

const parseAllowedOrigins = () => {
  const raw = process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:3000';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin/server-to-server calls with no Origin header.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    const corsError = new Error(`CORS blocked for origin: ${origin}`);
    corsError.status = 403;
    callback(corsError);
  },
  credentials: true,
};

// Keep middleware order predictable: CORS -> body parsers -> logger.
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Expose uploaded files at stable public URLs.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────

// Lightweight API landing payload.
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the IS PROJECT Express API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      reports: '/api/reports'
    }
  });
});

// Health check includes DB reachability.
app.get('/api/health', async (req, res, next) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    next(error);
  }
});

// Domain route mounts under /api/* (frontend contract).
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/authority', authorityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/summary', summaryRoutes);

// Canonical module routes (kept alongside legacy routes for compatibility)
app.use('/api/routing', routingRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/automation', automationRoutes);

// Admin-only manual trigger for overdue check job.
const { verifyToken, requireRole } = require('./middleware/auth');
app.post('/api/admin/jobs/escalation-overdue', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const count = await checkOverdueEscalations();
    res.json({ message: 'Overdue check completed manually', updated_count: count });
  } catch (err) {
    next(err);
  }
});

// Global API error shape.
app.use((err, req, res, next) => {
  // Handle multer errors specifically
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: { message: 'File too large. Maximum size is 5 MB.' } });
  }
  // Central log for all uncaught request errors.
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Boot: verify DB, schedule jobs, then listen.
const startServer = async () => {
  try {
    await db.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL:', process.env.DB_NAME || 'is_project_db');

    // Daily overdue recalculation.
    cron.schedule('0 0 * * *', () => {
      checkOverdueEscalations().catch(console.error);
    });

    // Weekly analytics snapshot.
    cron.schedule('0 6 * * 1', () => {
      runWeeklyAnalytics({ triggeredBy: 'system' }).catch(console.error);
    });

    console.log('⏱️  Escalation cron job scheduled (Daily deadline monitor)');
    console.log('📊 Weekly analytics cron job scheduled (Mondays at 06:00)');
    console.log(`🌐 Credentialed CORS origins: ${allowedOrigins.join(', ')}`);

    app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log(`   Auth:   http://localhost:${PORT}/api/auth`);
      console.log(`   Reports:http://localhost:${PORT}/api/reports`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    process.exit(1);
  }
};

startServer();
