/**
 * migrate.js — Database Migration Runner
 * Owner: Partner B (extended to run all migrations + seeds)
 *
 * Usage:
 *   node db/migrate.js migrate          → run all pending migrations
 *   node db/migrate.js seed             → run all seed files
 *   node db/migrate.js all              → run migrations then seeds
 *   node db/migrate.js migrate 006      → run only migrations starting from 006
 */

const fs   = require('fs');
const path = require('path');
const db   = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SEEDS_DIR      = path.join(__dirname, 'seeds');

// --- Schema tracking table (idempotent) ------------------------------------
const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS _migrations (
    id          SERIAL PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL UNIQUE,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function initTrackingTable() {
  await db.query(INIT_SQL);
}

async function getApplied() {
  const res = await db.query('SELECT filename FROM _migrations ORDER BY filename');
  return new Set(res.rows.map(r => r.filename));
}

async function markApplied(filename) {
  await db.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [filename]);
}

// --- File runner ------------------------------------------------------------
async function runSqlFile(filePath, filename, applied) {
  if (applied.has(filename)) {
    console.log(`  ⏭  SKIP  ${filename} (already applied)`);
    return;
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  try {
    await db.query(sql);
    await markApplied(filename);
    console.log(`  ✅ DONE  ${filename}`);
  } catch (err) {
    console.error(`  ❌ FAIL  ${filename}`);
    console.error(`     ${err.message}`);
    throw err;   // halt on first failure
  }
}

async function runDirectory(dir, label, fromPrefix = '000') {
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql') && f >= fromPrefix)
    .sort();

  if (files.length === 0) {
    console.log(`  (no ${label} files found)`);
    return;
  }

  await initTrackingTable();
  const applied = await getApplied();

  console.log(`\n▶  Running ${label} from ${dir}`);
  for (const file of files) {
    await runSqlFile(path.join(dir, file), file, applied);
  }
  console.log(`\n✔  ${label} complete.\n`);
}

// --- Entry point ------------------------------------------------------------
async function main() {
  const [,, command = 'all', fromPrefix] = process.argv;
  const prefix = fromPrefix ? `${fromPrefix.padStart(3, '0')}` : '000';

  try {
    if (command === 'migrate' || command === 'all') {
      await runDirectory(MIGRATIONS_DIR, 'Migrations', prefix);
    }
    if (command === 'seed' || command === 'all') {
      await runDirectory(SEEDS_DIR, 'Seeds', prefix);
    }
    if (!['migrate', 'seed', 'all'].includes(command)) {
      console.error('Unknown command. Use: migrate | seed | all');
      process.exit(1);
    }
  } catch {
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

main();
