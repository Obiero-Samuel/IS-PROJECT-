/**
 * This file handles PostgreSQL setup and exports the shared DB query pool.
 */
// Import pg Pool client.
const { Pool } = require('pg');
// Load .env values into process.env.
require('dotenv').config();

// Create one shared pool for the whole backend app.
const pool = new Pool({
  // DB username.
  user: process.env.DB_USER || 'postgres',
  // DB password.
  password: process.env.DB_PASSWORD || '',
  // DB host address.
  host: process.env.DB_HOST || 'localhost',
  // DB port converted to number.
  port: parseInt(process.env.DB_PORT || '5432', 10),
  // Target database name.
  database: process.env.DB_NAME || 'is_project_db',
});

// Export helper query function + raw pool (for transactions/end).
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
