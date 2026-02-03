/**
 * Google Gemini Provider
 * 
 * Integrates with Google's Gemini API.
 * Supports Gemini Pro, Gemini 1.5 Pro, Gemini 2.0 Flash, etc.
 * 
 * API Documentation: https://ai.google.dev/gemini-api/docs
 */

import { BaseProvider, type ProviderConfig, type ProviderOptions, type ProviderResponse } from './base-provider.js';

/**
 * Google-specific configuration
 */
export interface GoogleProviderConfig extends ProviderConfig {
  provider: 'google';
  /** Google AI API key */
  apiKey: string;
  /** Base URL (for custom endpoints) */
  baseUrl?: string;
}

/**
 * Gemini API request format
 */
interface GeminiRequest {
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

/**
 * Gemini API response format
 */
interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Google Gemini Provider Implementation
 */
export class GoogleProvider extends BaseProvider {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(config: GoogleProviderConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }
  
  async send(prompt: string, options?: ProviderOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const mergedOptions = this.mergeOptions(options);
    
    // Build request body
    const request: GeminiRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: mergedOptions.maxTokens ?? 4096,
        temperature: mergedOptions.temperature ?? 0.7,
      },
    };
    
    // Add system instruction if provided
    if (mergedOptions.systemPrompt) {
      request.systemInstruction = {
        parts: [{ text: mergedOptions.systemPrompt }],
      };
    }
    
    // Safety settings - use reasonable defaults
    request.safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ];
    
    try {
      // Make request
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        mergedOptions.timeoutMs ?? 120000
      );
      
      const url = `${this.baseUrl}/models/${this.config.model}:generateContent?key=${this.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json() as GeminiResponse;
      const durationMs = Date.now() - startTime;
      
      // Check for API error
      if (data.error) {
        return this.createErrorResponse(
          `Gemini API error (${data.error.code}): ${data.error.message}`,
          durationMs
        );
      }
      
      if (!response.ok) {
        return this.createErrorResponse(
          `Gemini API error (${response.status}): ${response.statusText}`,
          durationMs
        );
      }
      
      // Extract response text
      const text = data.candidates?.[0]?.content?.parts
        ?.map(p => p.text)
        .join('') ?? '';
      
      // Check for blocked response
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY') {
        return this.createErrorResponse(
          'Response blocked by safety filters',
          durationMs
        );
      }
      
      return {
        text,
        model: this.config.model,
        provider: 'google',
        durationMs,
        isError: false,
        usage: data.usageMetadata ? {
          inputTokens: data.usageMetadata.promptTokenCount,
          outputTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
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
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        }
      );
      
      return response.ok;
    } catch {
      return false;
    }
  }
  
  protected getProviderLabel(): string {
    return 'API';
  }
}

/**
 * Factory function to create Google Gemini provider
 */
export function createGoogleProvider(
  apiKey: string,
  model = 'gemini-2.0-flash',
  options?: Partial<GoogleProviderConfig>
): GoogleProvider {
  return new GoogleProvider({
    provider: 'google',
    model,
    apiKey,
    ...options,
  });
}
