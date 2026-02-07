/**
 * Async Job Queue for Long-Running Discussions
 * 
 * Stores jobs in JSON file for persistence across server restarts.
 * Includes real-time agent progress tracking.
 */

import { getJob, saveJob, deleteJob as dbDeleteJob, listJobs, type StoredJob, type StoredAgent } from './db.js';

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
 * JSON file-backed job store
 */
class JobStore {
  // In-memory cache for active jobs (faster updates during processing)
  private cache: Map<string, Job> = new Map();
  
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
    
    this.cache.set(id, job);
    this.persist(job);
    
    return job;
  }
  
  /**
   * Get a job by ID
   */
  get(id: string): Job | undefined {
    // Check memory cache first
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    
    // Load from file
    const stored = getJob(id);
    if (!stored) return undefined;
    
    const job = this.storedToJob(stored);
    this.cache.set(id, job);
    
    return job;
  }
  
  /**
   * Update a job
   */
  update(id: string, updates: Partial<Job>): Job | undefined {
    const job = this.get(id);
    if (!job) return undefined;
    
    Object.assign(job, updates, { updatedAt: new Date() });
    this.persist(job);
    
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
    
    job.agents = agents;
    job.currentRound = 0;
    job.maxRounds = 5;
    
    this.persist(job);
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
    }
    
    job.currentAgent = agentName;
    job.progress = `${agentName} denkt nach...`;
    job.updatedAt = new Date();
    
    this.persist(job);
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
    }
    
    job.currentAgent = undefined;
    job.updatedAt = new Date();
    
    this.persist(job);
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
    }
    
    job.currentAgent = undefined;
    job.updatedAt = new Date();
    
    this.persist(job);
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
    }
    
    job.currentRound = round;
    job.maxRounds = maxRounds ?? job.maxRounds;
    job.progress = `Runde ${round}/${maxRounds ?? job.maxRounds}`;
    job.updatedAt = new Date();
    
    this.persist(job);
  }
  
  setRunning(id: string, progress?: string): void {
    this.update(id, { status: 'running', progress });
  }
  
  setComplete(id: string, result: string, actionItems: string[], durationMs: number): void {
    const job = this.get(id);
    if (!job) return;
    
    // Mark all agents as complete
    if (job.agents) {
      for (const agent of job.agents) {
        if (agent.status !== 'complete' && agent.status !== 'error') {
          agent.status = 'complete';
        }
      }
    }
    
    job.status = 'complete';
    job.result = result;
    job.actionItems = actionItems;
    job.durationMs = durationMs;
    job.completedAt = new Date();
    job.currentAgent = undefined;
    job.updatedAt = new Date();
    
    this.persist(job);
  }
  
  setError(id: string, error: string, durationMs?: number): void {
    const job = this.get(id);
    if (!job) return;
    
    // Mark current agent as error
    if (job.currentAgent && job.agents) {
      const agent = job.agents.find(a => a.name === job.currentAgent);
      if (agent) {
        agent.status = 'error';
      }
    }
    
    job.status = 'error';
    job.error = error;
    job.durationMs = durationMs;
    job.completedAt = new Date();
    job.currentAgent = undefined;
    job.updatedAt = new Date();
    
    this.persist(job);
  }
  
  /**
   * List all jobs
   */
  list(): Job[] {
    const storedJobs = listJobs();
    return storedJobs.map(stored => {
      // Use cached version if available (has latest state)
      if (this.cache.has(stored.id)) {
        return this.cache.get(stored.id)!;
      }
      return this.storedToJob(stored);
    });
  }
  
  /**
   * Delete a job
   */
  delete(id: string): boolean {
    this.cache.delete(id);
    return dbDeleteJob(id);
  }
  
  // ============ Private helpers ============
  
  private persist(job: Job): void {
    saveJob(this.jobToStored(job));
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
  
  private jobToStored(job: Job): StoredJob {
    return {
      id: job.id,
      status: job.status,
      topic: job.topic,
      progress: job.progress,
      result: job.result,
      actionItems: job.actionItems,
      error: job.error,
      currentRound: job.currentRound,
      maxRounds: job.maxRounds,
      currentAgent: job.currentAgent,
      durationMs: job.durationMs,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      agents: job.agents?.map(a => this.agentToStored(a)),
    };
  }
  
  private agentToStored(agent: AgentProgress): StoredAgent {
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      model: agent.model,
      provider: agent.provider,
      startedAt: agent.startedAt?.toISOString(),
      completedAt: agent.completedAt?.toISOString(),
      durationMs: agent.durationMs,
      responsePreview: agent.responsePreview,
      fullResponse: agent.fullResponse,
    };
  }
  
  private storedToJob(stored: StoredJob): Job {
    return {
      id: stored.id,
      status: stored.status as JobStatus,
      topic: stored.topic,
      progress: stored.progress,
      result: stored.result,
      actionItems: stored.actionItems,
      error: stored.error,
      currentRound: stored.currentRound,
      maxRounds: stored.maxRounds,
      currentAgent: stored.currentAgent,
      durationMs: stored.durationMs,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
      completedAt: stored.completedAt ? new Date(stored.completedAt) : undefined,
      agents: stored.agents?.map(a => this.storedToAgent(a)),
    };
  }
  
  private storedToAgent(stored: StoredAgent): AgentProgress {
    return {
      id: stored.id,
      name: stored.name,
      role: stored.role,
      status: stored.status as AgentStatus,
      model: stored.model,
      provider: stored.provider,
      startedAt: stored.startedAt ? new Date(stored.startedAt) : undefined,
      completedAt: stored.completedAt ? new Date(stored.completedAt) : undefined,
      durationMs: stored.durationMs,
      responsePreview: stored.responsePreview,
      fullResponse: stored.fullResponse,
    };
  }
}

// Singleton instance
export const jobStore = new JobStore();
