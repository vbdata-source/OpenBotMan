/**
 * Async Job Queue for Long-Running Discussions
 * 
 * Stores jobs in SQLite for persistence across server restarts.
 * Includes real-time agent progress tracking.
 */

import { getDatabase } from './db.js';
import type Database from 'better-sqlite3';

export type JobStatus = 'pending' | 'running' | 'complete' | 'error' | 'timeout';

export type AgentStatus = 'waiting' | 'thinking' | 'complete' | 'error';

export interface AgentProgress {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  responsePreview?: string;
  fullResponse?: string;
  model?: string;
  provider?: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  progress?: string;
  result?: string;
  actionItems?: string[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  topic?: string;
  currentRound?: number;
  maxRounds?: number;
  agents?: AgentProgress[];
  currentAgent?: string;
}

/**
 * SQLite-backed job store
 */
class JobStore {
  private cache: Map<string, Job> = new Map();
  
  private get db(): Database.Database {
    return getDatabase();
  }
  
  /**
   * Create a new job
   */
  create(id: string, topic?: string): Job {
    const now = new Date();
    const job: Job = {
      id,
      status: 'pending',
      topic,
      createdAt: now,
      updatedAt: now,
    };
    
    // Insert into database
    this.db.prepare(`
      INSERT INTO jobs (id, status, topic, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, job.status, topic || null, now.toISOString(), now.toISOString());
    
    // Cache for fast access
    this.cache.set(id, job);
    
    return job;
  }
  
  /**
   * Get a job by ID
   */
  get(id: string): Job | undefined {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    
    // Load from database
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined;
    if (!row) return undefined;
    
    const job = this.rowToJob(row);
    
    // Load agents
    const agentRows = this.db.prepare('SELECT * FROM job_agents WHERE job_id = ? ORDER BY id').all(id) as AgentRow[];
    job.agents = agentRows.map(this.rowToAgent);
    
    // Cache it
    this.cache.set(id, job);
    
    return job;
  }
  
  /**
   * Update a job
   */
  update(id: string, updates: Partial<Job>): Job | undefined {
    const job = this.get(id);
    if (!job) return undefined;
    
    // Apply updates to cached job
    Object.assign(job, updates, { updatedAt: new Date() });
    
    // Persist to database
    this.db.prepare(`
      UPDATE jobs SET
        status = ?,
        topic = ?,
        progress = ?,
        result = ?,
        action_items = ?,
        error = ?,
        current_round = ?,
        max_rounds = ?,
        current_agent = ?,
        duration_ms = ?,
        updated_at = ?,
        completed_at = ?
      WHERE id = ?
    `).run(
      job.status,
      job.topic || null,
      job.progress || null,
      job.result || null,
      job.actionItems ? JSON.stringify(job.actionItems) : null,
      job.error || null,
      job.currentRound || null,
      job.maxRounds || null,
      job.currentAgent || null,
      job.durationMs || null,
      job.updatedAt.toISOString(),
      job.completedAt?.toISOString() || null,
      id
    );
    
    return job;
  }
  
  /**
   * Initialize agents for a job
   */
  initAgents(id: string, agentConfigs: Array<{ name: string; model?: string; provider?: string }>): void {
    const job = this.get(id);
    if (!job) return;
    
    const agents: AgentProgress[] = agentConfigs.map((config, i) => ({
      id: `agent-${i}`,
      name: config.name,
      role: this.getRoleFromName(config.name),
      status: 'waiting' as AgentStatus,
      model: config.model,
      provider: config.provider,
    }));
    
    // Delete existing agents and insert new ones
    this.db.prepare('DELETE FROM job_agents WHERE job_id = ?').run(id);
    
    const insertStmt = this.db.prepare(`
      INSERT INTO job_agents (job_id, agent_id, name, role, status, model, provider)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const agent of agents) {
      insertStmt.run(id, agent.id, agent.name, agent.role, agent.status, agent.model || null, agent.provider || null);
    }
    
    job.agents = agents;
    job.currentRound = 0;
    job.maxRounds = 5;
    
    this.update(id, { currentRound: 0, maxRounds: 5 });
  }
  
