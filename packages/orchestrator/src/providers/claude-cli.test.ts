/**
 * Claude CLI Provider Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as childProcess from 'child_process';
import {
  ClaudeCliProvider,
  createClaudeCliProvider,
  claudeCliRequest,
  type ClaudeCliMessage,
} from './claude-cli.js';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock process creator
function createMockProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: { end: () => void };
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: (signal?: string) => void;
  };
  
  proc.stdin = { end: vi.fn() };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  
  return proc;
}

describe('ClaudeCliProvider', () => {
  let mockSpawn: ReturnType<typeof vi.fn>;
  let mockProcess: ReturnType<typeof createMockProcess>;
  
  beforeEach(() => {
    mockProcess = createMockProcess();
    mockSpawn = vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should use default options', () => {
      const provider = new ClaudeCliProvider();
      expect(provider).toBeInstanceOf(ClaudeCliProvider);
    });
    
    it('should accept custom options', () => {
      const provider = new ClaudeCliProvider({
        command: '/usr/bin/claude',
        model: 'claude-opus-4-5',
        maxTurns: 5,
        verbose: true,
      });
      expect(provider).toBeInstanceOf(ClaudeCliProvider);
    });
  });
  
  describe('isAvailable', () => {
    it('should return true when CLI is available', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as any);
      
      const promise = ClaudeCliProvider.isAvailable();
      
      proc.emit('close', 0);
      
      expect(await promise).toBe(true);
    });
    
    it('should return false when CLI is not available', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as any);
      
      const promise = ClaudeCliProvider.isAvailable();
      
      proc.emit('close', 1);
      
      expect(await promise).toBe(false);
    });
    
    it('should return false on spawn error', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as any);
      
      const promise = ClaudeCliProvider.isAvailable();
      
      proc.emit('error', new Error('Command not found'));
      
      expect(await promise).toBe(false);
    });
  });
  
  describe('getVersion', () => {
    it('should return version string on success', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as any);
      
      const promise = ClaudeCliProvider.getVersion();
      
      proc.stdout.emit('data', Buffer.from('1.2.3\n'));
      proc.emit('close', 0);
      
      expect(await promise).toBe('1.2.3');
    });
    
    it('should return null on error', async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as any);
      
      const promise = ClaudeCliProvider.getVersion();
      
      proc.emit('close', 1);
      
      expect(await promise).toBeNull();
    });
  });
  
  describe('send', () => {
    it('should spawn CLI with correct arguments', async () => {
      const provider = new ClaudeCliProvider({
        model: 'claude-sonnet-4-20250514',
        maxTurns: 5,
      });
      
      const promise = provider.send('Hello');
      
      // Emit a result
      const resultMsg: ClaudeCliMessage = {
        type: 'result',
        result: {
          text: 'Hi there!',
          session_id: 'test-session-123',
        },
      };
      mockProcess.stdout.emit('data', JSON.stringify(resultMsg) + '\n');
      mockProcess.emit('close', 0);
      
      await promise;
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '--print',
          '--output-format', 'stream-json',
          '--model', 'claude-sonnet-4-20250514',
          '--max-turns', '5',
          'Hello',
        ]),
        expect.any(Object)
      );
    });
    
    it('should parse JSON response', async () => {
      const provider = new ClaudeCliProvider();
      
      const promise = provider.send('What is 2+2?');
      
      // Emit assistant message
      const assistantMsg: ClaudeCliMessage = {
        type: 'assistant',
        session_id: 'sess-123',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: '2 + 2 = 4' },
          ],
        },
      };
      mockProcess.stdout.emit('data', JSON.stringify(assistantMsg) + '\n');
      
      // Emit result
      const resultMsg: ClaudeCliMessage = {
        type: 'result',
        result: {
          text: '2 + 2 = 4',
          session_id: 'sess-123',
          cost_usd: 0.001,
          duration_ms: 500,
          num_turns: 1,
        },
      };
      mockProcess.stdout.emit('data', JSON.stringify(resultMsg) + '\n');
      mockProcess.emit('close', 0);
      
      const response = await promise;
      
      expect(response.text).toContain('2 + 2 = 4');
      expect(response.sessionId).toBe('sess-123');
      expect(response.costUsd).toBe(0.001);
      expect(response.durationMs).toBe(500);
      expect(response.numTurns).toBe(1);
      expect(response.isError).toBe(false);
    });
    
    it('should emit text events', async () => {
      const provider = new ClaudeCliProvider();
      
      const texts: string[] = [];
      provider.on('text', (text) => texts.push(text));
      
      const promise = provider.send('Hello');
      
      const assistantMsg: ClaudeCliMessage = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello!' },
          ],
        },
      };
      mockProcess.stdout.emit('data', JSON.stringify(assistantMsg) + '\n');
      mockProcess.emit('close', 0);
      
      await promise;
      
      expect(texts).toContain('Hello!');
    });
    
    it('should emit tool events', async () => {
      const provider = new ClaudeCliProvider();
      
      const tools: Array<{ name: string; input: unknown }> = [];
      provider.on('tool', (name, input) => tools.push({ name, input }));
      
      const promise = provider.send('List files');
      
      const assistantMsg: ClaudeCliMessage = {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Bash', input: { command: 'ls -la' } },
          ],
        },
      };
      mockProcess.stdout.emit('data', JSON.stringify(assistantMsg) + '\n');
      mockProcess.emit('close', 0);
      
      await promise;
      
      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({ name: 'Bash', input: { command: 'ls -la' } });
    });
    
    it('should handle errors from CLI', async () => {
      const provider = new ClaudeCliProvider();
      
      const promise = provider.send('Hello');
      
      mockProcess.stderr.emit('data', Buffer.from('Authentication failed'));
      mockProcess.emit('close', 1);
      
      await expect(promise).rejects.toThrow('Authentication failed');
    });
    
    it('should handle spawn errors', async () => {
      const provider = new ClaudeCliProvider();
      
      const promise = provider.send('Hello');
      
      mockProcess.emit('error', new Error('Command not found'));
      
      await expect(promise).rejects.toThrow('Command not found');
    });
    
    it('should include system prompt when provided', async () => {
      const provider = new ClaudeCliProvider({
        systemPrompt: 'You are a helpful assistant.',
      });
      
      const promise = provider.send('Hello');
      
      mockProcess.emit('close', 0);
      
      try {
        await promise;
      } catch {
        // Ignore error
      }
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '--system-prompt', 'You are a helpful assistant.',
        ]),
        expect.any(Object)
      );
    });
    
    it('should include tools when provided', async () => {
      const provider = new ClaudeCliProvider({
        tools: ['Bash', 'Read', 'Edit'],
      });
      
      const promise = provider.send('Hello');
      
      mockProcess.emit('close', 0);
      
      try {
        await promise;
      } catch {
        // Ignore error
      }
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '--tools', 'Bash,Read,Edit',
        ]),
        expect.any(Object)
      );
    });
  });
  
  describe('sendStream', () => {
    it('should call onText callback for each text chunk', async () => {
      const provider = new ClaudeCliProvider();
      
      const chunks: string[] = [];
      const promise = provider.sendStream('Hello', (text) => chunks.push(text));
      
      const msg1: ClaudeCliMessage = {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Hello ' }] },
      };
      const msg2: ClaudeCliMessage = {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'world!' }] },
      };
      
      mockProcess.stdout.emit('data', JSON.stringify(msg1) + '\n');
      mockProcess.stdout.emit('data', JSON.stringify(msg2) + '\n');
      mockProcess.emit('close', 0);
      
      await promise;
      
      expect(chunks).toEqual(['Hello ', 'world!']);
    });
  });
  
  describe('continue', () => {
    it('should throw if no session exists', async () => {
      const provider = new ClaudeCliProvider();
      
      await expect(provider.continue('Continue')).rejects.toThrow('No session to continue');
    });
    
    it('should include session ID for continuation', async () => {
      const provider = new ClaudeCliProvider();
      
      // First send to establish session
      const promise1 = provider.send('Hello');
      
      const resultMsg: ClaudeCliMessage = {
        type: 'result',
        result: { session_id: 'session-abc' },
      };
      mockProcess.stdout.emit('data', JSON.stringify(resultMsg) + '\n');
      mockProcess.emit('close', 0);
      
      await promise1;
      
      // Reset mock
      mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);
      
      // Continue
      const promise2 = provider.continue('Continue');
      
      mockProcess.emit('close', 0);
      
      try {
        await promise2;
      } catch {
        // Ignore error
      }
      
      expect(mockSpawn).toHaveBeenLastCalledWith(
        'claude',
        expect.arrayContaining([
          '--resume', 'session-abc',
        ]),
        expect.any(Object)
      );
    });
  });
  
  describe('abort', () => {
    it('should kill the process', async () => {
      const provider = new ClaudeCliProvider();
      
      // Start a request but don't await
      provider.send('Hello').catch(() => {});
      
      // Give it a tick
      await new Promise(r => setTimeout(r, 0));
      
      provider.abort();
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
    
    it('should do nothing if no process', () => {
      const provider = new ClaudeCliProvider();
      
      // Should not throw
      provider.abort();
    });
  });
  
  describe('getSessionId', () => {
    it('should return undefined initially', () => {
      const provider = new ClaudeCliProvider();
      expect(provider.getSessionId()).toBeUndefined();
    });
    
    it('should return session ID after send', async () => {
      const provider = new ClaudeCliProvider();
      
      const promise = provider.send('Hello');
      
      const resultMsg: ClaudeCliMessage = {
        type: 'result',
        result: { session_id: 'my-session' },
      };
      mockProcess.stdout.emit('data', JSON.stringify(resultMsg) + '\n');
      mockProcess.emit('close', 0);
      
      await promise;
      
      expect(provider.getSessionId()).toBe('my-session');
    });
  });
  
  describe('clearSession', () => {
    it('should clear the session ID', async () => {
      const provider = new ClaudeCliProvider();
      
      const promise = provider.send('Hello');
      
      const resultMsg: ClaudeCliMessage = {
        type: 'result',
        result: { session_id: 'my-session' },
      };
      mockProcess.stdout.emit('data', JSON.stringify(resultMsg) + '\n');
      mockProcess.emit('close', 0);
      
      await promise;
      
      expect(provider.getSessionId()).toBe('my-session');
      
      provider.clearSession();
      
      expect(provider.getSessionId()).toBeUndefined();
    });
  });
  
  describe('events', () => {
    it('should emit start event', async () => {
      const provider = new ClaudeCliProvider();
      
      // Use promise to capture start event
      const startPromise = new Promise<void>((resolve) => {
        provider.on('start', () => resolve());
      });
      
      const promise = provider.send('Hello');
      
      // Start event should fire immediately when send is called
      // Give it a moment then emit close
      await Promise.race([
        startPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('start event not emitted')), 100))
      ]);
      
      mockProcess.emit('close', 0);
      
      try {
        await promise;
      } catch {
        // Ignore
      }
      
      // If we got here, start was emitted
    });
    
    it('should emit end event', async () => {
      const provider = new ClaudeCliProvider();
      
      const ends: unknown[] = [];
      provider.on('end', (response) => ends.push(response));
      
      const promise = provider.send('Hello');
      
      const resultMsg: ClaudeCliMessage = {
        type: 'result',
        result: { text: 'Hi!' },
      };
      mockProcess.stdout.emit('data', JSON.stringify(resultMsg) + '\n');
      mockProcess.emit('close', 0);
      
      await promise;
      
      expect(ends).toHaveLength(1);
      expect(ends[0]).toHaveProperty('text', 'Hi!');
    });
    
    it('should emit error event on spawn error', async () => {
      const provider = new ClaudeCliProvider();
      
      const errors: Error[] = [];
      provider.on('error', (error) => errors.push(error));
      
      const promise = provider.send('Hello');
      
      mockProcess.emit('error', new Error('Spawn failed'));
      
      await expect(promise).rejects.toThrow();
      
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toBe('Spawn failed');
    });
    
    it('should emit message event for each JSON message', async () => {
      const provider = new ClaudeCliProvider();
      
      const messages: ClaudeCliMessage[] = [];
      provider.on('message', (msg) => messages.push(msg));
      
      const promise = provider.send('Hello');
      
      const msg1: ClaudeCliMessage = { type: 'system', session_id: 'abc' };
      const msg2: ClaudeCliMessage = { type: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }] } };
      const msg3: ClaudeCliMessage = { type: 'result', result: { text: 'Hi' } };
      
      mockProcess.stdout.emit('data', JSON.stringify(msg1) + '\n');
      mockProcess.stdout.emit('data', JSON.stringify(msg2) + '\n');
      mockProcess.stdout.emit('data', JSON.stringify(msg3) + '\n');
      mockProcess.emit('close', 0);
      
      await promise;
      
      expect(messages).toHaveLength(3);
      expect(messages[0]?.type).toBe('system');
      expect(messages[1]?.type).toBe('assistant');
      expect(messages[2]?.type).toBe('result');
    });
  });
});

describe('createClaudeCliProvider', () => {
  it('should create a new provider instance', () => {
    const provider = createClaudeCliProvider({ model: 'claude-opus-4-5' });
    expect(provider).toBeInstanceOf(ClaudeCliProvider);
  });
});

describe('claudeCliRequest', () => {
  let mockProcess: ReturnType<typeof createMockProcess>;
  
  beforeEach(() => {
    mockProcess = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should return response text', async () => {
    const promise = claudeCliRequest('Hello', { model: 'claude-sonnet-4-20250514' });
    
    const resultMsg: ClaudeCliMessage = {
      type: 'result',
      result: { text: 'Hello!' },
    };
    mockProcess.stdout.emit('data', JSON.stringify(resultMsg) + '\n');
    mockProcess.emit('close', 0);
    
    expect(await promise).toBe('Hello!');
  });
});
