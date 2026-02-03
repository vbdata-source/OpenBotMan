/**
 * Tests for Base Provider
 */

import { describe, it, expect } from 'vitest';
import { MockProvider, type ProviderResponse } from './base-provider.js';

describe('Base Provider', () => {
  describe('MockProvider', () => {
    it('should return predefined responses', async () => {
      const responses = ['Response 1', 'Response 2', 'Response 3'];
      const provider = new MockProvider({}, responses);
      
      const result1 = await provider.send('Test 1');
      expect(result1.text).toBe('Response 1');
      
      const result2 = await provider.send('Test 2');
      expect(result2.text).toBe('Response 2');
      
      const result3 = await provider.send('Test 3');
      expect(result3.text).toBe('Response 3');
    });

    it('should cycle through responses', async () => {
      const responses = ['A', 'B'];
      const provider = new MockProvider({}, responses);
      
      expect((await provider.send('1')).text).toBe('A');
      expect((await provider.send('2')).text).toBe('B');
      expect((await provider.send('3')).text).toBe('A');
    });

    it('should echo prompt if no responses set', async () => {
      const provider = new MockProvider();
      
      const result = await provider.send('Hello world');
      expect(result.text).toContain('Hello world');
      expect(result.text).toContain('Mock Response');
    });

    it('should always be available', async () => {
      const provider = new MockProvider();
      expect(await provider.isAvailable()).toBe(true);
    });

    it('should return correct provider name', () => {
      const provider = new MockProvider();
      expect(provider.getName()).toBe('mock');
    });

    it('should return correct model name', () => {
      const provider = new MockProvider({ model: 'test-model-v1' });
      expect(provider.getModel()).toBe('test-model-v1');
    });

    it('should return display name', () => {
      const provider = new MockProvider({ model: 'test-model' });
      expect(provider.getDisplayName()).toBe('test-model via Mock');
    });

    it('should include usage stats', async () => {
      const provider = new MockProvider({}, ['Test response']);
      
      const result = await provider.send('Test prompt');
      
      expect(result.usage).toBeDefined();
      expect(result.usage?.inputTokens).toBeGreaterThan(0);
      expect(result.usage?.outputTokens).toBeGreaterThan(0);
    });

    it('should track duration', async () => {
      const provider = new MockProvider({}, ['Response'], 50);
      
      const result = await provider.send('Test');
      
      expect(result.durationMs).toBeGreaterThanOrEqual(50);
    });

    it('should not be an error response', async () => {
      const provider = new MockProvider({}, ['OK']);
      
      const result = await provider.send('Test');
      
      expect(result.isError).toBe(false);
    });

    it('should reset response index', async () => {
      const responses = ['First', 'Second'];
      const provider = new MockProvider({}, responses);
      
      await provider.send('1');
      expect((await provider.send('2')).text).toBe('Second');
      
      provider.reset();
      
      expect((await provider.send('3')).text).toBe('First');
    });

    it('should allow setting new responses', async () => {
      const provider = new MockProvider({}, ['Old']);
      
      expect((await provider.send('1')).text).toBe('Old');
      
      provider.setResponses(['New 1', 'New 2']);
      
      expect((await provider.send('2')).text).toBe('New 1');
      expect((await provider.send('3')).text).toBe('New 2');
    });
  });
});
