/**
 * Multi-Agent Discussion Command with Consensus
 * 
 * Runs real multi-agent discussions with iterative consensus-finding.
 * Supports multiple LLM providers and exports discussions to Markdown.
 * 
 * Features:
 * - Iterative consensus rounds with position voting
 * - Multi-provider support (Claude CLI, OpenAI, Google Gemini)
 * - Markdown export of discussions
 * - Model display per agent
 */

import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import { 
  createProvider,
  type LLMProvider,
  type ProviderResponse,
} from '@openbotman/orchestrator';
import {
  extractPosition,
  extractActionItems,
  evaluateRound,
  formatRoundStatus,
  buildProposerPrompt,
  buildResponderPrompt,
  getPositionEmoji,
  getPositionColor,
  CONSENSUS_PROTOCOL_PROMPT,
  type ConsensusContribution,
  type ConsensusResult,
  type RoundStatus,
} from './consensus.js';

// ============================================================================
// Types
// ============================================================================

export interface DiscussAgentConfig {
  id: string;
  name: string;
  role: 'coder' | 'reviewer' | 'architect' | 'planner';
  emoji: string;
  color: (text: string) => string;
  systemPrompt: string;
  provider: 'claude-cli' | 'openai' | 'google' | 'mock';
  model: string;
  apiKey?: string;
}

export interface ProjectContext {
  readme: string | null;
  packageJson: Record<string, unknown> | null;
  sourceFiles: Array<{ path: string; content: string; size: number }>;
  totalSize: number;
  projectRoot: string;
}

export interface DiscussOptions {
  topic: string;
  files?: string[];
  github?: boolean;
  agents?: number;
  timeout?: number;
  verbose?: boolean;
  model?: string;
  cwd?: string;
  config?: string;
  maxRounds?: number;
  output?: string;
  planner?: string;  // Override planner provider
  coder?: string;    // Override coder provider
  reviewer?: string; // Override reviewer provider
}

export interface DiscussionConfig {
  model?: string;
  provider?: string;
  timeout?: number;
  maxContext?: number;
  maxRounds?: number;
  outputDir?: string;
  showAgentConfig?: boolean;
  agents?: Array<{
    id: string;
    role: string;
    name: string;
    emoji: string;
    color?: string;
    systemPrompt: string;
    provider?: string;
    model?: string;
    apiKey?: string;
  }>;
}

export interface DiscussionMessage {
  agentId: string;
  agentName: string;
  role: string;
  content: string;
  timestamp: Date;
}

export interface DiscussionResult {
  topic: string;
  messages: DiscussionMessage[];
  summary: string;
  duration: number;
  consensusResult?: ConsensusResult;
  markdownPath?: string;
}

// ============================================================================
// Default Agent Configurations
// ============================================================================

