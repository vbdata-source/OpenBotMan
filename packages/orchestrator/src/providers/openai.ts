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
 * OpenAI API response format
 */
interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
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
    
    // Build messages array - support multi-turn tool use
    let messages: Array<Record<string, unknown>>;
    if (mergedOptions.messages) {
      // Multi-turn: use provided messages (prepend system if needed)
      messages = [];
      if (mergedOptions.systemPrompt) {
        messages.push({ role: 'system', content: mergedOptions.systemPrompt });
      }
      for (const msg of mergedOptions.messages) {
        messages.push(msg as Record<string, unknown>);
      }
    } else {
      messages = [];
      if (mergedOptions.systemPrompt) {
        messages.push({ role: 'system', content: mergedOptions.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });
    }

    // Build request body
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: mergedOptions.maxTokens ?? 4096,
      temperature: mergedOptions.temperature ?? 0.7,
    };

    // Add tools if provided (OpenAI function calling format)
    if (mergedOptions.tools && mergedOptions.tools.length > 0) {
      body.tools = mergedOptions.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
    }
    
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
      const choice = data.choices[0];
      const text = choice?.message?.content ?? '';

      // Extract tool calls if present
      const rawToolCalls = choice?.message?.tool_calls;
      const toolCalls = rawToolCalls && rawToolCalls.length > 0
        ? rawToolCalls.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>,
          }))
        : undefined;

      return {
        text,
        model: data.model,
        provider: 'openai',
        durationMs,
        isError: false,
        toolCalls,
        usage: data.usage ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        raw: data,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const isLocalApi = this.baseUrl !== 'https://api.openai.com/v1';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return this.createErrorResponse('Request timed out', durationMs);
        }
        
        // Enhanced error messages for local APIs
        if (isLocalApi) {
          const localApiHint = `\n\n💡 Troubleshooting (local API at ${this.baseUrl}):\n` +
            `   • Is your local server running? (LM Studio, Ollama, vLLM, etc.)\n` +
            `   • Is a model loaded? Check the server's UI or logs.\n` +
            `   • Is the port correct? Try: curl ${this.baseUrl}/models`;
          
          // Check for common local API errors
          if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
            return this.createErrorResponse(
              `Cannot connect to local API at ${this.baseUrl}` + localApiHint,
              durationMs
            );
          }
          
          if (error.message.includes('No models loaded') || error.message.includes('model') && error.message.includes('not')) {
            return this.createErrorResponse(
              `No model loaded in local API.` + localApiHint,
              durationMs
            );
          }
          
          // Add hint to any other local API error
          return this.createErrorResponse(
            error.message + localApiHint,
            durationMs
          );
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
