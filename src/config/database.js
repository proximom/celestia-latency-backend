const { Pool } = require('pg');
const logger = require('../utils/logger');

// The Pool manages multiple client connections for you automatically.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // On services like Render, SSL is required.
  ssl: {
    rejectUnauthorized: false
  }
});

// A generic query method that handles client checkout, execution, and release.
const query = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
};

const run = async (sql, params = []) => {
  const result = await query(sql, params);
  // ✅ FIX: Check if there are rows returned (from a RETURNING clause)
  if (result.rows && result.rows.length > 0) {
    // If there's a returning value, return the first row (which should contain the id)
    return result.rows[0];
  }
  // Otherwise, return the rowCount for standard INSERT/UPDATE/DELETE
  return { changes: result.rowCount };
};

const get = async (sql, params = []) => {
  const result = await query(sql, params);
  return result.rows[0] || null;
};

const all = async (sql, params = []) => {
  const result = await query(sql, params);
  return result.rows;
};

const close = async () => {
  await pool.end();
  logger.info('Database connection pool closed');
};

const runMigrations = async () => {
  logger.info('Running PostgreSQL migrations...');
  // Use SERIAL for auto-incrementing primary key and TIMESTAMPTZ for timezone-aware timestamps.
  await run(`
    CREATE TABLE IF NOT EXISTS endpoints (
      id SERIAL PRIMARY KEY,
      chain TEXT NOT NULL DEFAULT 'celestia',
      kind TEXT NOT NULL CHECK(kind IN ('rpc', 'grpc')),
      url TEXT NOT NULL,
      is_archival INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chain, kind, url)
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS latency_runs (
      id SERIAL PRIMARY KEY,
      endpoint_id INTEGER NOT NULL,
      region TEXT NOT NULL,
      ts TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reachable INTEGER NOT NULL DEFAULT 0,
      timeout INTEGER NOT NULL DEFAULT 0,
      latest_height INTEGER,
      block1_status TEXT,
      latency_ms INTEGER,
      error TEXT,
      http_status TEXT,
      FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
    )
  `);
  await run('CREATE INDEX IF NOT EXISTS idx_endpoints_url ON endpoints(url)');
  await run('CREATE INDEX IF NOT EXISTS idx_latency_runs_composite ON latency_runs(endpoint_id, region, ts DESC)');
  logger.info('✅ Migrations completed');
};

const initialize = async () => {
  try {
    const client = await pool.connect();
    logger.info('🚀 Connecting to PostgreSQL database...');
    await client.query('SELECT NOW()'); // A simple query to check the connection
    client.release();
    await runMigrations();
    logger.info('✅ PostgreSQL Database initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize PostgreSQL database:', error);
    throw error;
  }
};

// Export an object that has the exact same methods as your old database file.
// This is why you don't need to change any other file.
module.exports = {
  initialize,
  run,
  get,
  all,
  close
};
