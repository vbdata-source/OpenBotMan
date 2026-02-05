/**
 * Claude API Provider
 * 
 * Direct Anthropic SDK integration for server deployments.
 * Use this when Claude CLI is not available (e.g., headless servers).
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, type ProviderConfig, type ProviderOptions, type ProviderResponse } from './base-provider.js';

/**
 * Claude API Provider Configuration
 */
export interface ClaudeApiProviderConfig extends ProviderConfig {
  provider: 'claude-api';
  
  /** Anthropic API key */
  apiKey: string;
  
  /** Base URL override (for proxies) */
  baseUrl?: string;
  
  /** Default max tokens */
  maxTokens?: number;
}

/**
 * Claude API Provider
 * 
 * Uses the Anthropic SDK directly for API calls.
 * More stable than CLI for production server deployments.
 */
export class ClaudeApiProvider extends BaseProvider {
  private client: Anthropic;
  private apiConfig: ClaudeApiProviderConfig;
  
  constructor(config: ClaudeApiProviderConfig) {
    super({ ...config, provider: 'claude-api' as any });
    this.apiConfig = config;
    
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }
  
  /**
   * Send a message via Anthropic API
   */
  async send(prompt: string, options?: ProviderOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const mergedOptions = this.mergeOptions(options);
    
    try {
      const response = await this.client.messages.create({
        model: this.apiConfig.model,
        max_tokens: mergedOptions.maxTokens ?? this.apiConfig.maxTokens ?? 4096,
        system: mergedOptions.systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ],
      });
      
      // Extract text from response
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');
      
      // Calculate cost (approximate)
      const inputCost = (response.usage.input_tokens / 1_000_000) * this.getInputPricePerMillion();
      const outputCost = (response.usage.output_tokens / 1_000_000) * this.getOutputPricePerMillion();
      
      return {
        text,
        model: response.model,
        provider: 'claude-api',
        costUsd: inputCost + outputCost,
        durationMs: Date.now() - startTime,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        isError: false,
        raw: response,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      if (error instanceof Anthropic.APIError) {
        return this.createErrorResponse(
          `Anthropic API error: ${error.message} (${error.status})`,
          durationMs
        );
      }
      
      return this.createErrorResponse(
        error instanceof Error ? error : String(error),
        durationMs
      );
    }
  }
  
  /**
   * Check if API is available (valid API key)
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Simple API call to verify key works
      // Using a minimal request to save tokens
      await this.client.messages.create({
        model: this.apiConfig.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        return false;
      }
      // Other errors (rate limit, etc.) mean API is reachable but busy
      return true;
    }
  }
  
  /**
   * Get provider label for display
   */
  protected getProviderLabel(): string {
    return 'API';
  }
  
  /**
   * Get input token price per million (varies by model)
   */
  private getInputPricePerMillion(): number {
    const model = this.apiConfig.model.toLowerCase();
    
    if (model.includes('opus')) return 15.0;
    if (model.includes('sonnet')) return 3.0;
    if (model.includes('haiku')) return 0.25;
    
    // Default to Sonnet pricing
    return 3.0;
  }
  
  /**
   * Get output token price per million (varies by model)
   */
  private getOutputPricePerMillion(): number {
    const model = this.apiConfig.model.toLowerCase();
    
    if (model.includes('opus')) return 75.0;
    if (model.includes('sonnet')) return 15.0;
    if (model.includes('haiku')) return 1.25;
    
    // Default to Sonnet pricing
    return 15.0;
  }
}

/**
 * Create Claude API provider with config
 */
export function createClaudeApiProvider(config: Omit<ClaudeApiProviderConfig, 'provider'>): ClaudeApiProvider {
  return new ClaudeApiProvider({ ...config, provider: 'claude-api' });
}
