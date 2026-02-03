/**
 * Real Multi-Agent Discussion Command
 * 
 * Runs actual Claude CLI agents in a structured discussion.
 * Each agent has a distinct role and perspective.
 * 
 * Agents can be configured in config.yaml under the 'discussion' section.
 */

import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import { ClaudeCliProvider, type ClaudeCliResponse } from '@openbotman/orchestrator';

// ============================================================================
// Types
// ============================================================================

export interface DiscussAgentConfig {
  id: string;
  name: string;
  role: 'coder' | 'reviewer' | 'architect';
  emoji: string;
  color: (text: string) => string;
  systemPrompt: string;
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
  config?: string;  // Path to config.yaml
}

export interface DiscussionConfig {
  model?: string;
  provider?: string;
  timeout?: number;
  maxContext?: number;
  showAgentConfig?: boolean;
  agents?: Array<{
    id: string;
    role: string;
    name: string;
    emoji: string;
    color?: string;
    systemPrompt: string;
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
}

// ============================================================================
// Default Agent Configurations
// ============================================================================

const DEFAULT_AGENTS: DiscussAgentConfig[] = [
  {
    id: 'coder',
    name: 'Coder',
    role: 'coder',
    emoji: '💻',
    color: chalk.cyan,
    systemPrompt: `Du bist ein erfahrener Software-Entwickler.

DEINE PERSPEKTIVE:
- Implementierungs-Details und Code-Qualität
- Praktische Umsetzbarkeit
- Performance und Effizienz
- Clean Code Prinzipien
- Konkrete Code-Vorschläge

DEIN STIL:
- Pragmatisch und lösungsorientiert
- Zeige Code-Beispiele wenn sinnvoll
- Denke an Edge-Cases
- Bewerte Aufwand realistisch

Antworte auf Deutsch. Sei konkret und präzise. Max 300 Wörter.`,
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    role: 'reviewer',
    emoji: '🔍',
    color: chalk.yellow,
    systemPrompt: `Du bist ein kritischer Code-Reviewer und QA-Experte.

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
- Schlage Alternativen vor wenn du Probleme siehst

Antworte auf Deutsch. Sei kritisch aber konstruktiv. Max 300 Wörter.`,
  },
  {
    id: 'architect',
    name: 'Architect',
    role: 'architect',
    emoji: '🏗️',
    color: chalk.magenta,
    systemPrompt: `Du bist ein erfahrener Software-Architekt.

DEINE PERSPEKTIVE:
- Übergeordnete Patterns und Architektur
- Skalierbarkeit und Erweiterbarkeit
- Trade-offs und Alternativen
- Langfristige Konsequenzen
- Integration ins Gesamtsystem

DEIN STIL:
- Strategisch und ganzheitlich
- Zeige verschiedene Optionen auf
- Berücksichtige bestehende Architektur
- Gib eine klare Empfehlung

Antworte auf Deutsch. Denke langfristig. Max 300 Wörter.`,
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
 * Merge config agents with defaults
 */
function getAgentsFromConfig(config: DiscussionConfig | null, requestedCount?: number): DiscussAgentConfig[] {
  if (!config?.agents || config.agents.length === 0) {
    // Use defaults
    const count = Math.min(requestedCount || 3, DEFAULT_AGENTS.length);
    return DEFAULT_AGENTS.slice(0, count);
  }

  // Convert config agents to internal format
  const configAgents: DiscussAgentConfig[] = config.agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role as 'coder' | 'reviewer' | 'architect',
    emoji: a.emoji || '🤖',
    color: COLOR_MAP[a.color || 'white'] || chalk.white,
    systemPrompt: a.systemPrompt,
  }));

