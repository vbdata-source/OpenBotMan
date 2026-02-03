/**
 * Claude CLI Provider Adapter
 * 
 * Wraps the existing ClaudeCliProvider to conform to the LLMProvider interface.
 * This allows it to be used interchangeably with API-based providers.
 */

import { BaseProvider, type ProviderConfig, type ProviderOptions, type ProviderResponse } from './base-provider.js';
import { ClaudeCliProvider, type ClaudeCliProviderOptions } from './claude-cli.js';

/**
 * Claude CLI-specific configuration
 */
export interface ClaudeCliAdapterConfig extends ProviderConfig {
  provider: 'claude-cli';
  /** Path to claude CLI command */
  command?: string;
  /** Working directory */
  cwd?: string;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Claude CLI Provider Adapter
 * 
 * Adapts the existing ClaudeCliProvider to the LLMProvider interface.
 */
export class ClaudeCliAdapter extends BaseProvider {
  private cliProvider: ClaudeCliProvider | null = null;
  private command: string;
  private cwd?: string;
  private verbose: boolean;
  
  constructor(config: ClaudeCliAdapterConfig) {
    super(config);
    this.command = config.command ?? 'claude';
    this.cwd = config.cwd;
    this.verbose = config.verbose ?? false;
  }
  
  async send(prompt: string, options?: ProviderOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const mergedOptions = this.mergeOptions(options);
    
    // Build CLI options
    const cliOptions: ClaudeCliProviderOptions = {
      command: this.command,
      model: this.config.model,
      systemPrompt: mergedOptions.systemPrompt,
      maxTurns: 1, // Single turn for discussion
      timeoutMs: mergedOptions.timeoutMs ?? 120000,
      cwd: this.cwd ?? process.cwd(),
      verbose: this.verbose,
      tools: [], // Disable tools for discussion
    };
    
    // Create new provider for each request (stateless)
    this.cliProvider = new ClaudeCliProvider(cliOptions);
    
    try {
      const response = await this.cliProvider.send(prompt);
      const durationMs = Date.now() - startTime;
      
      return {
        text: response.text,
        model: this.config.model,
        provider: 'claude-cli',
        costUsd: response.costUsd,
        durationMs: response.durationMs ?? durationMs,
        sessionId: response.sessionId,
        isError: response.isError,
        usage: response.rawMessages ? {
          // Estimate from raw messages if available
          inputTokens: response.rawMessages.reduce((sum, m) => 
            sum + (m.message?.usage?.input_tokens ?? 0), 0),
          outputTokens: response.rawMessages.reduce((sum, m) => 
            sum + (m.message?.usage?.output_tokens ?? 0), 0),
        } : undefined,
        raw: response,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      if (error instanceof Error) {
        return this.createErrorResponse(error, durationMs);
      }
      
      return this.createErrorResponse('Unknown error occurred', durationMs);
    }
  }
  
  async isAvailable(): Promise<boolean> {
    return ClaudeCliProvider.isAvailable(this.command);
  }
  
  protected getProviderLabel(): string {
    return 'CLI';
  }
  
  /**
   * Abort current operation
   */
  abort(): void {
    if (this.cliProvider) {
      this.cliProvider.abort();
    }
  }
}

/**
 * Factory function to create Claude CLI adapter
 */
export function createClaudeCliAdapter(
  model = 'claude-sonnet-4-20250514',
  options?: Partial<ClaudeCliAdapterConfig>
): ClaudeCliAdapter {
  return new ClaudeCliAdapter({
    provider: 'claude-cli',
    model,
    ...options,
  });
}
