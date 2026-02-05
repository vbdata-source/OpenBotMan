/**
 * Provider Factory
 * 
 * Creates LLM providers based on configuration.
 * Supports multiple provider types with unified creation API.
 */

import type { LLMProvider, ProviderConfig, ProviderOptions } from './base-provider.js';
import { MockProvider } from './base-provider.js';
import { ClaudeCliAdapter, type ClaudeCliAdapterConfig } from './claude-cli-adapter.js';
import { ClaudeApiProvider, type ClaudeApiProviderConfig } from './claude-api.js';
import { OpenAIProvider, type OpenAIProviderConfig } from './openai.js';
import { GoogleProvider, type GoogleProviderConfig } from './google.js';

/**
 * Options for creating a provider
 */
export interface CreateProviderOptions {
  /** Provider type */
  provider: 'claude-cli' | 'claude-api' | 'openai' | 'google' | 'ollama' | 'mock';
  
  /** Model identifier */
  model: string;
  
  /** API key (required for API-based providers) */
  apiKey?: string;
  
  /** Base URL override */
  baseUrl?: string;
  
  /** Path to CLI command (for claude-cli) */
  command?: string;
  
  /** Working directory (for claude-cli) */
  cwd?: string;
  
  /** Enable verbose output */
  verbose?: boolean;
  
  /** Default options for all requests */
  defaults?: ProviderOptions;
  
  /** Mock responses (for mock provider) */
  mockResponses?: string[];
}

/**
 * Create a provider instance
 * 
 * @param options - Provider creation options
 * @returns LLMProvider instance
 * @throws Error if provider type is not supported or required config is missing
 */
export function createProvider(options: CreateProviderOptions): LLMProvider {
  switch (options.provider) {
    case 'claude-cli': {
      const config: ClaudeCliAdapterConfig = {
        provider: 'claude-cli',
        model: options.model,
        command: options.command,
        cwd: options.cwd,
        verbose: options.verbose,
        defaults: options.defaults,
      };
      return new ClaudeCliAdapter(config);
    }
    
    case 'claude-api': {
      if (!options.apiKey) {
        throw new Error('Claude API provider requires apiKey (ANTHROPIC_API_KEY)');
      }
      const config: ClaudeApiProviderConfig = {
        provider: 'claude-api',
        model: options.model,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        defaults: options.defaults,
      };
      return new ClaudeApiProvider(config);
    }
    
    case 'openai': {
      if (!options.apiKey) {
        throw new Error('OpenAI provider requires apiKey');
      }
      const config: OpenAIProviderConfig = {
        provider: 'openai',
        model: options.model,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        defaults: options.defaults,
      };
      return new OpenAIProvider(config);
    }
    
    case 'google': {
      if (!options.apiKey) {
        throw new Error('Google provider requires apiKey');
      }
      const config: GoogleProviderConfig = {
        provider: 'google',
        model: options.model,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        defaults: options.defaults,
      };
      return new GoogleProvider(config);
    }
    
    case 'ollama': {
      // TODO: Implement Ollama provider
      throw new Error('Ollama provider not yet implemented');
    }
    
    case 'mock': {
      const config: ProviderConfig = {
        provider: 'mock',
        model: options.model,
        defaults: options.defaults,
      };
      return new MockProvider(config, options.mockResponses);
    }
    
    default:
      throw new Error(`Unsupported provider: ${options.provider}`);
  }
}

/**
 * Check if a provider is available
 * 
 * @param provider - Provider type
 * @param apiKey - API key (for API-based providers)
 * @param command - CLI command (for claude-cli)
 * @returns Promise<boolean>
 */
export async function isProviderAvailable(
  provider: CreateProviderOptions['provider'],
  apiKey?: string,
  command?: string
): Promise<boolean> {
  try {
    const instance = createProvider({
      provider,
      model: 'test',
      apiKey,
      command,
    });
    return await instance.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Get provider display name for UI
 * 
 * @param provider - Provider type
 * @returns Human-readable provider name
 */
export function getProviderDisplayName(provider: CreateProviderOptions['provider']): string {
  switch (provider) {
    case 'claude-cli': return 'Claude CLI';
    case 'claude-api': return 'Claude API';
    case 'openai': return 'OpenAI';
    case 'google': return 'Google Gemini';
    case 'ollama': return 'Ollama';
    case 'mock': return 'Mock';
    default: return 'Unknown';
  }
}