  const count = Math.min(requestedCount || configAgents.length, configAgents.length);
  return configAgents.slice(0, count);
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
              if (stats.size > 0 && stats.size < 20000) { // Max 20KB per file
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
      // Truncate if too long
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
    // Load specific files
    context.sourceFiles = loadSpecificFiles(options.files, projectRoot, 50000 - context.totalSize);
  } else {
    // Auto-discover source files
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
      // Truncate very long files
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
// Discussion Engine
// ============================================================================

/**
 * Run a single agent's turn
 */
async function runAgentTurn(
  agent: DiscussAgentConfig,
  prompt: string,
  options: DiscussOptions
): Promise<ClaudeCliResponse> {
  const provider = new ClaudeCliProvider({
    model: options.model || 'claude-sonnet-4-20250514',
    systemPrompt: agent.systemPrompt,
    maxTurns: 1,
    timeoutMs: (options.timeout || 60) * 1000,
    cwd: options.cwd || process.cwd(),
    verbose: options.verbose || false,
    // Disable tools for discussion - just conversation
    tools: [],
  });

  return await provider.send(prompt);
}

/**
 * Build prompt for an agent including conversation history
 */
function buildAgentPrompt(
  topic: string,
  context: ProjectContext,
  previousMessages: DiscussionMessage[],
  agentRole: string
): string {
  const parts: string[] = [];

  // Topic
  parts.push(`# Diskussions-Thema\n${topic}`);
  parts.push('');

  // Project context
  if (context.totalSize > 0) {
    parts.push('# Projekt-Kontext');
    parts.push(formatContextForAgent(context));
  }

  // Previous messages
  if (previousMessages.length > 0) {
    parts.push('# Bisherige Diskussion');
    parts.push('');
    for (const msg of previousMessages) {
      parts.push(`## [${msg.agentName}] (${msg.role})`);
      parts.push(msg.content);
      parts.push('');
    }
  }

  // Instruction
  parts.push('---');
  if (previousMessages.length === 0) {
    parts.push(`Als ${agentRole}: Analysiere das Thema und gib deine initiale Einschätzung.`);
  } else {
    parts.push(`Als ${agentRole}: Reagiere auf die bisherigen Beiträge. Ergänze, kritisiere konstruktiv, oder stimme zu.`);
  }

  return parts.join('\n');
}

/**
 * Generate summary from discussion
 */
async function generateSummary(
  topic: string,
  messages: DiscussionMessage[],
  options: DiscussOptions
): Promise<string> {
  const provider = new ClaudeCliProvider({
    model: options.model || 'claude-sonnet-4-20250514',
    systemPrompt: 'Du bist ein neutraler Moderator. Fasse Diskussionen präzise zusammen.',
    maxTurns: 1,
    timeoutMs: (options.timeout || 60) * 1000,
    cwd: options.cwd || process.cwd(),
    tools: [],
  });

  const prompt = `Fasse diese Multi-Agent-Diskussion zusammen:

THEMA: ${topic}

DISKUSSION:
${messages.map(m => `[${m.agentName}] (${m.role}):\n${m.content}`).join('\n\n')}

---
Erstelle eine Zusammenfassung mit:
- Haupterkenntnisse (2-3 Punkte)
- Wichtigste Empfehlung
- Offene Punkte (falls vorhanden)

Max 200 Wörter.`;

  try {
    const response = await provider.send(prompt);
    return response.text;
  } catch {
    // Fallback: simple summary
    return `Diskussion zu "${topic}" mit ${messages.length} Beiträgen abgeschlossen.`;
  }
}

// ============================================================================
// Main Command
// ============================================================================

/**
 * Print styled message from agent
 */
function printAgentMessage(agent: DiscussAgentConfig, content: string): void {
  console.log('');
  console.log(agent.color(`[${agent.name}] ${agent.emoji} ${agent.role.toUpperCase()}`));
  console.log(chalk.gray('─'.repeat(50)));
  
  // Format content
  const lines = content.split('\n');
  for (const line of lines) {
    let formatted = line;
    // Bold markdown
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, chalk.bold('$1'));
    // Code
    formatted = formatted.replace(/`([^`]+)`/g, chalk.cyan('$1'));
    console.log(chalk.white(`  ${formatted}`));
  }
  console.log('');
}

/**
 * Run the discussion command
 */
export async function runDiscussion(options: DiscussOptions): Promise<DiscussionResult> {
  const startTime = Date.now();
  const messages: DiscussionMessage[] = [];

  // Load discussion config from config.yaml
  const discussionConfig = loadDiscussionConfig(options.config);
  
  // Get agents from config or use defaults
  const agents = getAgentsFromConfig(discussionConfig, options.agents);
  
  // Apply config timeout if not specified in options
  if (!options.timeout && discussionConfig?.timeout) {
    options.timeout = discussionConfig.timeout;
  }
  
  // Apply config model if not specified in options
  if (!options.model && discussionConfig?.model) {
    options.model = discussionConfig.model;
  }

  // Header
  console.log('\n');
  console.log(chalk.bold.white('🤖 Starting Real Multi-Agent Discussion'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log(chalk.white(`Topic: ${chalk.cyan(options.topic)}`));
  console.log(chalk.white(`Agents: ${agents.map(a => `${a.emoji} ${a.name}`).join(', ')}`));
  
  // Show agent config source
  if (discussionConfig?.agents && discussionConfig.agents.length > 0) {
    console.log(chalk.gray(`Config: Loaded ${agents.length} agents from config.yaml`));
  } else {
    console.log(chalk.gray(`Config: Using ${agents.length} default agents`));
  }
  
  // Show model and timeout
  console.log(chalk.gray(`Model: ${options.model || 'claude-sonnet-4-20250514'}`));
  console.log(chalk.gray(`Timeout: ${options.timeout || 60}s per agent`));
  console.log(chalk.gray('━'.repeat(60)));

  // Load context
  const contextSpinner = ora('Loading project context...').start();
  let context: ProjectContext;
  
  try {
    context = await loadProjectContext(options);
    contextSpinner.succeed(
      `Context loaded: ${context.sourceFiles.length} files, ${Math.round(context.totalSize / 1024)}KB`
    );
  } catch (error) {
    contextSpinner.warn('Could not load context, proceeding without');
    context = {
      readme: null,
      packageJson: null,
      sourceFiles: [],
      totalSize: 0,
      projectRoot: process.cwd(),
    };
  }

  // Check if Claude CLI is available
  const cliAvailable = await ClaudeCliProvider.isAvailable();
  if (!cliAvailable) {
    console.log(chalk.red('\n❌ Claude CLI not found!'));
    console.log(chalk.yellow('Install it with: npm install -g @anthropic-ai/claude-cli'));
    console.log(chalk.yellow('Then authenticate: claude auth'));
    throw new Error('Claude CLI not available');
  }

  console.log('');

  // Run discussion rounds
  for (const agent of agents) {
    const spinner = ora({
      text: agent.color(`[${agent.name}] ${agent.emoji} Analyzing...`),
      color: 'cyan',
    }).start();

    try {
      const prompt = buildAgentPrompt(options.topic, context, messages, agent.role);
      const response = await runAgentTurn(agent, prompt, options);

      spinner.stop();

      const message: DiscussionMessage = {
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        content: response.text,
        timestamp: new Date(),
      };
      messages.push(message);

      printAgentMessage(agent, response.text);

      // Show cost if available
      if (response.costUsd) {
        console.log(chalk.gray(`  💰 Cost: $${response.costUsd.toFixed(4)}`));
      }
    } catch (error) {
      spinner.fail(agent.color(`[${agent.name}] Error`));
      console.log(chalk.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`));
      
      // Add error message to transcript
      messages.push({
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        content: `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`,
        timestamp: new Date(),
      });
    }
  }

  // Generate summary
  console.log(chalk.gray('\n━'.repeat(60)));
  const summarySpinner = ora('Generating summary...').start();
  
  let summary: string;
  try {
    summary = await generateSummary(options.topic, messages, options);
    summarySpinner.succeed('Summary generated');
  } catch {
    summarySpinner.warn('Could not generate summary');
    summary = `Diskussion zu "${options.topic}" abgeschlossen.`;
  }

  // Print summary
  console.log('');
  console.log(chalk.bold.green('📝 ZUSAMMENFASSUNG'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white(summary));
  console.log(chalk.gray('─'.repeat(50)));

  const duration = Date.now() - startTime;
  console.log(chalk.gray(`\n⏱️  Duration: ${Math.round(duration / 1000)}s`));
  console.log('');

  return {
    topic: options.topic,
    messages,
    summary,
    duration,
  };
}

/**
 * CLI command handler
 */
export async function discussCommand(options: DiscussOptions): Promise<void> {
  try {
    await runDiscussion(options);
  } catch (error) {
    if (error instanceof Error && error.message === 'Claude CLI not available') {
      process.exit(1);
    }
    console.error(chalk.red('Error running discussion:'), error);
    process.exit(1);
  }
}
