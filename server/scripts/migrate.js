const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const runMigrations = async () => {
  const migrationsDir = path.join(__dirname, '../migrations');
  
  try {
    // Read all files from the migrations directory
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically (001, 002, 003, etc.)
    
    console.log(`Found ${files.length} migration file(s). Starting migration...`);
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Running migration: ${file}...`);
      await db.query(sql);
      console.log(`Migration ${file} completed successfully.`);
    }
    
    console.log('All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
