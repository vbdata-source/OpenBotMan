/**
 * Tests for Provider Factory
 */

import { describe, it, expect } from 'vitest';
import { createProvider, getProviderDisplayName } from './factory.js';
import { MockProvider } from './base-provider.js';
import { ClaudeCliAdapter } from './claude-cli-adapter.js';
import { OpenAIProvider } from './openai.js';
import { GoogleProvider } from './google.js';

describe('Provider Factory', () => {
  describe('createProvider', () => {
    it('should create mock provider', () => {
      const provider = createProvider({
        provider: 'mock',
        model: 'test-model',
      });
      
      expect(provider).toBeInstanceOf(MockProvider);
      expect(provider.getName()).toBe('mock');
    });

    it('should create mock provider with responses', async () => {
      const provider = createProvider({
        provider: 'mock',
        model: 'test',
        mockResponses: ['Response A', 'Response B'],
      });
      
      const result = await provider.send('Test');
      expect(result.text).toBe('Response A');
    });

    it('should create claude-cli provider', () => {
      const provider = createProvider({
        provider: 'claude-cli',
        model: 'claude-sonnet-4-20250514',
      });
      
      expect(provider).toBeInstanceOf(ClaudeCliAdapter);
      expect(provider.getName()).toBe('claude-cli');
      expect(provider.getModel()).toBe('claude-sonnet-4-20250514');
    });

    it('should create openai provider with API key', () => {
      const provider = createProvider({
        provider: 'openai',
        model: 'gpt-4-turbo',
        apiKey: 'test-key',
      });
      
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.getName()).toBe('openai');
    });

    it('should throw if openai provider missing API key', () => {
      expect(() => createProvider({
        provider: 'openai',
        model: 'gpt-4',
      })).toThrow('OpenAI provider requires apiKey');
    });

    it('should create google provider with API key', () => {
      const provider = createProvider({
        provider: 'google',
        model: 'gemini-2.0-flash',
        apiKey: 'test-key',
      });
      
      expect(provider).toBeInstanceOf(GoogleProvider);
      expect(provider.getName()).toBe('google');
    });

    it('should throw if google provider missing API key', () => {
      expect(() => createProvider({
        provider: 'google',
        model: 'gemini-pro',
      })).toThrow('Google provider requires apiKey');
    });

    it('should throw for ollama provider (not implemented)', () => {
      expect(() => createProvider({
        provider: 'ollama',
        model: 'llama2',
      })).toThrow('Ollama provider not yet implemented');
    });

    it('should throw for unknown provider', () => {
      expect(() => createProvider({
        provider: 'unknown' as never,
        model: 'test',
      })).toThrow('Unsupported provider');
    });

    it('should pass default options to provider', async () => {
      const provider = createProvider({
        provider: 'mock',
        model: 'test',
        defaults: {
          systemPrompt: 'You are a test assistant',
          temperature: 0.5,
        },
        mockResponses: ['OK'],
      });
      
      // Options should be merged internally
      const result = await provider.send('Test');
      expect(result.isError).toBe(false);
    });

    it('should pass custom base URL to openai provider', () => {
      const provider = createProvider({
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'test-key',
        baseUrl: 'https://custom-api.example.com/v1',
      });
      
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('getProviderDisplayName', () => {
    it('should return human-readable names', () => {
      expect(getProviderDisplayName('claude-cli')).toBe('Claude CLI');
      expect(getProviderDisplayName('openai')).toBe('OpenAI');
      expect(getProviderDisplayName('google')).toBe('Google Gemini');
      expect(getProviderDisplayName('ollama')).toBe('Ollama');
      expect(getProviderDisplayName('mock')).toBe('Mock');
    });

    it('should return Unknown for invalid provider', () => {
      expect(getProviderDisplayName('invalid' as never)).toBe('Unknown');
    });
  });
});
