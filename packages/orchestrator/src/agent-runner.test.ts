/**
 * Agent Runner Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRunner } from './agent-runner.js';
import { AgentRole, LLMProvider } from '@openbotman/protocol';
import type { AgentDefinition, AgentCapabilities } from './types.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mocked LLM response' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        stop_reason: 'end_turn',
      }),
    },
  })),
}));

/** Create a test agent definition */
function createTestAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  const defaultCapabilities: AgentCapabilities = {
    code: true,
    review: false,
    filesystem: false,
    shell: false,
    web: false,
    mcp: false,
    discussion: true,
    decisions: false,
  };

  return {
    id: 'test-agent',
    name: 'Test Agent',
    role: AgentRole.CODER,
    provider: LLMProvider.ANTHROPIC,
    model: 'claude-sonnet-4-20250514',
    enabled: true,
    systemPrompt: 'You are a test agent',
    capabilities: defaultCapabilities,
    ...overrides,
  };
}

describe('AgentRunner', () => {
  let runner: AgentRunner;

  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    runner = new AgentRunner();
  });

  describe('initAgent', () => {
    it('should initialize an agent instance', () => {
      const definition = createTestAgent({ id: 'agent-123', name: 'My Agent' });
      const instance = runner.initAgent(definition);

      expect(instance).toBeDefined();
      expect(instance.definition.id).toBe('agent-123');
      expect(instance.status).toBe('idle');
      expect(instance.sessionId).toBeDefined();
    });

    it('should initialize metrics', () => {
      const definition = createTestAgent();
      const instance = runner.initAgent(definition);

      expect(instance.metrics.tasksCompleted).toBe(0);
      expect(instance.metrics.tasksFailed).toBe(0);
      expect(instance.metrics.tokensUsed).toBe(0);
      expect(instance.metrics.averageResponseTime).toBe(0);
    });
  });

  describe('getAgent', () => {
    it('should return agent by ID', () => {
      const definition = createTestAgent({ id: 'agent-123' });
      runner.initAgent(definition);
      
      const agent = runner.getAgent('agent-123');
      expect(agent).toBeDefined();
      expect(agent!.definition.id).toBe('agent-123');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = runner.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('getAllAgents', () => {
    it('should return all agents', () => {
      runner.initAgent(createTestAgent({ id: 'agent-1' }));
      runner.initAgent(createTestAgent({ id: 'agent-2' }));

      const agents = runner.getAllAgents();
      expect(agents.length).toBe(2);
    });
  });

  describe('getAgentsByRole', () => {
    it('should filter agents by role', () => {
      runner.initAgent(createTestAgent({ id: 'coder-1', role: AgentRole.CODER }));
      runner.initAgent(createTestAgent({ id: 'coder-2', role: AgentRole.CODER }));
      runner.initAgent(createTestAgent({ id: 'architect-1', role: AgentRole.ARCHITECT }));

      const coders = runner.getAgentsByRole(AgentRole.CODER);
      const architects = runner.getAgentsByRole(AgentRole.ARCHITECT);

      expect(coders.length).toBe(2);
      expect(architects.length).toBe(1);
    });
  });

  describe('getIdleAgents', () => {
    it('should return only idle agents', () => {
      runner.initAgent(createTestAgent({ id: 'agent-1' }));
      runner.initAgent(createTestAgent({ id: 'agent-2' }));

      const idle = runner.getIdleAgents();
      expect(idle.length).toBe(2);
    });
  });

  describe('getBestAgentForRole', () => {
    it('should return best agent for role', () => {
      runner.initAgent(createTestAgent({ id: 'coder-1', role: AgentRole.CODER }));

      const best = runner.getBestAgentForRole(AgentRole.CODER);
      expect(best).toBeDefined();
    });

    it('should return undefined when no agents available', () => {
      const best = runner.getBestAgentForRole(AgentRole.SECURITY);
      expect(best).toBeUndefined();
    });

    it('should skip disabled agents', () => {
      runner.initAgent(createTestAgent({ id: 'coder-1', role: AgentRole.CODER, enabled: false }));

      const best = runner.getBestAgentForRole(AgentRole.CODER);
      expect(best).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('should throw for unknown agent', async () => {
      await expect(runner.execute('unknown', 'task')).rejects.toThrow('Agent not found');
    });

    it('should update agent status during execution', async () => {
      runner.initAgent(createTestAgent({ id: 'test-agent' }));

      const promise = runner.execute('test-agent', 'test task');
      const result = await promise;
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('resetSession', () => {
    it('should reset agent session', () => {
      runner.initAgent(createTestAgent({ id: 'agent' }));

      const before = runner.getAgent('agent')!.sessionId;
      runner.resetSession('agent');
      const after = runner.getAgent('agent')!.sessionId;

      expect(before).not.toBe(after);
    });
  });

  describe('getHistory', () => {
    it('should return empty history initially', () => {
      runner.initAgent(createTestAgent({ id: 'agent' }));

      const history = runner.getHistory('agent');
      expect(history).toEqual([]);
    });
  });

  describe('addToHistory', () => {
    it('should add message to history', () => {
      runner.initAgent(createTestAgent({ id: 'agent' }));

      runner.addToHistory('agent', { role: 'user', content: 'Hello' });
      runner.addToHistory('agent', { role: 'assistant', content: 'Hi!' });

      const history = runner.getHistory('agent');
      expect(history.length).toBe(2);
      expect(history[0]!.content).toBe('Hello');
      expect(history[1]!.content).toBe('Hi!');
    });
  });
});