const DEFAULT_AGENTS: DiscussAgentConfig[] = [
  {
    id: 'planner',
    name: 'Planner',
    role: 'architect',
    emoji: '🎯',
    color: chalk.magenta,
    provider: 'claude-cli',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Du bist ein erfahrener Software-Architekt und Planer.

DEINE ROLLE: Du erstellst und überarbeitest Vorschläge basierend auf Feedback.

DEINE PERSPEKTIVE:
- Übergeordnete Patterns und Architektur
- Skalierbarkeit und Erweiterbarkeit
- Trade-offs und Alternativen
- Langfristige Konsequenzen

DEIN STIL:
- Strukturiere Vorschläge klar
- Zeige verschiedene Optionen auf
- Gib konkrete Empfehlungen
- Adressiere Einwände konstruktiv

${CONSENSUS_PROTOCOL_PROMPT}

Antworte auf Deutsch. Max 400 Wörter.`,
  },
  {
    id: 'coder',
    name: 'Senior Developer',
    role: 'coder',
    emoji: '💻',
    color: chalk.cyan,
    provider: 'claude-cli',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Du bist ein erfahrener Software-Entwickler.

DEINE ROLLE: Du bewertest Vorschläge aus Implementierungs-Sicht.

DEINE PERSPEKTIVE:
- Implementierungs-Details und Code-Qualität
- Praktische Umsetzbarkeit
- Performance und Effizienz
- Clean Code Prinzipien

DEIN STIL:
- Pragmatisch und lösungsorientiert
- Zeige Code-Beispiele wenn sinnvoll
- Denke an Edge-Cases
- Bewerte Aufwand realistisch

${CONSENSUS_PROTOCOL_PROMPT}

Antworte auf Deutsch. Sei konkret und präzise. Max 300 Wörter.`,
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    role: 'reviewer',
    emoji: '🔍',
    color: chalk.yellow,
    provider: 'claude-cli',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Du bist ein kritischer Code-Reviewer und QA-Experte.

DEINE ROLLE: Du identifizierst Risiken und Probleme in Vorschlägen.

DEINE PERSPEKTIVE:
- Risiken und potenzielle Probleme
- Edge-Cases und Fehlerszenarien
- Security-Aspekte
- Test-Abdeckung
- Wartbarkeit

DEIN STIL:
- Konstruktiv-kritisch
- Hinterfrage Annahmen
- Denke an das Worst-Case-Szenario
- Schlage Alternativen vor

${CONSENSUS_PROTOCOL_PROMPT}

Antworte auf Deutsch. Sei kritisch aber konstruktiv. Max 300 Wörter.`,
  },
];

// ============================================================================
// Config Loading
// ============================================================================

const COLOR_MAP: Record<string, (text: string) => string> = {
  cyan: chalk.cyan,
  yellow: chalk.yellow,
  magenta: chalk.magenta,
  green: chalk.green,
  blue: chalk.blue,
  red: chalk.red,
  white: chalk.white,
  gray: chalk.gray,
};

const ROLE_EMOJI_MAP: Record<string, string> = {
  coder: '💻',
  developer: '💻',
  reviewer: '🔍',
  architect: '🎯',
  planner: '🎯',
  tester: '🧪',
};

/**
 * Load discussion config from config.yaml
 */
function loadDiscussionConfig(configPath?: string): DiscussionConfig | null {
  const paths = [
    configPath,
    'config.yaml',
    'config.yml',
    join(process.cwd(), 'config.yaml'),
  ].filter(Boolean) as string[];

  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        const config = parseYaml(content) as Record<string, unknown>;
        return config['discussion'] as DiscussionConfig | undefined ?? null;
      } catch {
        // Ignore parse errors, fall back to defaults
      }
    }
  }
  return null;
}

/**
 * Merge config agents with defaults and apply overrides
 */
function getAgentsFromConfig(
  config: DiscussionConfig | null, 
  options: DiscussOptions
): DiscussAgentConfig[] {
  let agents: DiscussAgentConfig[];
  
  if (config?.agents && config.agents.length > 0) {
    // Convert config agents to internal format
    agents = config.agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role as 'coder' | 'reviewer' | 'architect' | 'planner',
      emoji: a.emoji || ROLE_EMOJI_MAP[a.role] || '🤖',
      color: COLOR_MAP[a.color || 'white'] || chalk.white,
      systemPrompt: a.systemPrompt + '\n\n' + CONSENSUS_PROTOCOL_PROMPT,
      provider: (a.provider || 'claude-cli') as 'claude-cli' | 'openai' | 'google' | 'mock',
      model: a.model || config.model || 'claude-sonnet-4-20250514',
      apiKey: a.apiKey,
    }));
  } else {
    agents = [...DEFAULT_AGENTS];
  }
  
  // Apply provider overrides from CLI
  if (options.planner) {
    const planner = agents.find(a => a.role === 'architect' || a.role === 'planner');
    if (planner) {
      const [provider, model] = parseProviderOverride(options.planner);
      planner.provider = provider;
      if (model) planner.model = model;
    }
  }
  
  if (options.coder) {
    const coder = agents.find(a => a.role === 'coder');
    if (coder) {
      const [provider, model] = parseProviderOverride(options.coder);
      coder.provider = provider;
      if (model) coder.model = model;
    }
  }
  
  if (options.reviewer) {
    const reviewer = agents.find(a => a.role === 'reviewer');
    if (reviewer) {
      const [provider, model] = parseProviderOverride(options.reviewer);
      reviewer.provider = provider;
      if (model) reviewer.model = model;
    }
  }
  
  // Apply global model override
  if (options.model) {
    for (const agent of agents) {
      agent.model = options.model;
    }
  }
  
  // Limit agent count if specified
  const count = Math.min(options.agents || agents.length, agents.length);
  return agents.slice(0, count);
}

/**
 * Parse provider override string (e.g., "gemini" or "openai:gpt-4-turbo")
 */
function parseProviderOverride(override: string): ['claude-cli' | 'openai' | 'google' | 'mock', string?] {
  const [provider, model] = override.split(':');
  
  const providerMap: Record<string, 'claude-cli' | 'openai' | 'google' | 'mock'> = {
    'claude': 'claude-cli',
    'claude-cli': 'claude-cli',
    'openai': 'openai',
    'gpt': 'openai',
    'google': 'google',
    'gemini': 'google',
    'mock': 'mock',
  };
  
  const normalizedProvider = providerMap[provider?.toLowerCase() ?? ''] || 'claude-cli';
  
  return [normalizedProvider, model];
}

// ============================================================================
// Provider Creation
// ============================================================================

/**
 * Create an LLM provider for an agent
 */
function createAgentProvider(agent: DiscussAgentConfig, options: DiscussOptions): LLMProvider {
  // Get API key from environment if not in config
  let apiKey = agent.apiKey;
  if (!apiKey) {
    switch (agent.provider) {
      case 'openai':
        apiKey = process.env['OPENAI_API_KEY'];
        break;
      case 'google':
        apiKey = process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY'];
        break;
    }
  }
  
  return createProvider({
    provider: agent.provider,
    model: agent.model,
    apiKey,
    cwd: options.cwd || process.cwd(),
    verbose: options.verbose,
    defaults: {
      systemPrompt: agent.systemPrompt,
      timeoutMs: (options.timeout || 60) * 1000,
    },
  });
}

// ============================================================================
// Project Context Loading
// ============================================================================

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * Get relevant source files from a directory
 */
function getSourceFiles(
  dir: string,
  projectRoot: string,
  maxFiles: number = 10,
  maxTotalSize: number = 50000
): Array<{ path: string; content: string; size: number }> {
  const files: Array<{ path: string; content: string; size: number }> = [];
  let totalSize = 0;

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '__pycache__'];

  function scan(currentDir: string, depth: number = 0): void {
    if (depth > 4 || files.length >= maxFiles || totalSize >= maxTotalSize) return;

    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      
      // Prioritize certain files
      const priorityFiles = ['index.ts', 'main.ts', 'app.ts', 'cli.ts', 'orchestrator.ts'];
      
      // Sort: priority files first, then by name
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return 1;
        if (!a.isDirectory() && b.isDirectory()) return -1;
        const aIsPriority = priorityFiles.includes(a.name);
        const bIsPriority = priorityFiles.includes(b.name);
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of entries) {
        if (files.length >= maxFiles || totalSize >= maxTotalSize) break;

        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!ignoreDirs.includes(entry.name)) {
            scan(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            try {
              const stats = statSync(fullPath);
              if (stats.size > 0 && stats.size < 20000) {
                const content = readFileSync(fullPath, 'utf-8');
                const relPath = relative(projectRoot, fullPath);
                
                files.push({ path: relPath, content, size: stats.size });
                totalSize += stats.size;
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  scan(dir);
  return files;
}

/**
 * Load specific files by path
 */
function loadSpecificFiles(
  filePaths: string[],
  projectRoot: string,
  maxTotalSize: number = 50000
): Array<{ path: string; content: string; size: number }> {
  const files: Array<{ path: string; content: string; size: number }> = [];
  let totalSize = 0;

  for (const filePath of filePaths) {
    if (totalSize >= maxTotalSize) break;

    const fullPath = filePath.startsWith('/') ? filePath : join(projectRoot, filePath);
    
    try {
      if (existsSync(fullPath)) {
        const stats = statSync(fullPath);
        if (stats.isFile() && stats.size > 0 && stats.size < 30000) {
          const content = readFileSync(fullPath, 'utf-8');
          const relPath = relative(projectRoot, fullPath);
          
          files.push({ path: relPath, content, size: stats.size });
          totalSize += stats.size;
        }
      }
    } catch {
      console.warn(chalk.yellow(`⚠️  Could not read: ${filePath}`));
    }
  }

  return files;
}

/**
 * Load project context
 */
export async function loadProjectContext(
  options: DiscussOptions
): Promise<ProjectContext> {
  const cwd = options.cwd || process.cwd();
  const projectRoot = findProjectRoot(cwd);
  
  const context: ProjectContext = {
    readme: null,
    packageJson: null,
    sourceFiles: [],
    totalSize: 0,
    projectRoot,
  };

  // Load README.md
  const readmePath = join(projectRoot, 'README.md');
  if (existsSync(readmePath)) {
    try {
      const content = readFileSync(readmePath, 'utf-8');
      context.readme = content.length > 5000 ? content.slice(0, 5000) + '\n\n[... truncated]' : content;
      context.totalSize += Math.min(content.length, 5000);
    } catch {
      // Skip
    }
  }

  // Load package.json
  const pkgPath = join(projectRoot, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const content = readFileSync(pkgPath, 'utf-8');
      context.packageJson = JSON.parse(content);
      context.totalSize += content.length;
    } catch {
      // Skip
    }
  }

  // Load source files
  if (options.files && options.files.length > 0) {
    context.sourceFiles = loadSpecificFiles(options.files, projectRoot, 50000 - context.totalSize);
  } else {
    const srcDir = existsSync(join(projectRoot, 'src')) 
      ? join(projectRoot, 'src') 
      : projectRoot;
    context.sourceFiles = getSourceFiles(srcDir, projectRoot, 10, 50000 - context.totalSize);
  }

  for (const file of context.sourceFiles) {
    context.totalSize += file.size;
  }

  return context;
}

/**
 * Format project context for agents
 */
function formatContextForAgent(context: ProjectContext): string {
  const parts: string[] = [];

  if (context.packageJson) {
    const pkg = context.packageJson;
    parts.push(`## Projekt: ${pkg.name || 'Unknown'} v${pkg.version || '0.0.0'}`);
    if (pkg.description) {
      parts.push(`Beschreibung: ${pkg.description}`);
    }
    parts.push('');
  }

  if (context.readme) {
    parts.push('## README.md (Auszug)');
    parts.push(context.readme.slice(0, 2000));
    parts.push('');
  }

  if (context.sourceFiles.length > 0) {
    parts.push(`## Source Files (${context.sourceFiles.length} files, ${Math.round(context.totalSize / 1024)}KB)`);
    parts.push('');
    
    for (const file of context.sourceFiles) {
      parts.push(`### ${file.path}`);
      parts.push('```');
      const maxLen = 3000;
      parts.push(file.content.length > maxLen 
        ? file.content.slice(0, maxLen) + '\n// ... [truncated]'
        : file.content
      );
      parts.push('```');
      parts.push('');
    }
  }

  return parts.join('\n');
}

