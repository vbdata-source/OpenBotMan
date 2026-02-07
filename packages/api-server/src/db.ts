/**
 * JSON File-based Persistence for Jobs
 * 
 * Simple file storage - no native dependencies required.
 * Stores jobs in data/jobs.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export interface StoredJob {
  id: string;
  status: string;
  topic?: string;
  progress?: string;
  result?: string;
  actionItems?: string[];
  error?: string;
  currentRound?: number;
  maxRounds?: number;
  currentAgent?: string;
  durationMs?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  agents?: StoredAgent[];
}

export interface StoredAgent {
  id: string;
  name: string;
  role: string;
  status: string;
  model?: string;
  provider?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  responsePreview?: string;
  fullResponse?: string;
}

interface JobsData {
  version: number;
  jobs: StoredJob[];
}

let dbPath: string | null = null;
let jobsCache: Map<string, StoredJob> | null = null;

/**
 * Initialize the database
 */
export function initDatabase(customPath?: string): void {
  dbPath = customPath || getDefaultDbPath();
  
  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  console.log(`[DB] Using jobs file: ${dbPath}`);
  
  // Load existing jobs
  loadJobs();
  
  // Cleanup old jobs (older than 7 days)
  cleanupOldJobs();
}

/**
 * Get default database path
 */
function getDefaultDbPath(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'config.yaml'))) {
      return join(dir, 'data', 'jobs.json');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), 'data', 'jobs.json');
}

/**
 * Load jobs from file
 */
function loadJobs(): void {
  jobsCache = new Map();
  
  if (!dbPath || !existsSync(dbPath)) {
    console.log('[DB] No existing jobs file, starting fresh');
    return;
  }
  
  try {
    const content = readFileSync(dbPath, 'utf-8');
    const data: JobsData = JSON.parse(content);
    
    for (const job of data.jobs || []) {
      jobsCache.set(job.id, job);
    }
    
    console.log(`[DB] Loaded ${jobsCache.size} jobs from file`);
  } catch (error) {
    console.error('[DB] Error loading jobs file:', error);
    jobsCache = new Map();
  }
}

/**
 * Save jobs to file (debounced)
 */
let saveTimeout: NodeJS.Timeout | null = null;

function saveJobs(): void {
  // Debounce saves to avoid excessive disk writes
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(() => {
    saveJobsNow();
  }, 100);
}

function saveJobsNow(): void {
  if (!dbPath || !jobsCache) return;
  
  try {
    const data: JobsData = {
      version: 1,
      jobs: Array.from(jobsCache.values()),
    };
    
    writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[DB] Error saving jobs file:', error);
  }
}

/**
 * Cleanup jobs older than 7 days
 */
function cleanupOldJobs(): void {
  if (!jobsCache) return;
  
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let deleted = 0;
  
  for (const [id, job] of jobsCache) {
    const createdAt = new Date(job.createdAt).getTime();
    if (createdAt < cutoff) {
      jobsCache.delete(id);
      deleted++;
    }
  }
  
  if (deleted > 0) {
    console.log(`[DB] Cleaned up ${deleted} old jobs`);
    saveJobs();
  }
}

/**
 * Get a job by ID
 */
export function getJob(id: string): StoredJob | undefined {
  return jobsCache?.get(id);
}

/**
 * Save or update a job
 */
export function saveJob(job: StoredJob): void {
  if (!jobsCache) {
    jobsCache = new Map();
  }
  jobsCache.set(job.id, job);
  saveJobs();
}

/**
 * Delete a job
 */
export function deleteJob(id: string): boolean {
  const existed = jobsCache?.delete(id) ?? false;
  if (existed) {
    saveJobs();
  }
  return existed;
}

/**
 * List all jobs
 */
export function listJobs(): StoredJob[] {
  if (!jobsCache) return [];
  return Array.from(jobsCache.values()).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Force save (for shutdown)
 */
export function flushDatabase(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveJobsNow();
}
