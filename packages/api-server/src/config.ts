/**
 * Configuration Loader for API Server
 * 
 * Loads agent definitions from config.yaml with per-agent model/provider support.
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
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
  promptId?: string;  // Reference to prompts[] entry
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
interface PromptConfig {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  text: string;
}

interface ConfigFile {
  discussion?: {
    model?: string;
    timeout?: number;
    maxRounds?: number;
    outputDir?: string;
    maxContext?: number;
    prompts?: PromptConfig[];
    agents?: Array<{
      id: string;
      name?: string;
      role: string;
      provider?: string;
      model?: string;
      systemPrompt?: string;
      promptId?: string;  // Reference to prompts[]
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
      workflows?: string[];
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

  // Load prompts for promptId resolution
  const prompts = new Map<string, string>();
  if (discussion.prompts && Array.isArray(discussion.prompts)) {
    for (const p of discussion.prompts) {
      if (p.id && p.text) {
        prompts.set(p.id, p.text);
      }
    }
    console.log(`[Config] Loaded ${prompts.size} prompts`);
  }

  // Load agents from config or use defaults
  let agents: AgentConfig[];
  
  if (discussion.agents && discussion.agents.length > 0) {
    agents = discussion.agents.map((a, i) => {
      // Resolve promptId to actual system prompt
      let systemPrompt = a.systemPrompt || '';
      if (a.promptId && prompts.has(a.promptId)) {
        systemPrompt = prompts.get(a.promptId) || '';
      }
      if (!systemPrompt) {
        systemPrompt = 'Du bist ein hilfreicher Experte.';
      }
      
      return {
        id: a.id || `agent-${i}`,
        name: a.name || a.id || `Agent ${i + 1}`,
        role: a.role || 'Expert',
        provider: (a.provider as AgentConfig['provider']) || defaultProvider,
        model: a.model || defaultModel,
        systemPrompt,
        promptId: a.promptId,  // Keep reference for UI
        emoji: a.emoji,
        color: a.color,
        apiKey: a.apiKey ? resolveEnvVar(a.apiKey) : undefined,
        baseUrl: a.baseUrl,  // For OpenAI-compatible APIs
        rateLimitDelayMs: a.rateLimitDelayMs,
        maxTokens: a.maxTokens || 4096,
        temperature: a.temperature,
      };
    });
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
let configFilePath: string | null = null;

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

/**
 * Find config file path
 */
function findConfigPath(): string | null {
  if (configFilePath) return configFilePath;
  
  for (const path of CONFIG_SEARCH_PATHS) {
    if (path && existsSync(path)) {
      configFilePath = path;
      return path;
    }
  }
  return null;
}

/**
 * Get raw config file content (for editing)
 */
export function getRawConfig(): { path: string; content: ConfigFile } | null {
  const path = findConfigPath();
  if (!path) return null;
  
  try {
    const content = readFileSync(path, 'utf-8');
    return { path, content: YAML.parse(content) as ConfigFile };
  } catch {
    return null;
  }
}

/**
 * Save config to file
 */
export function saveConfig(updates: {
  agents?: AgentConfig[];
  teams?: TeamConfig[];
  settings?: { maxRounds?: number; timeout?: number; maxContext?: number };
}): { success: boolean; error?: string } {
  const path = findConfigPath();
  if (!path) {
    return { success: false, error: 'Config file not found' };
  }
  
  try {
    // Load current config
    const content = readFileSync(path, 'utf-8');
    const config = YAML.parse(content) as ConfigFile;
    
    // Ensure discussion section exists
    if (!config.discussion) {
      config.discussion = {};
    }
    
    // Update agents
    if (updates.agents) {
      config.discussion.agents = updates.agents.map(a => {
        const agent = {
          id: a.id,
          name: a.name,
          role: a.role,
          provider: a.provider,
          model: a.model,
          emoji: a.emoji,
          promptId: a.promptId,
          systemPrompt: a.systemPrompt,
          color: a.color,
          apiKey: a.apiKey,
          baseUrl: a.baseUrl,
          rateLimitDelayMs: a.rateLimitDelayMs,
          maxTokens: a.maxTokens,
          temperature: a.temperature,
        };
        return agent;
      });
    }
    
    // Update teams
    if (updates.teams) {
      config.discussion.teams = updates.teams.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        agents: t.agents,
        default: t.default,
        workflows: t.workflows,
      }));
    }
    
    // Update settings
    if (updates.settings) {
      if (updates.settings.maxRounds !== undefined) {
        config.discussion.maxRounds = updates.settings.maxRounds;
      }
      if (updates.settings.timeout !== undefined) {
        config.discussion.timeout = updates.settings.timeout;
      }
      if (updates.settings.maxContext !== undefined) {
        config.discussion.maxContext = updates.settings.maxContext;
      }
    }
    
    // Write back to file
    const yamlContent = YAML.stringify(config, { indent: 2 });
    writeFileSync(path, yamlContent, 'utf-8');
    
    // Clear cache so next read gets fresh data
    cachedConfig = null;
    
    console.log(`[Config] Saved to: ${path}`);
    return { success: true };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Config] Save failed: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Full prompt config (for editing) - exported for API
 */
export interface PromptConfigFull {
  id: string;
  name: string;
  description?: string;
  category?: string;
  text: string;
}

/**
 * Get available prompts for dropdown (without text)
 */
export function getPrompts(): Array<{ id: string; name: string; description?: string; category?: string }> {
  const path = findConfigPath();
  if (!path) return [];
  
  try {
    const content = readFileSync(path, 'utf-8');
    const config = YAML.parse(content) as ConfigFile;
    
    return (config.discussion?.prompts || []).map(p => ({
      id: p.id,
      name: p.name || p.id,
      description: p.description,
      category: p.category,
    }));
  } catch {
    return [];
  }
}

/**
 * Get all prompts with full text (for editing)
 */
export function getPromptsFull(): PromptConfigFull[] {
  const path = findConfigPath();
  if (!path) return [];
  
  try {
    const content = readFileSync(path, 'utf-8');
    const config = YAML.parse(content) as ConfigFile;
    
    return (config.discussion?.prompts || []).map((p): PromptConfigFull => ({
      id: p.id,
      name: p.name ?? p.id,
      description: p.description,
      category: p.category,
      text: p.text,
    }));
  } catch {
    return [];
  }
}

/**
 * Save prompts to config file
 */
export function savePrompts(prompts: PromptConfigFull[]): { success: boolean; error?: string } {
  const path = findConfigPath();
  if (!path) {
    return { success: false, error: 'Config file not found' };
  }
  
  try {
    const content = readFileSync(path, 'utf-8');
    const config = YAML.parse(content) as ConfigFile;
    
    if (!config.discussion) {
      config.discussion = {};
    }
    
    config.discussion.prompts = prompts.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      text: p.text,
    }));
    
    const yamlContent = YAML.stringify(config, { indent: 2 });
    writeFileSync(path, yamlContent, 'utf-8');
    
    cachedConfig = null;
    console.log(`[Config] Saved ${prompts.length} prompts to: ${path}`);
    return { success: true };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Mask API key for display (show only last 4 chars)
 */
export function maskApiKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  if (key.startsWith('${')) return key; // Env var reference, show as-is
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

/**
 * Get agents with masked API keys (for frontend)
 */
export function getAgentsSafe(config: DiscussionConfig): Array<AgentConfig & { apiKeyMasked?: string }> {
  return config.agents.map(a => ({
    ...a,
    apiKey: undefined, // Don't send actual key
    apiKeyMasked: maskApiKey(a.apiKey),
  }));
}
