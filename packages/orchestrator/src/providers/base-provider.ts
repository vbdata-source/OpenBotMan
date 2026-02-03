/**
 * Base Provider Interface
 * 
 * Abstract interface for all LLM providers.
 * Enables multi-provider support with a unified API.
 */

/**
 * Options for provider requests
 */
export interface ProviderOptions {
  /** System prompt to use */
  systemPrompt?: string;
  
  /** Maximum tokens to generate */
  maxTokens?: number;
  
  /** Temperature for sampling (0-1) */
  temperature?: number;
  
  /** Timeout in milliseconds */
  timeoutMs?: number;
  
  /** Additional provider-specific options */
  extra?: Record<string, unknown>;
}

/**
 * Response from a provider
 */
export interface ProviderResponse {
  /** Response text */
  text: string;
  
  /** Model that generated the response */
  model: string;
  
  /** Provider name */
  provider: string;
  
  /** Cost in USD (if available) */
  costUsd?: number;
  
  /** Duration in milliseconds */
  durationMs?: number;
  
  /** Token usage (if available) */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  
  /** Session ID for continuation (if supported) */
  sessionId?: string;
  
  /** Whether this is an error response */
  isError: boolean;
  
  /** Raw response data (provider-specific) */
  raw?: unknown;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Provider type */
  provider: 'claude-cli' | 'openai' | 'google' | 'ollama' | 'mock';
  
  /** Model identifier */
  model: string;
  
  /** API key (for API-based providers) */
  apiKey?: string;
  
  /** Base URL for API (optional override) */
  baseUrl?: string;
  
  /** Default options */
  defaults?: ProviderOptions;
}

/**
 * LLM Provider Interface
 * 
 * All providers must implement this interface.
 */
export interface LLMProvider {
  /**
   * Send a message and get a response
   * @param prompt - The prompt/message to send
   * @param options - Optional settings for this request
   * @returns Promise with the response
   */
  send(prompt: string, options?: ProviderOptions): Promise<ProviderResponse>;
  
  /**
   * Check if the provider is available/configured
   * @returns Promise<boolean>
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get the provider name
   * @returns Provider name string
   */
  getName(): string;
  
  /**
   * Get the model name
   * @returns Model name string
   */
  getModel(): string;
  
  /**
   * Get display string for the provider (name + model)
   * @returns Display string like "claude-sonnet-4-20250514 via CLI"
   */
  getDisplayName(): string;
}

/**
 * Abstract base class for LLM providers
 * 
 * Provides common functionality that can be shared across providers.
 */
export abstract class BaseProvider implements LLMProvider {
  protected config: ProviderConfig;
  
  constructor(config: ProviderConfig) {
    this.config = config;
  }
  
  abstract send(prompt: string, options?: ProviderOptions): Promise<ProviderResponse>;
  abstract isAvailable(): Promise<boolean>;
  
  getName(): string {
    return this.config.provider;
  }
  
  getModel(): string {
    return this.config.model;
  }
  
  getDisplayName(): string {
    const providerLabel = this.getProviderLabel();
    return `${this.config.model} via ${providerLabel}`;
  }
  
  /**
   * Get a human-readable label for the provider type
   */
  protected getProviderLabel(): string {
    switch (this.config.provider) {
      case 'claude-cli': return 'CLI';
      case 'openai': return 'API';
      case 'google': return 'API';
      case 'ollama': return 'Local';
      case 'mock': return 'Mock';
      default: return 'Unknown';
    }
  }
  
  /**
   * Merge options with defaults
   */
  protected mergeOptions(options?: ProviderOptions): ProviderOptions {
    return {
      ...this.config.defaults,
      ...options,
    };
  }
  
  /**
   * Create an error response
   */
  protected createErrorResponse(error: Error | string, durationMs?: number): ProviderResponse {
    const message = typeof error === 'string' ? error : error.message;
    return {
      text: message,
      model: this.config.model,
      provider: this.config.provider,
      isError: true,
      durationMs,
    };
  }
}

/**
 * Mock Provider for testing
 * 
 * Returns predefined responses or echoes the prompt.
 */
export class MockProvider extends BaseProvider {
  private responses: string[] = [];
  private responseIndex = 0;
  private delay: number;
  
  constructor(config?: Partial<ProviderConfig>, responses?: string[], delayMs = 100) {
    super({
      provider: 'mock',
      model: config?.model ?? 'mock-model',
      ...config,
    });
    this.responses = responses ?? [];
    this.delay = delayMs;
  }
  
  async send(prompt: string, options?: ProviderOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.delay));
    
    // Get response (cycle through if multiple, or echo prompt)
    let text: string;
    if (this.responses.length > 0) {
      text = this.responses[this.responseIndex % this.responses.length]!;
      this.responseIndex++;
    } else {
      // Echo with mock analysis
      text = `[Mock Response to: "${prompt.slice(0, 50)}..."]\n\n` +
        `This is a mock response. In production, this would be generated by ${this.config.model}.\n\n` +
        `System prompt: ${options?.systemPrompt?.slice(0, 100) ?? 'None'}...`;
    }
    
    return {
      text,
      model: this.config.model,
      provider: 'mock',
      durationMs: Date.now() - startTime,
      isError: false,
      usage: {
        inputTokens: Math.ceil(prompt.length / 4),
        outputTokens: Math.ceil(text.length / 4),
      },
    };
  }
  
  async isAvailable(): Promise<boolean> {
    return true;
  }
  
  /**
   * Set predefined responses
   */
  setResponses(responses: string[]): void {
    this.responses = responses;
    this.responseIndex = 0;
  }
  
  /**
   * Reset response index
   */
  reset(): void {
    this.responseIndex = 0;
  }
}
