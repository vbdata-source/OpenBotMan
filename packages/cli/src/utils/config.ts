/**
 * Configuration Utilities
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { OrchestratorConfig } from '@openbotman/orchestrator';
import { AgentRole, LLMProvider } from '@openbotman/protocol';

/**
 * Load configuration from a YAML file
 */
export function loadConfig(configPath: string): OrchestratorConfig {
  if (!existsSync(configPath)) {
    throw new ConfigNotFoundError(configPath);
  }
  
  const content = readFileSync(configPath, 'utf-8');
  const raw = parseYaml(content);
  
  return normalizeConfig(raw);
}

/**
 * Save configuration to a YAML file
 */
export function saveConfig(configPath: string, config: OrchestratorConfig): void {
  const yaml = stringifyYaml(config);
  writeFileSync(configPath, yaml, 'utf-8');
}

/**
 * Normalize raw config to OrchestratorConfig type
 */
export function normalizeConfig(raw: Record<string, unknown>): OrchestratorConfig {
  const orchestrator = raw['orchestrator'] as Record<string, unknown> ?? {};
  const kb = raw['knowledgeBase'] as Record<string, unknown> ?? {};
  const discussion = raw['discussion'] as Record<string, unknown> ?? {};
  
  // Read agents from discussion.agents (new format) or agents (old format)
  const agents = (discussion['agents'] ?? raw['agents'] ?? []) as Array<Record<string, unknown>>;
  const workflows = raw['workflows'] as Array<Record<string, unknown>> ?? [];
  const qualityGates = raw['qualityGates'] as Array<Record<string, unknown>> ?? [];
  
  return {
    model: orchestrator['model'] as string ?? 'claude-sonnet-4-20250514',
    provider: orchestrator['provider'] as 'anthropic' | 'claude-cli' | undefined,
    cli: orchestrator['cli'] as { command?: string; maxTurns?: number } | undefined,
    maxIterations: orchestrator['maxIterations'] as number ?? 10,
    agentTimeout: orchestrator['agentTimeout'] as number ?? 120000,
    autonomous: orchestrator['autonomous'] as boolean ?? false,
    humanApproval: orchestrator['humanApproval'] as boolean ?? true,
    
    knowledgeBase: {
      enabled: kb['enabled'] as boolean ?? true,
      storagePath: kb['storagePath'] as string ?? './data/knowledge',
      autoLearn: kb['autoLearn'] as boolean ?? true,
    },
    
    agents: agents.map(normalizeAgent),
    workflows: workflows.map(normalizeWorkflow),
    qualityGates: qualityGates.map(normalizeQualityGate),
  };
}

/**
 * Normalize agent definition
 */
function normalizeAgent(raw: Record<string, unknown>): OrchestratorConfig['agents'][0] {
  const caps = raw['capabilities'] as Record<string, unknown> ?? {};
  
  // Map provider string to LLMProvider enum
  const providerStr = raw['provider'] as string ?? 'claude-cli';
  let provider: LLMProvider;
  switch (providerStr) {
    case 'google': provider = LLMProvider.GOOGLE; break;
    case 'openai': provider = LLMProvider.OPENAI; break;
    case 'ollama': provider = LLMProvider.OLLAMA; break;
    case 'claude-api': provider = LLMProvider.ANTHROPIC; break;
    case 'claude-cli': 
    default: provider = LLMProvider.CLAUDE_CLI; break;
  }
  
  // Resolve ${VAR} references in apiKey
  let apiKey = raw['apiKey'] as string | undefined;
  if (apiKey?.startsWith('${') && apiKey.endsWith('}')) {
    const varName = apiKey.slice(2, -1);
    apiKey = process.env[varName];
  }
  
  return {
    id: raw['id'] as string,
    name: raw['name'] as string ?? raw['id'] as string,
    role: raw['role'] as AgentRole ?? AgentRole.CODER,
    provider,
    model: raw['model'] as string,
    cli: raw['cli'] as string | undefined,
    cliArgs: raw['cliArgs'] as string[] | undefined,
    systemPrompt: raw['systemPrompt'] as string ?? '',
    enabled: raw['enabled'] as boolean ?? true,
    maxTokens: raw['maxTokens'] as number | undefined,
    temperature: raw['temperature'] as number | undefined,
    api: (apiKey || raw['baseUrl']) ? {
      apiKey,
      baseUrl: raw['baseUrl'] as string | undefined,
    } : undefined,
    capabilities: {
      code: caps['code'] as boolean ?? false,
      review: caps['review'] as boolean ?? false,
      filesystem: caps['filesystem'] as boolean ?? false,
      shell: caps['shell'] as boolean ?? false,
      web: caps['web'] as boolean ?? false,
      mcp: caps['mcp'] as boolean ?? false,
      discussion: caps['discussion'] as boolean ?? true,
      decisions: caps['decisions'] as boolean ?? true,
    },
  };
}

