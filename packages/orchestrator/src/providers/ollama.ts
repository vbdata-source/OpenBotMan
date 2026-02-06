/**
 * Ollama Provider
 * 
 * Uses Ollama's local API (OpenAI-compatible endpoint).
 * Perfect for local LLMs without API costs.
 * 
 * Requires Ollama running: https://ollama.ai
 */

import type { LLMProvider, ProviderConfig, ProviderOptions, ProviderResponse } from './base-provider.js';

export interface OllamaProviderConfig extends ProviderConfig {
  provider: 'ollama';
  /** Base URL (default: http://localhost:11434) */
  baseUrl?: string;
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly model: string;
  private readonly baseUrl: string;
  private readonly defaults: ProviderOptions;

  constructor(config: OllamaProviderConfig) {
    this.model = config.model;
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.defaults = config.defaults || {};
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async send(prompt: string, options?: ProviderOptions): Promise<ProviderResponse> {
    const mergedOptions = { ...this.defaults, ...options };
    const startTime = Date.now();

    // Build messages
    const messages: Array<{ role: string; content: string }> = [];
    
    if (mergedOptions.systemPrompt) {
      messages.push({ role: 'system', content: mergedOptions.systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    // Use Ollama's chat API
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: mergedOptions.temperature ?? 0.7,
          num_predict: mergedOptions.maxTokens ?? 4096,
        },
      }),
      signal: mergedOptions.timeoutMs 
        ? AbortSignal.timeout(mergedOptions.timeoutMs)
        : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      message?: { content?: string };
      eval_count?: number;
      prompt_eval_count?: number;
    };

    const text = data.message?.content || '';
    const outputTokens = data.eval_count || Math.ceil(text.length / 4);
    const inputTokens = data.prompt_eval_count || Math.ceil(prompt.length / 4);

    return {
      text,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      metadata: {
        model: this.model,
        provider: this.name,
        durationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error('Could not list Ollama models');
    }
    const data = await response.json() as { models?: Array<{ name: string }> };
    return data.models?.map(m => m.name) || [];
  }
}
