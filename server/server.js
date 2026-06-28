const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const authorityRoutes = require('./routes/authority');
const adminRoutes = require('./routes/admin');
const summaryRoutes = require('./routes/summary');
const cron = require('node-cron');
const { checkOverdueEscalations } = require('./jobs/escalationOverdueJob');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve uploaded photos as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────

// Root
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

// Health check
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

// Feature routers
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/authority', authorityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/summary', summaryRoutes);

// Manual trigger for cron job (admin only, for testing)
const { verifyToken, requireRole } = require('./middleware/auth');
app.post('/api/admin/jobs/escalation-overdue', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const count = await checkOverdueEscalations();
    res.json({ message: 'Overdue check completed manually', updated_count: count });
  } catch (err) {
    next(err);
  }
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // Handle multer errors specifically
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: { message: 'File too large. Maximum size is 5 MB.' } });
  }
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await db.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL:', process.env.DB_NAME || 'is_project_db');

    // Schedule weekly cron job (Every Monday at 00:00)
    cron.schedule('0 0 * * 1', () => {
      checkOverdueEscalations().catch(console.error);
    });
    console.log('⏱️  Escalation cron job scheduled (Weekly)');

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
