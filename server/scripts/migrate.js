/**
 * This file handles the simple legacy SQL migration runner.
 */
// Read migration files from disk.
const fs = require('fs');
// Build filesystem paths safely.
const path = require('path');
// DB helper used to execute SQL statements.
const db = require('../config/db');

const runMigrations = async () => {
  // Point to legacy migrations folder.
  const migrationsDir = path.join(__dirname, '../migrations');

  try {
    // Read all SQL migration files and sort by filename order.
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically (001, 002, 003, etc.)

    console.log(`Found ${files.length} migration file(s). Starting migration...`);

    for (const file of files) {
      // Build absolute path for current migration file.
      const filePath = path.join(migrationsDir, file);
      // Read SQL text from disk.
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`Running migration: ${file}...`);
      // Execute migration SQL in database.
      await db.query(sql);
      console.log(`Migration ${file} completed successfully.`);
    }

    console.log('All migrations completed successfully!');
    // Exit process with success code.
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    // Exit process with failure code.
    process.exit(1);
  }
};

// Start runner immediately when script executes.
runMigrations();
