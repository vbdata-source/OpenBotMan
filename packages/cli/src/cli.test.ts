/**
 * CLI Integration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock external modules before importing CLI
vi.mock('@openbotman/orchestrator', () => ({
  Orchestrator: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue('Mock response'),
    getStatus: vi.fn().mockReturnValue({
      uptime: 100,
      tokens: 500,
      tasks: { total: 5, active: 1, pending: 0 },
      discussions: 0,
      agents: [
        { id: 'mock_agent', role: 'coder', status: 'idle', tasks: 3 },
      ],
    }),
    reset: vi.fn(),
    runWorkflow: vi.fn().mockResolvedValue({ result: 'workflow complete' }),
  })),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(`
orchestrator:
  model: claude-sonnet-4-20250514
  maxIterations: 10
knowledgeBase:
  enabled: true
  storagePath: /data/kb
  autoLearn: true
agents:
  - id: mock_agent
    name: Mock Agent
    role: coder
    provider: anthropic
    model: claude-sonnet-4-20250514
    enabled: true
    systemPrompt: Test prompt
    capabilities:
      code: true
      review: true
      filesystem: false
      shell: false
      web: false
      mcp: false
      discussion: true
      decisions: true
workflows:
  - id: test_workflow
    name: Test Workflow
    description: A test workflow
    steps:
      - id: step1
        name: Step 1
        role: coder
        task: Do something
qualityGates: []
`),
  writeFileSync: vi.fn(),
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ message: 'exit' }),
  },
}));

// Mock ora
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('CLI Module', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalArgv: string[];
  
  beforeEach(() => {
    originalEnv = { ...process.env };
    originalArgv = [...process.argv];
    process.env['ANTHROPIC_API_KEY'] = 'test-api-key';
    vi.resetModules();
  });
  
  afterEach(() => {
    process.env = originalEnv;
    process.argv = originalArgv;
    vi.clearAllMocks();
  });

  describe('Configuration Loading', () => {
    it('should load config from default path', async () => {
      const { loadConfig } = await import('./utils/config.js');
      const fs = await import('fs');
      
      const config = loadConfig('config.yaml');
      
      expect(fs.existsSync).toHaveBeenCalledWith('config.yaml');
      expect(fs.readFileSync).toHaveBeenCalledWith('config.yaml', 'utf-8');
      expect(config.model).toBe('claude-sonnet-4-20250514');
    });

    it('should parse agents from config', async () => {
      const { loadConfig } = await import('./utils/config.js');
      
      const config = loadConfig('config.yaml');
      
      expect(config.agents).toHaveLength(1);
      expect(config.agents[0].id).toBe('mock_agent');
      expect(config.agents[0].role).toBe('coder');
      expect(config.agents[0].capabilities.code).toBe(true);
    });

    it('should parse workflows from config', async () => {
      const { loadConfig } = await import('./utils/config.js');
      
      const config = loadConfig('config.yaml');
      
      expect(config.workflows).toHaveLength(1);
      expect(config.workflows[0].id).toBe('test_workflow');
      expect(config.workflows[0].steps).toHaveLength(1);
    });
  });

  describe('Orchestrator Integration', () => {
    it('should create orchestrator with config', async () => {
      const { Orchestrator } = await import('@openbotman/orchestrator');
      const { loadConfig } = await import('./utils/config.js');
      
      const config = loadConfig('config.yaml');
      const orchestrator = new Orchestrator(config);
      
      expect(Orchestrator).toHaveBeenCalledWith(config);
      expect(orchestrator).toBeDefined();
    });

    it('should call chat method on orchestrator', async () => {
      const { Orchestrator } = await import('@openbotman/orchestrator');
      const { loadConfig } = await import('./utils/config.js');
      
      const config = loadConfig('config.yaml');
      const orchestrator = new Orchestrator(config);
      
      const response = await orchestrator.chat('Hello');
      
      expect(orchestrator.chat).toHaveBeenCalledWith('Hello');
      expect(response).toBe('Mock response');
    });

    it('should get status from orchestrator', async () => {
      const { Orchestrator } = await import('@openbotman/orchestrator');
      const { loadConfig } = await import('./utils/config.js');
      
      const config = loadConfig('config.yaml');
      const orchestrator = new Orchestrator(config);
      
      const status = orchestrator.getStatus();
      
      expect(status.uptime).toBe(100);
      expect(status.tokens).toBe(500);
      expect(status.agents).toHaveLength(1);
    });

    it('should reset orchestrator session', async () => {
      const { Orchestrator } = await import('@openbotman/orchestrator');
      const { loadConfig } = await import('./utils/config.js');
      
      const config = loadConfig('config.yaml');
      const orchestrator = new Orchestrator(config);
      
      orchestrator.reset();
      
      expect(orchestrator.reset).toHaveBeenCalled();
    });

    it('should run workflow through orchestrator', async () => {
      const { Orchestrator } = await import('@openbotman/orchestrator');
      const { loadConfig } = await import('./utils/config.js');
      
      const config = loadConfig('config.yaml');
      const orchestrator = new Orchestrator(config);
      
      const result = await orchestrator.runWorkflow('test_workflow', { task: 'test' });
      
      expect(orchestrator.runWorkflow).toHaveBeenCalledWith('test_workflow', { task: 'test' });
      expect(result).toEqual({ result: 'workflow complete' });
    });
  });

  describe('UI Components', () => {
    it('should format responses with code blocks', async () => {
      const { formatResponse } = await import('./commands/chat.js');
      
      const input = 'Here is code:\n```typescript\nconst x = 1;\n```';
      const output = formatResponse(input);
      
      expect(output).toContain('const x = 1');
    });

    it('should format status display', async () => {
      const { formatStatus } = await import('./commands/chat.js');
      
      const status = {
        uptime: 3600,
        tokens: 1000,
        tasks: { total: 10, active: 2, pending: 1 },
        discussions: 0,
        agents: [{ id: 'agent1', role: 'coder', status: 'idle', tasks: 5 }],
      };
      
      const output = formatStatus(status);
      
      expect(output).toContain('1h 0m 0s');
      expect(output).toContain('1000');
      expect(output).toContain('agent1');
    });
  });
});

describe('CLI Error Handling', () => {
  it('should handle missing config file', async () => {
    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    const { loadConfig, ConfigNotFoundError } = await import('./utils/config.js');
    
    expect(() => loadConfig('/missing/config.yaml'))
      .toThrow(ConfigNotFoundError);
  });

  it('should handle malformed YAML gracefully', async () => {
    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: : :');
    
    const { loadConfig } = await import('./utils/config.js');
    
    // YAML parser should throw on malformed input
    expect(() => loadConfig('bad.yaml')).toThrow();
  });
});
