/**
 * Async Job Queue for Long-Running Discussions
 * 
 * Allows clients to start a job, poll for status, and retrieve results.
 */

export type JobStatus = 'pending' | 'running' | 'complete' | 'error' | 'timeout';

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
}

/**
 * In-memory job store
 * In production, use Redis or a database
 */
class JobStore {
  private jobs: Map<string, Job> = new Map();
  private maxJobs = 100;
  private jobTTL = 30 * 60 * 1000; // 30 minutes
  
  create(id: string): Job {
    // Clean up old jobs
    this.cleanup();
    
    const job: Job = {
      id,
      status: 'pending',
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
  
  setRunning(id: string, progress?: string): void {
    this.update(id, { status: 'running', progress });
  }
  
  setComplete(id: string, result: string, actionItems: string[], durationMs: number): void {
    this.update(id, {
      status: 'complete',
      result,
      actionItems,
      durationMs,
      completedAt: new Date(),
    });
  }
  
  setError(id: string, error: string, durationMs?: number): void {
    this.update(id, {
      status: 'error',
      error,
      durationMs,
      completedAt: new Date(),
    });
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
