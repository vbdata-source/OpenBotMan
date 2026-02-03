/**
 * Orchestrator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Orchestrator } from './orchestrator.js';
import { AgentRole, LLMProvider } from '@openbotman/protocol';
import type { OrchestratorConfig, AgentDefinition, AgentCapabilities } from './types.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mocked response' }],
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

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  const testConfig: OrchestratorConfig = {
    model: 'claude-sonnet-4-20250514',
    maxIterations: 10,
    agentTimeout: 60000,
    autonomous: false,
    humanApproval: true,
    knowledgeBase: {
      enabled: false,
      storagePath: './test-kb',
      autoLearn: false,
    },
    agents: [
      createTestAgent({ id: 'architect', name: 'Test Architect', role: AgentRole.ARCHITECT }),
      createTestAgent({ id: 'coder', name: 'Test Coder', role: AgentRole.CODER }),
    ],
    workflows: [],
    qualityGates: [],
  };

  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    orchestrator = new Orchestrator(testConfig);
  });

  describe('initialization', () => {
    it('should initialize with config', () => {
      expect(orchestrator).toBeDefined();
    });

    it('should throw without API key', () => {
      delete process.env['ANTHROPIC_API_KEY'];
      expect(() => new Orchestrator(testConfig)).toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return status', () => {
      const status = orchestrator.getStatus();

      expect(status.agents).toBeDefined();
      expect(Array.isArray(status.agents)).toBe(true);
      expect(status.tasks).toBeDefined();
      expect(status.uptime).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset state', () => {
      orchestrator.reset();
      const status = orchestrator.getStatus();

      const tasks = status.tasks as { active: number };
      expect(tasks.active).toBe(0);
    });
  });
});

describe('Task Management', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    orchestrator = new Orchestrator({
      model: 'claude-sonnet-4-20250514',
      maxIterations: 10,
      agentTimeout: 60000,
      autonomous: false,
      humanApproval: true,
      knowledgeBase: { enabled: false, storagePath: './test-kb', autoLearn: false },
      agents: [createTestAgent({ id: 'coder', role: AgentRole.CODER })],
      workflows: [],
      qualityGates: [],
    });
  });

  describe('task lifecycle', () => {
    it('should track task status changes', () => {
      const status = orchestrator.getStatus();
      const tasks = status.tasks as { active: number; pending: number };
      expect(tasks.active).toBe(0);
      expect(tasks.pending).toBe(0);
    });
  });
});

describe('Discussion Engine Integration', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    orchestrator = new Orchestrator({
      model: 'claude-sonnet-4-20250514',
      maxIterations: 10,
      agentTimeout: 60000,
      autonomous: false,
      humanApproval: true,
      knowledgeBase: { enabled: false, storagePath: './test-kb', autoLearn: false },
      agents: [
        createTestAgent({ id: 'architect', role: AgentRole.ARCHITECT }),
        createTestAgent({ id: 'coder', role: AgentRole.CODER }),
      ],
      workflows: [],
      qualityGates: [],
    });
  });

  describe('createDiscussion', () => {
    it('should create a discussion room', async () => {
      const result = await orchestrator.createDiscussion({
        topic: 'Test Discussion',
        participants: ['architect', 'coder'],
        maxRounds: 3,
      });

      expect(result).toBeDefined();
    });
  });
});