// ============================================================================
// Markdown Export
// ============================================================================

/**
 * Generate markdown export of discussion
 */
function generateMarkdown(
  topic: string,
  _agents: DiscussAgentConfig[],
  result: ConsensusResult,
  _context?: ProjectContext
): string {
  const lines: string[] = [];
  const now = new Date();
  
  // Header
  lines.push(`# Discussion: ${topic}`);
  lines.push('');
  lines.push(`**Date:** ${now.toISOString().slice(0, 16).replace('T', ' ')}`);
  lines.push(`**Participants:** ${result.participants.map(p => `${p.name} (${p.model})`).join(', ')}`);
  lines.push(`**Rounds:** ${result.totalRounds}`);
  lines.push(`**Status:** ${result.consensusReached ? '✅ CONSENSUS REACHED' : '❌ NO CONSENSUS'}`);
  lines.push(`**Duration:** ${Math.round(result.durationMs / 1000)}s`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Rounds
  for (const round of result.rounds) {
    lines.push(`## Round ${round.round}/${round.maxRounds}`);
    lines.push('');
    
    for (const contrib of round.contributions) {
      const positionEmoji = getPositionEmoji(contrib.position);
      lines.push(`### [${contrib.agentName}] ${contrib.emoji} ${contrib.role.toUpperCase()} (${contrib.model} via ${contrib.provider})`);
      lines.push('');
      lines.push(contrib.content);
      lines.push('');
      lines.push(`**Position:** ${positionEmoji} ${contrib.position}${contrib.positionReason ? ` - ${contrib.positionReason}` : ''}`);
      lines.push('');
    }
    
    // Round status
    lines.push('**Round Status:**');
    const counts: string[] = [];
    for (const [pos, count] of Object.entries(round.positionCounts)) {
      if (count > 0 && pos !== 'PROPOSAL') {
        counts.push(`${count} ${pos}`);
      }
    }
    lines.push(`- Positions: ${counts.join(', ') || 'None'}`);
    lines.push(`- Consensus: ${round.consensusReached ? 'Yes' : 'No'}`);
    if (round.objections.length > 0) {
      lines.push(`- Objections: ${round.objections.length}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  // Final Consensus
  if (result.finalConsensus) {
    lines.push('## Final Consensus');
    lines.push('');
    lines.push(result.finalConsensus);
    lines.push('');
  }
  
  // Action Items
  if (result.actionItems.length > 0) {
    lines.push('## Action Items');
    lines.push('');
    for (const item of result.actionItems) {
      const assignee = item.assignee ? ` (assigned: ${item.assignee})` : '';
      lines.push(`- [ ] ${item.task}${assignee}`);
    }
    lines.push('');
  }
  
  // Conditions & Concerns
  if (result.allConditions.length > 0 || result.allConcerns.length > 0) {
    lines.push('## Conditions & Concerns');
    lines.push('');
    
    if (result.allConditions.length > 0) {
      lines.push('### Conditions');
      for (const condition of result.allConditions) {
        lines.push(`- ${condition}`);
      }
      lines.push('');
    }
    
    if (result.allConcerns.length > 0) {
      lines.push('### Noted Concerns');
      for (const concern of result.allConcerns) {
        lines.push(`- ${concern}`);
      }
      lines.push('');
    }
  }
  
  // Metadata
  lines.push('---');
  lines.push('');
  lines.push('*Generated by OpenBotMan Multi-Agent Discussion*');
  
  return lines.join('\n');
}

/**
 * Save markdown to file
 */
function saveMarkdown(markdown: string, topic: string, outputDir?: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  
  const dir = outputDir || join(process.cwd(), 'discussions');
  const filename = `${dateStr}_${slug}.md`;
  const filepath = join(dir, filename);
  
  // Create directory if needed
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  writeFileSync(filepath, markdown, 'utf-8');
  return filepath;
}

// ============================================================================
// Discussion Engine with Consensus
// ============================================================================

/**
 * Run a single agent's turn
 */
async function runAgentTurn(
  _agent: DiscussAgentConfig,
  provider: LLMProvider,
  prompt: string,
  _options: DiscussOptions
): Promise<ProviderResponse> {
  return await provider.send(prompt);
}

/**
 * Print agent header with model info
 */
function printAgentHeader(agent: DiscussAgentConfig): void {
  const providerLabel = agent.provider === 'claude-cli' ? 'CLI' : 'API';
  const header = `[${agent.name}] ${agent.emoji} ${agent.role.toUpperCase()} (${agent.model} via ${providerLabel})`;
  console.log(agent.color(header));
  console.log(chalk.gray('─'.repeat(60)));
}

/**
 * Print contribution with position
 */
function printContribution(contrib: ConsensusContribution): void {
  const lines = contrib.content.split('\n');
  for (const line of lines) {
    let formatted = line;
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, chalk.bold('$1'));
    formatted = formatted.replace(/`([^`]+)`/g, chalk.cyan('$1'));
    console.log(chalk.white(`  ${formatted}`));
  }
  
  // Print position
  const positionColor = getPositionColor(contrib.position);
  const positionEmoji = getPositionEmoji(contrib.position);
  console.log('');
  console.log(positionColor(`  ${positionEmoji} Position: ${contrib.position}${contrib.positionReason ? ` - ${contrib.positionReason}` : ''}`));
  console.log('');
}

/**
 * Run consensus-based discussion
 */
export async function runDiscussion(options: DiscussOptions): Promise<DiscussionResult> {
  const startTime = Date.now();
  const messages: DiscussionMessage[] = [];

  // Load config
  const discussionConfig = loadDiscussionConfig(options.config);
  const agents = getAgentsFromConfig(discussionConfig, options);
  
  // Apply config defaults
  const maxRounds = options.maxRounds ?? discussionConfig?.maxRounds ?? 10;
  const timeout = options.timeout ?? discussionConfig?.timeout ?? 60;
  const outputDir = options.output ?? discussionConfig?.outputDir;
  
  // Identify proposer and responders
  const proposer = agents.find(a => a.role === 'architect' || a.role === 'planner') || agents[0]!;
  const responders = agents.filter(a => a.id !== proposer.id);
  
  // Create providers for each agent
  const providers = new Map<string, LLMProvider>();
  for (const agent of agents) {
    providers.set(agent.id, createAgentProvider(agent, { ...options, timeout }));
  }

  // Header
  console.log('\n');
  console.log(chalk.bold.white('🤖 Multi-Agent Consensus Discussion'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log(chalk.white(`Topic: ${chalk.cyan(options.topic)}`));
  console.log(chalk.white(`Max Rounds: ${maxRounds}`));
  console.log('');
  
  // Show agents with their models
  console.log(chalk.bold('Participants:'));
  for (const agent of agents) {
    const providerLabel = agent.provider === 'claude-cli' ? 'CLI' : 'API';
    console.log(`  ${agent.emoji} ${agent.name} - ${chalk.gray(`${agent.model} via ${providerLabel}`)}`);
  }
  console.log(chalk.gray('━'.repeat(60)));

  // Load context
  const contextSpinner = ora('Loading project context...').start();
  let context: ProjectContext;
  
  try {
    context = await loadProjectContext(options);
    contextSpinner.succeed(
      `Context loaded: ${context.sourceFiles.length} files, ${Math.round(context.totalSize / 1024)}KB`
    );
  } catch {
    contextSpinner.warn('Could not load context, proceeding without');
    context = {
      readme: null,
      packageJson: null,
      sourceFiles: [],
      totalSize: 0,
      projectRoot: process.cwd(),
    };
  }

  // Check provider availability
  const availabilitySpinner = ora('Checking provider availability...').start();
  const availableProviders: string[] = [];
  
  for (const agent of agents) {
    const provider = providers.get(agent.id)!;
    const available = await provider.isAvailable();
    if (available) {
      availableProviders.push(agent.name);
    } else {
      availabilitySpinner.warn(`${agent.name}: Provider ${agent.provider} not available`);
    }
  }
  
  if (availableProviders.length < agents.length) {
    availabilitySpinner.warn(`Only ${availableProviders.length}/${agents.length} providers available`);
  } else {
    availabilitySpinner.succeed('All providers available');
  }

  console.log('');

  // Consensus rounds
  const rounds: RoundStatus[] = [];
  let consensusReached = false;
  let previousRound: RoundStatus | undefined;
  
  // Context string for prompts
  const contextStr = context.totalSize > 0 ? formatContextForAgent(context) : '';
  
  for (let round = 1; round <= maxRounds && !consensusReached; round++) {
    console.log('');
    console.log(chalk.bold.blue(`🔄 Round ${round}/${maxRounds}`));
    console.log(chalk.blue('━'.repeat(60)));
    console.log('');
    
    const contributions: ConsensusContribution[] = [];
    
    // Step 1: Proposer creates/revises proposal
    const proposerPrompt = buildProposerPrompt(options.topic, round, previousRound);
    const fullProposerPrompt = contextStr 
      ? `${contextStr}\n\n---\n\n${proposerPrompt}`
      : proposerPrompt;
    
    const proposerSpinner = ora({
      text: proposer.color(`[${proposer.name}] Creating ${round === 1 ? 'proposal' : 'revised proposal'}...`),
      color: 'cyan',
    }).start();
    
    try {
      const proposerProvider = providers.get(proposer.id)!;
      const proposerResponse = await runAgentTurn(proposer, proposerProvider, fullProposerPrompt, options);
      proposerSpinner.stop();
      
      const extracted = extractPosition(proposerResponse.text);
      const providerLabel = proposer.provider === 'claude-cli' ? 'CLI' : 'API';
      
      const proposerContrib: ConsensusContribution = {
        agentId: proposer.id,
        agentName: proposer.name,
        role: proposer.role,
        model: proposer.model,
        provider: providerLabel,
        emoji: proposer.emoji,
        content: proposerResponse.text,
        position: 'PROPOSAL',
        positionReason: extracted.reason,
        timestamp: new Date(),
      };
      contributions.push(proposerContrib);
      
      console.log('');
      printAgentHeader(proposer);
      printContribution(proposerContrib);
      
      // Add to messages
      messages.push({
        agentId: proposer.id,
        agentName: proposer.name,
        role: proposer.role,
        content: proposerResponse.text,
        timestamp: new Date(),
      });
      
      if (proposerResponse.costUsd) {
        console.log(chalk.gray(`  💰 Cost: $${proposerResponse.costUsd.toFixed(4)}`));
      }
    } catch (error) {
      proposerSpinner.fail(proposer.color(`[${proposer.name}] Error`));
      console.log(chalk.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`));
      break;
    }
    
    // Step 2: Each responder evaluates
    for (const responder of responders) {
      const responderPrompt = buildResponderPrompt(
        options.topic,
        round,
        contributions[0]!, // The proposal
        contributions.slice(1), // Previous responses this round
        responder.role
      );
      
      const fullResponderPrompt = contextStr 
        ? `${contextStr}\n\n---\n\n${responderPrompt}`
        : responderPrompt;
      
      const responderSpinner = ora({
        text: responder.color(`[${responder.name}] Analyzing...`),
        color: 'cyan',
      }).start();
      
      try {
        const responderProvider = providers.get(responder.id)!;
        const responderResponse = await runAgentTurn(responder, responderProvider, fullResponderPrompt, options);
        responderSpinner.stop();
        
        const { position, reason } = extractPosition(responderResponse.text);
        const providerLabel = responder.provider === 'claude-cli' ? 'CLI' : 'API';
        
        const responderContrib: ConsensusContribution = {
          agentId: responder.id,
          agentName: responder.name,
          role: responder.role,
          model: responder.model,
          provider: providerLabel,
          emoji: responder.emoji,
          content: responderResponse.text,
          position,
          positionReason: reason,
          timestamp: new Date(),
        };
        contributions.push(responderContrib);
        
        console.log('');
        printAgentHeader(responder);
        printContribution(responderContrib);
        
        // Add to messages
        messages.push({
          agentId: responder.id,
          agentName: responder.name,
          role: responder.role,
          content: responderResponse.text,
          timestamp: new Date(),
        });
        
        if (responderResponse.costUsd) {
          console.log(chalk.gray(`  💰 Cost: $${responderResponse.costUsd.toFixed(4)}`));
        }
      } catch (error) {
        responderSpinner.fail(responder.color(`[${responder.name}] Error`));
        console.log(chalk.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`));
        
        // Add error placeholder
        contributions.push({
          agentId: responder.id,
          agentName: responder.name,
          role: responder.role,
          model: responder.model,
          provider: responder.provider === 'claude-cli' ? 'CLI' : 'API',
          emoji: responder.emoji,
          content: `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`,
          position: 'CONCERN',
          positionReason: 'Agent error',
          timestamp: new Date(),
        });
      }
    }
    
    // Evaluate round
    const roundStatus = evaluateRound(round, maxRounds, contributions);
    rounds.push(roundStatus);
    previousRound = roundStatus;
    
    // Print round status
    console.log('');
    console.log(chalk.gray('─'.repeat(60)));
    console.log(formatRoundStatus(roundStatus));
    
    consensusReached = roundStatus.consensusReached;
  }
  
  // Generate summary
  console.log('');
  console.log(chalk.gray('━'.repeat(60)));
  
  let summary: string;
  let finalConsensus: string | undefined;
  
  if (consensusReached) {
    console.log(chalk.bold.green('\n✅ KONSENS ERREICHT!'));
    
    // Use last proposal as final consensus
    const lastRound = rounds[rounds.length - 1];
    const proposalContrib = lastRound?.contributions.find(c => c.position === 'PROPOSAL');
    finalConsensus = proposalContrib?.content;
    summary = `Konsens nach ${rounds.length} Runde(n) erreicht.`;
  } else {
    console.log(chalk.bold.yellow('\n❌ KEIN KONSENS'));
    summary = `Kein Konsens nach ${rounds.length} Runden. Weitere Diskussion erforderlich.`;
  }
  
  // Collect all action items, conditions, concerns
  const allActionItems: Array<{ task: string; assignee?: string }> = [];
  const allConditions: string[] = [];
  const allConcerns: string[] = [];
  
  for (const round of rounds) {
    allConditions.push(...round.conditions);
    allConcerns.push(...round.concerns);
    
    for (const contrib of round.contributions) {
      const items = extractActionItems(contrib.content);
      allActionItems.push(...items);
    }
  }
  
  // Build consensus result
  const consensusResult: ConsensusResult = {
    topic: options.topic,
    rounds,
    consensusReached,
    totalRounds: rounds.length,
    finalConsensus,
    actionItems: allActionItems,
    allConditions: [...new Set(allConditions)],
    allConcerns: [...new Set(allConcerns)],
    durationMs: Date.now() - startTime,
    participants: agents.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      model: a.model,
      provider: a.provider === 'claude-cli' ? 'CLI' : 'API',
    })),
  };
  
  // Generate and save markdown
  const markdown = generateMarkdown(options.topic, agents, consensusResult, context);
  const markdownPath = saveMarkdown(markdown, options.topic, outputDir);
  
  console.log('');
  console.log(chalk.green(`📝 Discussion saved to: ${markdownPath}`));
  
  // Print summary
  console.log('');
  console.log(chalk.bold.white('📊 ZUSAMMENFASSUNG'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white(`  Thema: ${options.topic}`));
  console.log(chalk.white(`  Runden: ${rounds.length}/${maxRounds}`));
  console.log(chalk.white(`  Status: ${consensusReached ? 'Konsens erreicht' : 'Kein Konsens'}`));
  console.log(chalk.white(`  Dauer: ${Math.round((Date.now() - startTime) / 1000)}s`));
  
  if (allActionItems.length > 0) {
    console.log('');
    console.log(chalk.bold('  Action Items:'));
    for (const item of allActionItems.slice(0, 5)) {
      console.log(chalk.white(`    - ${item.task}${item.assignee ? ` (${item.assignee})` : ''}`));
    }
    if (allActionItems.length > 5) {
      console.log(chalk.gray(`    ... und ${allActionItems.length - 5} weitere`));
    }
  }
  
  console.log(chalk.gray('─'.repeat(50)));
  console.log('');

  return {
    topic: options.topic,
    messages,
    summary,
    duration: Date.now() - startTime,
    consensusResult,
    markdownPath,
  };
}

/**
 * CLI command handler
 */
export async function discussCommand(options: DiscussOptions): Promise<void> {
  try {
    await runDiscussion(options);
  } catch (error) {
    console.error(chalk.red('Error running discussion:'), error);
    process.exit(1);
  }
}