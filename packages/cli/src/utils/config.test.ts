/**
 * Config Utilities Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  loadConfig, 
  normalizeConfig, 
  createDefaultConfig,
  ConfigNotFoundError 
} from './config.js';
import { AgentRole, LLMProvider } from '@openbotman/protocol';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('Config Utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('loadConfig', () => {
    it('should throw ConfigNotFoundError when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      expect(() => loadConfig('/nonexistent/config.yaml'))
        .toThrow(ConfigNotFoundError);
      expect(() => loadConfig('/nonexistent/config.yaml'))
        .toThrow('Config file not found: /nonexistent/config.yaml');
    });

    it('should load and parse valid YAML config', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
orchestrator:
  model: claude-sonnet-4-20250514
  maxIterations: 5
  autonomous: true
knowledgeBase:
  enabled: true
  storagePath: /data/kb
  autoLearn: false
agents:
  - id: test_agent
    name: Test Agent
    role: coder
    provider: anthropic
    model: claude-sonnet-4-20250514
    enabled: true
    capabilities:
      code: true
      review: false
workflows: []
qualityGates: []
`);

      const config = loadConfig('/some/config.yaml');
      
      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.maxIterations).toBe(5);
      expect(config.autonomous).toBe(true);
      expect(config.knowledgeBase.enabled).toBe(true);
      expect(config.knowledgeBase.storagePath).toBe('/data/kb');
      expect(config.knowledgeBase.autoLearn).toBe(false);
      expect(config.agents).toHaveLength(1);
      expect(config.agents[0].id).toBe('test_agent');
      expect(config.agents[0].capabilities.code).toBe(true);
    });

    it('should use default values for missing fields', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
agents: []
workflows: []
qualityGates: []
`);

      const config = loadConfig('/some/config.yaml');
      
      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.maxIterations).toBe(10);
      expect(config.agentTimeout).toBe(120000);
      expect(config.autonomous).toBe(false);
      expect(config.humanApproval).toBe(true);
    });
  });

  describe('normalizeConfig', () => {
    it('should normalize empty config with defaults', () => {
      const config = normalizeConfig({});
      
      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.maxIterations).toBe(10);
      expect(config.agentTimeout).toBe(120000);
      expect(config.autonomous).toBe(false);
      expect(config.humanApproval).toBe(true);
      expect(config.knowledgeBase.enabled).toBe(true);
      expect(config.agents).toEqual([]);
      expect(config.workflows).toEqual([]);
      expect(config.qualityGates).toEqual([]);
    });

    it('should normalize agent capabilities', () => {
      const config = normalizeConfig({
        agents: [{
          id: 'agent1',
          name: 'Agent One',
          role: 'coder',
          provider: 'anthropic',
          model: 'claude',
          enabled: true,
          capabilities: {
            code: true,
            // Other capabilities should default to false
          },
        }],
      });
      
      expect(config.agents[0].capabilities.code).toBe(true);
      expect(config.agents[0].capabilities.review).toBe(false);
      expect(config.agents[0].capabilities.filesystem).toBe(false);
      expect(config.agents[0].capabilities.discussion).toBe(true); // Default true
    });

    it('should normalize workflow with steps', () => {
      const config = normalizeConfig({
        workflows: [{
          id: 'wf1',
          name: 'Workflow 1',
          description: 'Test workflow',
          steps: [{
            id: 'step1',
            name: 'Step 1',
            role: 'coder',
            task: 'Do something',
            output: 'result',
          }],
        }],
      });
      
      expect(config.workflows).toHaveLength(1);
      expect(config.workflows[0].steps).toHaveLength(1);
      expect(config.workflows[0].steps[0].task).toBe('Do something');
    });

    it('should normalize quality gates', () => {
      const config = normalizeConfig({
        qualityGates: [{
          name: 'Coverage',
          type: 'coverage',
          threshold: 80,
          required: true,
        }],
      });
      
      expect(config.qualityGates).toHaveLength(1);
      expect(config.qualityGates[0].threshold).toBe(80);
    });
  });

  describe('createDefaultConfig', () => {
    it('should create valid default configuration', () => {
      const config = createDefaultConfig();
      
      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.maxIterations).toBe(10);
      expect(config.agentTimeout).toBe(120000);
      expect(config.agents).toHaveLength(1);
      expect(config.agents[0].id).toBe('claude_code');
      expect(config.agents[0].role).toBe(AgentRole.CODER);
      expect(config.agents[0].provider).toBe(LLMProvider.ANTHROPIC);
      expect(config.workflows).toHaveLength(1);
      expect(config.qualityGates).toHaveLength(1);
    });

    it('should create config with enabled capabilities', () => {
      const config = createDefaultConfig();
      const agent = config.agents[0];
      
      expect(agent.capabilities.code).toBe(true);
      expect(agent.capabilities.review).toBe(true);
      expect(agent.capabilities.filesystem).toBe(true);
      expect(agent.capabilities.shell).toBe(true);
      expect(agent.capabilities.web).toBe(false);
      expect(agent.capabilities.mcp).toBe(true);
    });
  });

  describe('ConfigNotFoundError', () => {
    it('should have correct name and path', () => {
      const error = new ConfigNotFoundError('/path/to/config.yaml');
      
      expect(error.name).toBe('ConfigNotFoundError');
      expect(error.path).toBe('/path/to/config.yaml');
      expect(error.message).toContain('/path/to/config.yaml');
    });
  });
});
