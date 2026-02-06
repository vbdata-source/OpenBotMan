/**
 * Async Job Queue for Long-Running Discussions
 * 
 * Allows clients to start a job, poll for status, and retrieve results.
 * Includes real-time agent progress tracking.
 */

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
  responsePreview?: string; // First 100 chars of response
  fullResponse?: string; // Full response for verbose mode
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
  
  // Agent tracking
  topic?: string;
  currentRound?: number;
  maxRounds?: number;
  agents?: AgentProgress[];
  currentAgent?: string;
}

/**
 * In-memory job store
 * In production, use Redis or a database
 */
class JobStore {
  private jobs: Map<string, Job> = new Map();
  private maxJobs = 100;
  private jobTTL = 30 * 60 * 1000; // 30 minutes
  
  create(id: string, topic?: string): Job {
    // Clean up old jobs
    this.cleanup();
    
    const job: Job = {
      id,
      status: 'pending',
      topic,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.jobs.set(id, job);
    return job;
  }
  
  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }
  
  update(id: string, updates: Partial<Job>): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    
    Object.assign(job, updates, { updatedAt: new Date() });
    return job;
  }
  
  /**
   * Initialize agents for a job (with individual model/provider per agent)
   */
  initAgents(id: string, agentConfigs: Array<{ name: string; model?: string; provider?: string }>): void {
    const agents: AgentProgress[] = agentConfigs.map((config, i) => ({
      id: `agent-${i}`,
      name: config.name,
      role: this.getRoleFromName(config.name),
      status: 'waiting',
      model: config.model,
      provider: config.provider,
    }));
    
    this.update(id, { agents, currentRound: 0, maxRounds: 5 });
  }
  
  /**
   * Set agent as currently thinking
   */
  setAgentThinking(id: string, agentName: string): void {
    const job = this.jobs.get(id);
    if (!job?.agents) return;
    
    const agent = job.agents.find(a => a.name === agentName);
    if (agent) {
      agent.status = 'thinking';
      agent.startedAt = new Date();
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
    const job = this.jobs.get(id);
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
    
    this.update(id, { currentAgent: undefined });
  }
  
  /**
   * Set current round
   */
  setRound(id: string, round: number, maxRounds?: number): void {
    const job = this.jobs.get(id);
    if (!job) return;
    
    // Reset agent statuses for new round (except keeping history)
    if (job.agents && round > (job.currentRound ?? 0)) {
      for (const agent of job.agents) {
        agent.status = 'waiting';
        agent.startedAt = undefined;
        agent.completedAt = undefined;
        agent.durationMs = undefined;
      }
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
    const job = this.jobs.get(id);
    
    // Mark all agents as complete
    if (job?.agents) {
      for (const agent of job.agents) {
        if (agent.status !== 'complete') {
          agent.status = 'complete';
        }
      }
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
    const job = this.jobs.get(id);
    
    // Mark current agent as error
    if (job?.currentAgent && job.agents) {
      const agent = job.agents.find(a => a.name === job.currentAgent);
      if (agent) {
        agent.status = 'error';
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
  
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [id, job] of this.jobs) {
      const age = now - job.createdAt.getTime();
      if (age > this.jobTTL) {
        toDelete.push(id);
      }
    }
    
    for (const id of toDelete) {
      this.jobs.delete(id);
    }
    
    // Also limit total jobs
    if (this.jobs.size > this.maxJobs) {
      const sorted = [...this.jobs.entries()]
        .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
      
      const toRemove = sorted.slice(0, this.jobs.size - this.maxJobs);
      for (const [id] of toRemove) {
        this.jobs.delete(id);
      }
    }
  }
  
  list(): Job[] {
    return [...this.jobs.values()];
  }
}

// Singleton instance
export const jobStore = new JobStore();