  /**
   * Set agent as currently thinking
   */
  setAgentThinking(id: string, agentName: string): void {
    const job = this.get(id);
    if (!job?.agents) return;
    
    const agent = job.agents.find(a => a.name === agentName);
    if (agent) {
      agent.status = 'thinking';
      agent.startedAt = new Date();
      
      this.db.prepare(`
        UPDATE job_agents SET status = ?, started_at = ?
        WHERE job_id = ? AND name = ?
      `).run('thinking', agent.startedAt.toISOString(), id, agentName);
    }
    
    this.update(id, { 
      currentAgent: agentName,
      progress: `${agentName} denkt nach...`
    });
  }
  
  /**
   * Set agent as complete
   */
  setAgentComplete(id: string, agentName: string, fullResponse?: string): void {
    const job = this.get(id);
    if (!job?.agents) return;
    
    const agent = job.agents.find(a => a.name === agentName);
    if (agent) {
      agent.status = 'complete';
      agent.completedAt = new Date();
      if (agent.startedAt) {
        agent.durationMs = agent.completedAt.getTime() - agent.startedAt.getTime();
      }
      if (fullResponse) {
        agent.responsePreview = fullResponse.slice(0, 100);
        agent.fullResponse = fullResponse;
      }
      
      this.db.prepare(`
        UPDATE job_agents SET 
          status = ?, 
          completed_at = ?, 
          duration_ms = ?,
          response_preview = ?,
          full_response = ?
        WHERE job_id = ? AND name = ?
      `).run(
        'complete',
        agent.completedAt.toISOString(),
        agent.durationMs || null,
        agent.responsePreview || null,
        agent.fullResponse || null,
        id,
        agentName
      );
    }
    
    this.update(id, { currentAgent: undefined });
  }
  
  /**
   * Set agent as error
   */
  setAgentError(id: string, agentName: string, errorMessage: string): void {
    const job = this.get(id);
    if (!job?.agents) return;
    
    const agent = job.agents.find(a => a.name === agentName);
    if (agent) {
      agent.status = 'error';
      agent.completedAt = new Date();
      if (agent.startedAt) {
        agent.durationMs = agent.completedAt.getTime() - agent.startedAt.getTime();
      }
      agent.responsePreview = `❌ ${errorMessage.slice(0, 80)}`;
      agent.fullResponse = errorMessage;
      
      this.db.prepare(`
        UPDATE job_agents SET 
          status = ?, 
          completed_at = ?, 
          duration_ms = ?,
          response_preview = ?,
          full_response = ?
        WHERE job_id = ? AND name = ?
      `).run(
        'error',
        agent.completedAt.toISOString(),
        agent.durationMs || null,
        agent.responsePreview,
        agent.fullResponse,
        id,
        agentName
      );
    }
    
    this.update(id, { currentAgent: undefined });
  }
  
  /**
   * Set current round
   */
  setRound(id: string, round: number, maxRounds?: number): void {
    const job = this.get(id);
    if (!job) return;
    
    // Reset agent statuses for new round
    if (job.agents && round > (job.currentRound ?? 0)) {
      for (const agent of job.agents) {
        agent.status = 'waiting';
        agent.startedAt = undefined;
        agent.completedAt = undefined;
        agent.durationMs = undefined;
      }
      
      this.db.prepare(`
        UPDATE job_agents SET 
          status = 'waiting',
          started_at = NULL,
          completed_at = NULL,
          duration_ms = NULL
        WHERE job_id = ?
      `).run(id);
    }
    
    this.update(id, { 
      currentRound: round, 
      maxRounds: maxRounds ?? job.maxRounds,
      progress: `Runde ${round}/${maxRounds ?? job.maxRounds}`
    });
  }
  
