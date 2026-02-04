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

/**
 * Rate Limit Configuration
 * 
 * These are DEFAULT values - can be overridden via:
 * 1. config.yaml → rateLimiting.providers.<provider>.delayMs
 * 2. Per-agent settings → agent.rateLimitDelayMs
 */
export interface RateLimitConfig {
  providers: Record<string, number>;
  defaultDelayMs: number;
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
}

// Default configuration (can be overridden)
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  providers: {
    'claude-cli': 1500,   // Conservative: 1.5s between CLI calls
    'anthropic': 500,     // Direct API is faster
    'openai': 200,        // OpenAI allows higher rate
    'google': 200,        // Gemini also fast
    'ollama': 100,        // Local, no limit
    'mock': 0,            // Testing
  },
  defaultDelayMs: 1000,
  maxRetries: 3,
  initialBackoffMs: 2000,
  maxBackoffMs: 30000,
};

// Current active configuration (mutable, set from config.yaml)
let activeConfig: RateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG };

/**
 * Set rate limit configuration from config.yaml
 */
export function setRateLimitConfig(config: Partial<RateLimitConfig>): void {
  activeConfig = {
    ...DEFAULT_RATE_LIMIT_CONFIG,
    ...config,
    providers: {
      ...DEFAULT_RATE_LIMIT_CONFIG.providers,
      ...config.providers,
    },
  };
}

/**
 * Get current rate limit configuration
 */
export function getRateLimitConfig(): RateLimitConfig {
  return { ...activeConfig };
}

/**
 * Get delay for a specific provider (with optional per-agent override)
 */
export function getProviderDelay(provider: string, agentOverride?: number): number {
  if (agentOverride !== undefined && agentOverride >= 0) {
    return agentOverride;
  }
  return activeConfig.providers[provider] ?? activeConfig.defaultDelayMs;
}

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
  const config = getRateLimitConfig();
  const exponentialDelay = Math.min(
    config.initialBackoffMs * Math.pow(2, attempt),
    config.maxBackoffMs
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
  private agentOverrides: Map<string, number> = new Map();
  
  /**
   * Set a per-agent delay override
   */
  setAgentDelay(agentId: string, delayMs: number): void {
    this.agentOverrides.set(agentId, delayMs);
  }
  
  /**
   * Get the delay required before next request for a provider
   */
  getRequiredDelay(provider: string, agentId?: string): number {
    // Check for agent-specific override first
    const agentOverride = agentId ? this.agentOverrides.get(agentId) : undefined;
    const delay = getProviderDelay(provider, agentOverride);
    
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
  async waitForRateLimit(provider: string, agentId?: string): Promise<void> {
    const requiredDelay = this.getRequiredDelay(provider, agentId);
    
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
    agentId?: string;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const config = getRateLimitConfig();
  const maxRetries = options.maxRetries ?? config.maxRetries;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait for rate limit
      await rateLimiter.waitForRateLimit(provider, options.agentId);
      
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
