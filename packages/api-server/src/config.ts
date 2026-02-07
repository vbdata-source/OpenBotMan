/**
 * Configuration Loader for API Server
 * 
 * Loads agent definitions from config.yaml with per-agent model/provider support.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

/**
 * Agent configuration from config.yaml
 */
export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  provider: 'claude-cli' | 'claude-api' | 'openai' | 'google' | 'ollama' | 'mock';
  model: string;
  systemPrompt: string;
  emoji?: string;
  color?: string;
  apiKey?: string;
  baseUrl?: string;  // For OpenAI-compatible APIs (LM Studio, vLLM, etc.)
  rateLimitDelayMs?: number;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Team configuration (agent groups)
 */
export interface TeamConfig {
  id: string;
  name: string;
  description?: string;
  agents: string[];  // Agent IDs
  default?: boolean;
  workflows?: string[];  // Workflow IDs this team handles (e.g., 'security-review', 'performance')
}

/**
 * Discussion configuration from config.yaml
 */
export interface DiscussionConfig {
  model: string;
  timeout: number;
  maxRounds: number;
  outputDir: string;
  maxContext: number;
  agents: AgentConfig[];
  teams: TeamConfig[];
}

/**
 * Full config structure (subset of config.yaml)
 */
interface ConfigFile {
  discussion?: {
    model?: string;
    timeout?: number;
    maxRounds?: number;
    outputDir?: string;
    maxContext?: number;
    agents?: Array<{
      id: string;
      name?: string;
      role: string;
      provider?: string;
      model?: string;
      systemPrompt?: string;
      emoji?: string;
      color?: string;
      apiKey?: string;
      baseUrl?: string;
      rateLimitDelayMs?: number;
      maxTokens?: number;
      temperature?: number;
    }>;
    teams?: Array<{
      id: string;
      name: string;
      description?: string;
      agents: string[];
      default?: boolean;
    }>;
  };
  orchestrator?: {
    provider?: string;
    model?: string;
  };
}

/**
 * Default agent configurations (fallback when no config.yaml)
 */
const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'analyst',
    name: 'Analyst',
    role: 'Analytiker',
    provider: 'claude-cli',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Du bist ein analytischer Experte. Analysiere Probleme tiefgehend, identifiziere Kernpunkte und Risiken. Sei kritisch aber konstruktiv.`,
  },
  {
    id: 'architect',
    name: 'Architect',
    role: 'Software-Architekt',
    provider: 'claude-cli',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Du bist ein erfahrener Software-Architekt. Bewerte Strukturen, Design Patterns und Skalierbarkeit. Schlage architektonische Verbesserungen vor.`,
  },
  {
    id: 'pragmatist',
    name: 'Pragmatist',
    role: 'Pragmatischer Entwickler',
    provider: 'claude-cli',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Du bist ein pragmatischer Entwickler. Fokussiere auf umsetzbare Lösungen, priorisiere nach Aufwand/Nutzen. Fasse zusammen und erstelle klare Action Items.`,
  },
];

/**
 * Search paths for config.yaml
 */
const CONFIG_SEARCH_PATHS = [
  process.env.OPENBOTMAN_CONFIG,
  join(process.cwd(), 'config.yaml'),
  join(process.cwd(), '..', '..', 'config.yaml'),  // From packages/api-server
  join(process.env.HOME || '', '.openbotman', 'config.yaml'),
];

/**
 * Load configuration from config.yaml
 */
export function loadConfig(): DiscussionConfig {
  // Find config file
  let configPath: string | undefined;
  for (const path of CONFIG_SEARCH_PATHS) {
    if (path && existsSync(path)) {
      configPath = path;
      break;
    }
  }

  let config: ConfigFile = {};
  
  if (configPath) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      config = YAML.parse(content) as ConfigFile;
      console.log(`[Config] Loaded from: ${configPath}`);
    } catch (error) {
      console.warn(`[Config] Could not load ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    console.log('[Config] No config.yaml found, using defaults');
  }

  // Build discussion config
  const discussion = config.discussion || {};
  const orchestrator = config.orchestrator || {};
  
  // Default model from orchestrator or fallback
  const defaultModel = discussion.model || orchestrator.model || 'claude-sonnet-4-20250514';
  const defaultProvider = (orchestrator.provider as AgentConfig['provider']) || 'claude-cli';

  // Load agents from config or use defaults
  let agents: AgentConfig[];
  
  if (discussion.agents && discussion.agents.length > 0) {
    agents = discussion.agents.map((a, i) => ({
      id: a.id || `agent-${i}`,
      name: a.name || a.id || `Agent ${i + 1}`,
      role: a.role || 'Expert',
      provider: (a.provider as AgentConfig['provider']) || defaultProvider,
      model: a.model || defaultModel,
      systemPrompt: a.systemPrompt || `Du bist ein hilfreicher Experte.`,
      emoji: a.emoji,
      color: a.color,
      apiKey: a.apiKey ? resolveEnvVar(a.apiKey) : undefined,
      baseUrl: a.baseUrl,  // For OpenAI-compatible APIs
      rateLimitDelayMs: a.rateLimitDelayMs,
      maxTokens: a.maxTokens || 4096,
      temperature: a.temperature,
    }));
    console.log(`[Config] Loaded ${agents.length} agents from config`);
  } else {
    agents = DEFAULT_AGENTS;
    console.log(`[Config] Using ${agents.length} default agents`);
  }

  // Load teams (agent groups)
  const teams: TeamConfig[] = discussion.teams?.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    agents: t.agents,
    default: t.default,
    workflows: t.workflows,  // Workflow IDs for auto-team selection
  })) || [
    // Default team: all agents
    { id: 'all', name: 'Alle Experten', agents: agents.map(a => a.id) }
  ];
  
  console.log(`[Config] Loaded ${teams.length} teams`);

  return {
    model: defaultModel,
    timeout: discussion.timeout || 60,
    maxRounds: discussion.maxRounds || 10,
    outputDir: discussion.outputDir || './discussions',
    maxContext: discussion.maxContext || 50000,
    agents,
    teams,
  };
}