/**
 * Normalize workflow definition
 */
function normalizeWorkflow(raw: Record<string, unknown>): OrchestratorConfig['workflows'][0] {
  const steps = raw['steps'] as Array<Record<string, unknown>> ?? [];
  
  return {
    id: raw['id'] as string,
    name: raw['name'] as string,
    description: raw['description'] as string ?? '',
    steps: steps.map(normalizeWorkflowStep),
  };
}

/**
 * Normalize workflow step
 */
function normalizeWorkflowStep(raw: Record<string, unknown>): OrchestratorConfig['workflows'][0]['steps'][0] {
  return {
    id: raw['id'] as string,
    name: raw['name'] as string,
    agent: raw['agent'] as string | undefined,
    role: raw['role'] as AgentRole | undefined,
    task: raw['task'] as string,
    inputs: raw['inputs'] as string[] | undefined,
    output: raw['output'] as string | undefined,
    maxIterations: raw['maxIterations'] as number | undefined,
    onFailure: raw['onFailure'] as 'abort' | 'skip' | 'retry' | undefined,
  };
}

/**
 * Normalize quality gate
 */
function normalizeQualityGate(raw: Record<string, unknown>): OrchestratorConfig['qualityGates'][0] {
  return {
    name: raw['name'] as string,
    type: raw['type'] as 'coverage' | 'complexity' | 'security' | 'performance' | 'custom',
    threshold: raw['threshold'] as number,
    required: raw['required'] as boolean ?? true,
  };
}

/**
 * Error when config file is not found
 */
export class ConfigNotFoundError extends Error {
  constructor(public path: string) {
    super(`Config file not found: ${path}`);
    this.name = 'ConfigNotFoundError';
  }
}

/**
 * Create default configuration
 */
export function createDefaultConfig(): OrchestratorConfig {
  return {
    model: 'claude-sonnet-4-20250514',
    maxIterations: 10,
    agentTimeout: 120000,
    autonomous: false,
    humanApproval: true,
    
    knowledgeBase: {
      enabled: true,
      storagePath: './data/knowledge',
      autoLearn: true,
    },
    
    agents: [
      {
        id: 'claude_code',
        name: 'Claude Code',
        role: AgentRole.CODER,
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-sonnet-4-20250514',
        systemPrompt: `You are an expert software developer.
Write clean, well-documented code.
Follow best practices and design patterns.`,
        enabled: true,
        capabilities: {
          code: true,
          review: true,
          filesystem: true,
          shell: true,
          web: false,
          mcp: true,
          discussion: true,
          decisions: true,
        },
      },
    ],
    
    workflows: [
      {
        id: 'code_review',
        name: 'Code Review Workflow',
        description: 'Full code review with multiple agents',
        steps: [
          {
            id: 'analyze',
            name: 'Analyze Code',
            role: AgentRole.CODER,
            task: 'Analyze the code structure and identify areas for review',
            output: 'analysis',
          },
        ],
      },
    ],
    
    qualityGates: [
      {
        name: 'Code Coverage',
        type: 'coverage',
        threshold: 80,
        required: true,
      },
    ],
  };
}
