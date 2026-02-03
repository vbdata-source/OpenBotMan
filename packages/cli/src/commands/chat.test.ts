/**
 * Chat Command Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { formatResponse, formatStatus, showChatHelp } from './chat.js';

// Mock chalk to return plain strings for testing
vi.mock('chalk', () => ({
  default: {
    cyan: (s: string) => s,
    yellow: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    dim: (s: string) => s,
    bold: Object.assign((s: string) => s, {
      cyan: (s: string) => s,
      green: (s: string) => s,
    }),
  },
}));

describe('Chat Command', () => {
  describe('formatResponse', () => {
    it('should format code blocks', () => {
      const input = 'Here is some code:\n```javascript\nconst x = 1;\n```\nDone.';
      const output = formatResponse(input);
      
      expect(output).toContain('const x = 1;');
      expect(output).toContain('[javascript]');
    });

    it('should format code blocks without language', () => {
      const input = '```\nplain code\n```';
      const output = formatResponse(input);
      
      expect(output).toContain('plain code');
    });

    it('should format inline code', () => {
      const input = 'Use `npm install` to install dependencies.';
      const output = formatResponse(input);
      
      expect(output).toContain('npm install');
    });

    it('should handle multiple inline code segments', () => {
      const input = 'Run `npm install` then `npm start`.';
      const output = formatResponse(input);
      
      expect(output).toContain('npm install');
      expect(output).toContain('npm start');
    });

    it('should return plain text unchanged', () => {
      const input = 'This is plain text without any code.';
      const output = formatResponse(input);
      
      expect(output).toBe(input);
    });

    it('should handle mixed content', () => {
      const input = `Here's an example:
\`\`\`typescript
function hello() {
  return 'world';
}
\`\`\`

Then call it with \`hello()\`.`;
      
      const output = formatResponse(input);
      
      expect(output).toContain('[typescript]');
      expect(output).toContain('function hello()');
      expect(output).toContain('hello()');
    });
  });

  describe('formatStatus', () => {
    it('should format orchestrator status', () => {
      const status = {
        uptime: 3665, // 1h 1m 5s
        tokens: 1234,
        tasks: { total: 10, active: 2, pending: 1 },
        discussions: 0,
        agents: [
          { id: 'agent1', role: 'coder', status: 'idle', tasks: 5 },
          { id: 'agent2', role: 'reviewer', status: 'busy', tasks: 3 },
        ],
      };
      
      const output = formatStatus(status);
      
      expect(output).toContain('Orchestrator Status');
      expect(output).toContain('1h 1m 5s');
      expect(output).toContain('1234');
      expect(output).toContain('10 total');
      expect(output).toContain('2 active');
      expect(output).toContain('1 pending');
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).toContain('coder');
      expect(output).toContain('reviewer');
    });

    it('should format zero uptime', () => {
      const status = {
        uptime: 0,
        tokens: 0,
        tasks: { total: 0, active: 0, pending: 0 },
        discussions: 0,
        agents: [],
      };
      
      const output = formatStatus(status);
      
      expect(output).toContain('0h 0m 0s');
    });

    it('should format large uptime correctly', () => {
      const status = {
        uptime: 90061, // 25h 1m 1s
        tokens: 999999,
        tasks: { total: 0, active: 0, pending: 0 },
        discussions: 5,
        agents: [],
      };
      
      const output = formatStatus(status);
      
      expect(output).toContain('25h 1m 1s');
      expect(output).toContain('999999');
      expect(output).toContain('5');
    });

    it('should show agent status icons', () => {
      const status = {
        uptime: 100,
        tokens: 0,
        tasks: { total: 0, active: 0, pending: 0 },
        discussions: 0,
        agents: [
          { id: 'idle_agent', role: 'coder', status: 'idle', tasks: 0 },
          { id: 'busy_agent', role: 'coder', status: 'busy', tasks: 1 },
          { id: 'error_agent', role: 'coder', status: 'error', tasks: 0 },
        ],
      };
      
      const output = formatStatus(status);
      
      // Status indicators should be present
      expect(output).toContain('●');
      expect(output).toContain('idle_agent');
      expect(output).toContain('busy_agent');
      expect(output).toContain('error_agent');
    });
  });

  describe('showChatHelp', () => {
    it('should not throw', () => {
      // showChatHelp just logs to console, so we just verify it doesn't throw
      expect(() => showChatHelp()).not.toThrow();
    });
  });
});