/**
 * Resolve environment variable references like ${VAR_NAME}
 */
function resolveEnvVar(value: string): string {
  if (value.startsWith('${') && value.endsWith('}')) {
    const varName = value.slice(2, -1);
    const resolved = process.env[varName];
    console.log(`[Config] Resolving ${varName}: ${resolved ? '✓ found' : '✗ NOT FOUND'}`);
    return resolved || '';
  }
  return value;
}

/**
 * Get agents for a discussion (subset based on count)
 */
export function getAgentsForDiscussion(config: DiscussionConfig, count: number): AgentConfig[] {
  return config.agents.slice(0, Math.min(count, config.agents.length));
}

/**
 * Get agents for a team by team ID
 */
export function getAgentsForTeam(config: DiscussionConfig, teamId: string): AgentConfig[] {
  const team = config.teams.find(t => t.id === teamId);
  if (!team) {
    console.warn(`[Config] Team '${teamId}' not found, using all agents`);
    return config.agents;
  }
  
  const agents = team.agents
    .map(agentId => config.agents.find(a => a.id === agentId))
    .filter((a): a is AgentConfig => a !== undefined);
  
  console.log(`[Config] Team '${team.name}': ${agents.map(a => a.name).join(', ')}`);
  return agents;
}

/**
 * Get available teams
 */
export function getTeams(config: DiscussionConfig): TeamConfig[] {
  return config.teams;
}

/**
 * Get default team
 */
export function getDefaultTeam(config: DiscussionConfig): TeamConfig | undefined {
  return config.teams.find(t => t.default) || config.teams[0];
}

/**
 * Get team for a specific workflow (e.g., 'security-review', 'performance')
 * Falls back to default team if no workflow-specific team is found
 */
export function getTeamForWorkflow(config: DiscussionConfig, workflowId: string): TeamConfig | undefined {
  // Find team with this workflow
  const workflowTeam = config.teams.find(t => t.workflows?.includes(workflowId));
  if (workflowTeam) return workflowTeam;
  
  // Fallback to default team
  return getDefaultTeam(config);
}

// Singleton config instance
let cachedConfig: DiscussionConfig | null = null;

/**
 * Get config (cached)
 */
export function getConfig(): DiscussionConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Reload config (clear cache)
 */
export function reloadConfig(): DiscussionConfig {
  cachedConfig = null;
  return getConfig();
}
