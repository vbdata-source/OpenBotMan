/**
 * SQLite Database for Job Persistence
 * 
 * Stores jobs and agent progress so they survive server restarts.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

let db: Database.Database | null = null;

/**
 * Initialize the database
 */
export function initDatabase(dbPath?: string): Database.Database {
  if (db) return db;
  
  // Default path: data/jobs.db in project root
  const finalPath = dbPath || getDefaultDbPath();
  
  // Ensure directory exists
  const dir = dirname(finalPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  console.log(`[DB] Opening database: ${finalPath}`);
  
  db = new Database(finalPath);
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  
  // Create tables
  createTables(db);
  
  // Cleanup old jobs (older than 7 days)
  cleanupOldJobs(db);
  
  return db;
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Get default database path
 */
function getDefaultDbPath(): string {
  // Try to find project root (where config.yaml is)
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'config.yaml'))) {
      return join(dir, 'data', 'jobs.db');
    }
    dir = dirname(dir);
  }
  // Fallback to cwd
  return join(process.cwd(), 'data', 'jobs.db');
}

/**
 * Create database tables
 */
function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      topic TEXT,
      progress TEXT,
      result TEXT,
      action_items TEXT,
      error TEXT,
      current_round INTEGER,
      max_rounds INTEGER,
      current_agent TEXT,
      duration_ms INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS job_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      model TEXT,
      provider TEXT,
      started_at TEXT,
      completed_at TEXT,
      duration_ms INTEGER,
      response_preview TEXT,
      full_response TEXT,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_job_agents_job_id ON job_agents(job_id);
  `);
}

/**
 * Cleanup jobs older than 7 days
 */
function cleanupOldJobs(db: Database.Database): void {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = db.prepare('DELETE FROM jobs WHERE created_at < ?').run(cutoff);
  if (result.changes > 0) {
    console.log(`[DB] Cleaned up ${result.changes} old jobs`);
  }
}

/**
 * Close the database
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
