/**
 * Rate Limiter for Multi-Agent Discussions
 * 
 * Based on OpenBotMan Expert Discussion (2026-02-04):
 * - Provider-specific delays
 * - Exponential backoff with jitter
 * - Instance-based (no static state)
 * - Max retry counter
 * 
 * @see discussions/2026-02-04_18-21_anfrage-rate-limiting-strategie-für-claude-cli-pro.md
 */

// Provider-specific rate limits (milliseconds between requests)
export const PROVIDER_DELAYS: Record<string, number> = {
  'claude-cli': 1500,   // Conservative: 1.5s between CLI calls
  'anthropic': 500,     // Direct API is faster
  'openai': 200,        // OpenAI allows higher rate
  'google': 200,        // Gemini also fast
  'ollama': 100,        // Local, no limit
  'mock': 0,            // Testing
};

// Default delay for unknown providers
const DEFAULT_DELAY = 1000;

// Max retries before giving up
const MAX_RETRIES = 3;

// Backoff configuration
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

/**
 * Error types for classification
 */
export enum ErrorType {
  RETRYABLE = 'retryable',      // CLI timeout, network errors
  RATE_LIMITED = 'rate_limited', // Rate limit hit
  FATAL = 'fatal',               // Auth errors, invalid config
}

/**
 * Classify an error to determine retry strategy
 */
export function classifyError(error: unknown): ErrorType {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
    return ErrorType.RATE_LIMITED;
  }
  
  if (message.includes('timeout') || message.includes('network') || message.includes('econnreset') || 
      message.includes('cli error') || message.includes('spawn')) {
    return ErrorType.RETRYABLE;
  }
  
  if (message.includes('auth') || message.includes('invalid api key') || message.includes('unauthorized')) {
    return ErrorType.FATAL;
  }
  
  // Default to retryable for unknown errors
  return ErrorType.RETRYABLE;
}

/**
 * Calculate backoff delay with jitter
 */
export function calculateBackoff(attempt: number): number {
  const exponentialDelay = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(2, attempt),
    MAX_BACKOFF_MS
  );
  // Add 10% jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate Limiter class - instance-based, not static
 */
export class RateLimiter {
  private lastRequestTime: Map<string, number> = new Map();
  private requestCounts: Map<string, number> = new Map();
  
  /**
   * Get the delay required before next request for a provider
   */
  getRequiredDelay(provider: string): number {
    const delay = PROVIDER_DELAYS[provider] ?? DEFAULT_DELAY;
    const lastTime = this.lastRequestTime.get(provider) ?? 0;
    const elapsed = Date.now() - lastTime;
    
    if (elapsed >= delay) {
      return 0;
    }
    
    return delay - elapsed;
  }
  
  /**
   * Wait for rate limit and mark request
   */
  async waitForRateLimit(provider: string): Promise<void> {
    const requiredDelay = this.getRequiredDelay(provider);
    
    if (requiredDelay > 0) {
      await sleep(requiredDelay);
    }
    
    this.lastRequestTime.set(provider, Date.now());
    this.requestCounts.set(provider, (this.requestCounts.get(provider) ?? 0) + 1);
  }
  
  /**
   * Get statistics for monitoring
   */
  getStats(): Record<string, { requests: number; lastRequest: number }> {
    const stats: Record<string, { requests: number; lastRequest: number }> = {};
    
    for (const [provider, count] of this.requestCounts) {
      stats[provider] = {
        requests: count,
        lastRequest: this.lastRequestTime.get(provider) ?? 0,
      };
    }
    
    return stats;
  }
}

/**
 * Failed question tracking
 */
export interface FailedQuestion {
  agentId: string;
  agentRole: string;
  prompt: string;
  errorType: ErrorType;
  errorMessage: string;
  retryCount: number;
  timestamp: Date;
}

/**
 * Failed Question Tracker with memory limits
 */
export class FailedQuestionTracker {
  private failedQuestions: FailedQuestion[] = [];
  private readonly maxFailed: number;
  
  constructor(maxFailed = 50) {
    this.maxFailed = maxFailed;
  }
  
  /**
   * Record a failed question
   */
  record(failed: FailedQuestion): void {
    this.failedQuestions.push(failed);
    
    // LRU cleanup - remove oldest if over limit
    if (this.failedQuestions.length > this.maxFailed) {
      this.failedQuestions.shift();
    }
  }
  
  /**
   * Get all failed questions
   */
  getAll(): FailedQuestion[] {
    return [...this.failedQuestions];
  }
  
  /**
   * Get count of failed questions
   */
  count(): number {
    return this.failedQuestions.length;
  }
  
  /**
   * Clear all tracked failures
   */
  clear(): void {
    this.failedQuestions = [];
  }
}

/**
 * Execute a function with rate limiting and retry logic
 */
export async function executeWithRateLimitAndRetry<T>(
  fn: () => Promise<T>,
  provider: string,
  rateLimiter: RateLimiter,
  options: {
    maxRetries?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait for rate limit
      await rateLimiter.waitForRateLimit(provider);
      
      // Execute the function
      return await fn();
      
    } catch (error) {
      const errorType = classifyError(error);
      
      // Fatal errors - don't retry
      if (errorType === ErrorType.FATAL) {
        throw error;
      }
      
      // Last attempt - throw
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calculate backoff
      const backoff = calculateBackoff(attempt);
      
      // Notify about retry
      if (options.onRetry) {
        options.onRetry(attempt + 1, error);
      }
      
      // Wait before retry
      await sleep(backoff);
    }
  }
  
  // Should never reach here
  throw new Error('Unexpected end of retry loop');
}

// Export singleton for simple usage (but class available for testing)
export const defaultRateLimiter = new RateLimiter();
export const defaultFailedTracker = new FailedQuestionTracker();
