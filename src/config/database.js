const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const config = require('./app.config');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dbDir = path.dirname(config.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.info(`Created database directory: ${dbDir}`);
      }

      // Open database connection
      this.db = new sqlite3.Database(config.dbPath, (err) => {
        if (err) {
          logger.error('Error opening database:', err);
          throw err;
        }
      });

      // Enable foreign keys
      await this.run('PRAGMA foreign_keys = ON');
      
      // Enable WAL mode for better concurrency
      await this.run('PRAGMA journal_mode = WAL');

      // Run migrations
      await this.runMigrations();

      logger.info('✅ Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async runMigrations() {
    logger.info('Running database migrations...');

    // Create endpoints table
    await this.run(`
      CREATE TABLE IF NOT EXISTS endpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain TEXT NOT NULL DEFAULT 'celestia',
        kind TEXT NOT NULL CHECK(kind IN ('rpc', 'grpc')),
        url TEXT NOT NULL,
        is_archival INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chain, kind, url)
      )
    `);

    // Create latency_runs table
    await this.run(`
      CREATE TABLE IF NOT EXISTS latency_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint_id INTEGER NOT NULL,
        region TEXT NOT NULL,
        ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    // Create indexes for performance
    await this.run('CREATE INDEX IF NOT EXISTS idx_endpoints_url ON endpoints(url)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_endpoints_kind ON endpoints(kind)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_latency_runs_endpoint ON latency_runs(endpoint_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_latency_runs_region ON latency_runs(region)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_latency_runs_ts ON latency_runs(ts DESC)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_latency_runs_reachable ON latency_runs(reachable)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_latency_runs_composite ON latency_runs(endpoint_id, region, ts DESC)');

    logger.info('✅ Migrations completed');
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          logger.error('Error closing database:', err);
        } else {
          logger.info('Database connection closed');
        }
      });
    }
  }
}

module.exports = new Database();
