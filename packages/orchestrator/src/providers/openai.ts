/**
 * OpenAI Provider
 * 
 * Integrates with OpenAI's API for GPT models.
 * Supports GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, etc.
 */

import { BaseProvider, type ProviderConfig, type ProviderOptions, type ProviderResponse } from './base-provider.js';

/**
 * OpenAI-specific configuration
 */
export interface OpenAIProviderConfig extends ProviderConfig {
  provider: 'openai';
  /** OpenAI API key */
  apiKey: string;
  /** Optional organization ID */
  organizationId?: string;
  /** Base URL (for Azure OpenAI or proxies) */
  baseUrl?: string;
}

/**
 * OpenAI API message format
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI API response format
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider extends BaseProvider {
  private apiKey: string;
  private baseUrl: string;
  private organizationId?: string;
  
  constructor(config: OpenAIProviderConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    this.organizationId = config.organizationId;
  }
  
  async send(prompt: string, options?: ProviderOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const mergedOptions = this.mergeOptions(options);
    
    // Build messages array
    const messages: OpenAIMessage[] = [];
    
    if (mergedOptions.systemPrompt) {
      messages.push({
        role: 'system',
        content: mergedOptions.systemPrompt,
      });
    }
    
    messages.push({
      role: 'user',
      content: prompt,
    });
    
    // Build request body
    const body = {
      model: this.config.model,
      messages,
      max_tokens: mergedOptions.maxTokens ?? 4096,
      temperature: mergedOptions.temperature ?? 0.7,
    };
    
    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      };
      
      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }
      
      // Make request
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        mergedOptions.timeoutMs ?? 120000
      );
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
          errorMessage = errorJson.error?.message ?? errorText;
        } catch {
          errorMessage = errorText;
        }
        throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
      }
      
      const data = await response.json() as OpenAIResponse;
      const durationMs = Date.now() - startTime;
      
      // Extract response text
      const text = data.choices[0]?.message?.content ?? '';
      
      return {
        text,
        model: data.model,
        provider: 'openai',
        durationMs,
        isError: false,
        usage: data.usage ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        raw: data,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return this.createErrorResponse('Request timed out', durationMs);
        }
        return this.createErrorResponse(error, durationMs);
      }
      
      return this.createErrorResponse('Unknown error occurred', durationMs);
    }
  }
  
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    
    try {
      // Quick check by listing models
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
  
  protected getProviderLabel(): string {
    if (this.baseUrl.includes('azure')) {
      return 'Azure';
    }
    return 'API';
  }
}

/**
 * Factory function to create OpenAI provider
 */
export function createOpenAIProvider(
  apiKey: string,
  model = 'gpt-4-turbo',
  options?: Partial<OpenAIProviderConfig>
): OpenAIProvider {
  return new OpenAIProvider({
    provider: 'openai',
    model,
    apiKey,
    ...options,
  });
}
