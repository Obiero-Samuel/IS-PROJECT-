const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
// 1. Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the IS PROJECT Express API',
    status: 'running',
    version: '1.0.0'
  });
});

// 2. Health check route (DB Connectivity Test)
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

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Error Details:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Start the server and verify database connection
const startServer = async () => {
  try {
    // Check DB Connection
    await db.query('SELECT 1');
    console.log('Successfully connected to PostgreSQL database:', process.env.DB_NAME || 'is_project_db');
    
    app.listen(PORT, () => {
      console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to connect to the database. Express server is not starting.');
    console.error(error);
    process.exit(1);
  }
};

startServer();