  setRunning(id: string, progress?: string): void {
    this.update(id, { status: 'running', progress });
  }
  
  setComplete(id: string, result: string, actionItems: string[], durationMs: number): void {
    const job = this.get(id);
    
    // Mark all agents as complete
    if (job?.agents) {
      for (const agent of job.agents) {
        if (agent.status !== 'complete') {
          agent.status = 'complete';
        }
      }
      
      this.db.prepare(`
        UPDATE job_agents SET status = 'complete'
        WHERE job_id = ? AND status != 'complete' AND status != 'error'
      `).run(id);
    }
    
    this.update(id, {
      status: 'complete',
      result,
      actionItems,
      durationMs,
      completedAt: new Date(),
      currentAgent: undefined,
    });
  }
  
  setError(id: string, error: string, durationMs?: number): void {
    const job = this.get(id);
    
    // Mark current agent as error
    if (job?.currentAgent && job.agents) {
      const agent = job.agents.find(a => a.name === job.currentAgent);
      if (agent) {
        agent.status = 'error';
        
        this.db.prepare(`
          UPDATE job_agents SET status = 'error'
          WHERE job_id = ? AND name = ?
        `).run(id, job.currentAgent);
      }
    }
    
    this.update(id, {
      status: 'error',
      error,
      durationMs,
      completedAt: new Date(),
      currentAgent: undefined,
    });
  }
  
  /**
   * List all jobs
   */
  list(): Job[] {
    const rows = this.db.prepare(`
      SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100
    `).all() as JobRow[];
    
    return rows.map(row => {
      const job = this.rowToJob(row);
      
      // Load agents
      const agentRows = this.db.prepare('SELECT * FROM job_agents WHERE job_id = ? ORDER BY id').all(row.id) as AgentRow[];
      job.agents = agentRows.map(this.rowToAgent);
      
      // Update cache
      this.cache.set(job.id, job);
      
      return job;
    });
  }
  
  /**
   * Delete a job
   */
  delete(id: string): boolean {
    this.cache.delete(id);
    const result = this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
    return result.changes > 0;
  }
  
  private getRoleFromName(name: string): string {
    const roles: Record<string, string> = {
      'Architect': 'System Design',
      'Security': 'Security Expert',
      'Performance': 'Performance',
      'Pragmatist': 'Practical Solutions',
      'Critic': 'Devil\'s Advocate',
      'Innovator': 'Creative Ideas',
    };
    return roles[name] || 'Expert';
  }
  
  private rowToJob(row: JobRow): Job {
    return {
      id: row.id,
      status: row.status as JobStatus,
      topic: row.topic || undefined,
      progress: row.progress || undefined,
      result: row.result || undefined,
      actionItems: row.action_items ? JSON.parse(row.action_items) : undefined,
      error: row.error || undefined,
      currentRound: row.current_round || undefined,
      maxRounds: row.max_rounds || undefined,
      currentAgent: row.current_agent || undefined,
      durationMs: row.duration_ms || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }
  
  private rowToAgent(row: AgentRow): AgentProgress {
    return {
      id: row.agent_id,
      name: row.name,
      role: row.role || 'Expert',
      status: row.status as AgentStatus,
      model: row.model || undefined,
      provider: row.provider || undefined,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      durationMs: row.duration_ms || undefined,
      responsePreview: row.response_preview || undefined,
      fullResponse: row.full_response || undefined,
    };
  }
}

// Type definitions for database rows
interface JobRow {
  id: string;
  status: string;
  topic: string | null;
  progress: string | null;
  result: string | null;
  action_items: string | null;
  error: string | null;
  current_round: number | null;
  max_rounds: number | null;
  current_agent: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface AgentRow {
  id: number;
  job_id: string;
  agent_id: string;
  name: string;
  role: string | null;
  status: string;
  model: string | null;
  provider: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  response_preview: string | null;
  full_response: string | null;
}

// Singleton instance
export const jobStore = new JobStore();
