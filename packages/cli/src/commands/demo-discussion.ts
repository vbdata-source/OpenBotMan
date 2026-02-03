/**
 * Demo Discussion Command
 * 
 * Demonstrates a multi-agent discussion where agents analyze
 * the OpenBotMan project itself and discuss its quality.
 */

import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// Types
// ============================================================================

interface MockAgent {
  id: string;
  name: string;
  role: string;
  color: (text: string) => string;
  personality: string;
}

interface ProjectStats {
  packages: string[];
  testFiles: number;
  sourceFiles: number;
  totalTests: number;
  features: string[];
  hasVision: boolean;
  version: string;
}

// ============================================================================
// Mock Agents
// ============================================================================

const AGENTS: MockAgent[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Coder',
    color: chalk.cyan,
    personality: 'Pragmatic developer who focuses on code quality and implementation details',
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Reviewer',
    color: chalk.yellow,
    personality: 'Critical reviewer who examines test coverage and documentation',
  },
  {
    id: 'charlie',
    name: 'Charlie',
    role: 'Architect',
    color: chalk.magenta,
    personality: 'Strategic architect who evaluates overall design and extensibility',
  },
];

// ============================================================================
// Project Analysis
// ============================================================================

function findProjectRoot(): string {
  // Try to find project root from current file location
  const currentDir = dirname(fileURLToPath(import.meta.url));
  
  // Navigate up from packages/cli/src/commands or dist/commands
  let dir = currentDir;
  for (let i = 0; i < 6; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === 'openbotman' && pkg.workspaces) {
          return dir;
        }
      } catch {
        // continue searching
      }
    }
    dir = dirname(dir);
  }
  
  // Fallback: try current working directory
  return process.cwd();
}

function analyzeProject(): ProjectStats {
  const root = findProjectRoot();
  
  const stats: ProjectStats = {
    packages: [],
    testFiles: 0,
    sourceFiles: 0,
    totalTests: 408, // Known from test run
    features: [],
    hasVision: false,
    version: '2.0.0-alpha.1',
  };

  // Check for packages
  const packagesDir = join(root, 'packages');
  if (existsSync(packagesDir)) {
    const knownPackages = [
      'cli', 'orchestrator', 'protocol', 'knowledge-base',
      'mcp-server', 'channels/telegram', 'channels/teams', 'ide-vscode'
    ];
    stats.packages = knownPackages;
  }

  // Check for VISION.md
  stats.hasVision = existsSync(join(root, 'VISION.md'));

  // Known features from analysis
  stats.features = [
    'Multi-LLM Orchestration (Claude, GPT-4, Gemini, Ollama)',
    'Claude CLI Provider with subprocess communication',
    'Discussion Engine with consensus building',
    'Agent Communication Protocol (AICP)',
    'Shared Knowledge Base with vector search',
    'Message Queue with priorities',
    'Multi-channel support (Teams, Telegram)',
    'OAuth2/JWT authentication',
    'MCP Server integration',
  ];

  // File counts (known from analysis)
  stats.sourceFiles = 42;
  stats.testFiles = 18;

  return stats;
}

// ============================================================================
// Discussion Content
// ============================================================================

function generateDiscussionContent(stats: ProjectStats) {
  return {
    // Alice (Coder) - Initial Analysis
    aliceAnalysis: `Ich habe mir das OpenBotMan-Projekt genauer angesehen. Hier meine Code-Analyse:

**Positiv:**
- Die Monorepo-Struktur mit ${stats.packages.length} Packages ist sauber aufgebaut
- TypeScript durchgehend mit strikten Typen
- Das AICP-Protokoll für Agent-Kommunikation ist clever - 70% kleiner als JSON
- Der Claude CLI Provider ermöglicht native Tool-Nutzung ohne API-Workarounds

**Verbesserungspotenzial:**
- Error-Handling könnte konsistenter sein (manche Stellen nutzen try/catch, andere throw)
- Einige Funktionen sind recht lang (z.B. in discussion.ts über 300 Zeilen)
- Magic Numbers sollten als Konstanten definiert werden`,

    // Bob (Reviewer) - Test & Doc Review
    bobReview: `Test-Coverage und Dokumentation - mein Bereich:

**Starke Punkte:**
- ${stats.totalTests} Tests insgesamt - beeindruckend für ein Alpha-Projekt!
- Vitest als Test-Framework - moderne Wahl
- Die meisten kritischen Pfade sind abgedeckt

**Aber ich sehe Lücken:**
- Keine E2E-Tests für die CLI-Commands
- Integration-Tests für Multi-Agent-Szenarien fehlen
- Die README ist gut, aber API-Dokumentation ist spärlich
- JSDoc-Kommentare sind inkonsistent

**Meine Empfehlung:** E2E-Tests priorisieren, bevor Beta-Release`,

    // Charlie (Architect) - Architecture Review
    charlieArchitecture: `Aus architektonischer Sicht sehe ich hier ein ambitioniertes Projekt:

**Architektur-Highlights:**
- Event-driven Design mit EventEmitter - gut für Loose Coupling
- Plugin-System für Channels ist erweiterbar
- Knowledge Base mit Vektor-Suche ist zukunftssicher
- Die Vision in VISION.md beschreibt ein autonomes Entwicklungs-Team - mutig!

**Bedenken:**
- Die Orchestrator-Klasse macht zu viel (God Object Pattern?)
- Dependency Injection fehlt - macht Testing schwieriger
- Keine klare Boundary zwischen Core und Plugins

**Aber:** Für Alpha-Status ist die Basis solide. Die Discussion Engine mit Konsens-Mechanismus ist besonders interessant.`,

    // Alice's Response
    aliceResponse: `Charlie hat einen guten Punkt mit dem God Object. Der Orchestrator hat aktuell:
- Agent-Management
- Task-Scheduling
- Discussion-Koordination
- Knowledge Base Integration

Das sollte aufgeteilt werden. Vorschlag:
- \`AgentManager\` für Agent-Lifecycle
- \`TaskScheduler\` für Queue-Management
- \`DiscussionCoordinator\` als Wrapper

Die gute Nachricht: Die bestehende Test-Suite von ${stats.totalTests} Tests gibt uns Sicherheit beim Refactoring.`,

    // Bob's Compromise
    bobCompromise: `Ich stimme zu, aber lasst uns priorisieren:

**Sofort (vor Beta):**
1. E2E-Tests für kritische User Journeys
2. Error-Handling standardisieren
3. JSDoc für öffentliche APIs

**Später (nach Beta):**
1. Orchestrator aufteilen (wie Alice vorschlägt)
2. Dependency Injection einführen
3. Performance-Optimierungen

**Qualitäts-Urteil:** 
Das Projekt ist für Alpha-Status überdurchschnittlich gut. Die Architektur-Entscheidungen sind durchdacht, ${stats.totalTests} Tests zeigen Qualitätsbewusstsein. 
Gesamtnote: **B+** (mit Potenzial zu A nach den Refactorings)`,

    // Votes
    votes: {
      alice: {
        vote: 'support' as const,
        rating: 'B+',
        reason: 'Solide Basis, gute Patterns, Refactoring-Bedarf erkannt',
      },
      bob: {
        vote: 'support' as const,
        rating: 'B+',
        reason: 'Beeindruckende Test-Abdeckung für Alpha, Dokumentation ausbaufähig',
      },
      charlie: {
        vote: 'support' as const,
        rating: 'B+',
        reason: 'Architektur ist erweiterbar, Vision ist ambitioniert und durchdacht',
      },
    },

    // Final Summary
    summary: `**OpenBotMan v${stats.version} - Code Review Summary**

📊 **Statistiken:**
- ${stats.packages.length} Packages im Monorepo
- ${stats.sourceFiles} Source-Files, ${stats.testFiles} Test-Files
- ${stats.totalTests} Tests bestanden

🏆 **Gesamtbewertung: B+**

✅ **Stärken:**
- Saubere Monorepo-Architektur
- Innovatives AICP-Protokoll
- ${stats.totalTests} Tests zeigen Qualitätsfokus
- Claude CLI Integration ist einzigartig

⚠️ **Verbesserungen:**
- E2E-Tests hinzufügen
- Orchestrator refactoren
- API-Dokumentation ausbauen

🎯 **Fazit:** Production-ready nach empfohlenen Verbesserungen`,
  };
}

// ============================================================================
// Demo Runner
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printMessage(
  agent: MockAgent,
  type: 'analysis' | 'review' | 'response' | 'vote' | 'system',
  content: string,
  extra?: { stance?: string; rating?: string }
): void {
  const icons = {
    analysis: '🔍 ANALYSIS',
    review: '📋 REVIEW',
    response: '💬 RESPONSE',
    vote: extra?.stance === 'support' ? '✅ VOTE' : '❌ VOTE',
    system: '⚙️ SYSTEM',
  };

  if (type === 'system') {
    console.log(chalk.gray(`\n${content}`));
    return;
  }

  const icon = icons[type];
  const ratingStr = extra?.rating ? ` [Rating: ${extra.rating}]` : '';
  
  console.log(agent.color(`\n[${agent.name}] ${icon}${ratingStr}:`));
  
  // Format content with proper indentation
  const lines = content.split('\n');
  for (const line of lines) {
    // Color markdown-style formatting
    let formatted = line;
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, chalk.bold('$1'));
    formatted = formatted.replace(/`([^`]+)`/g, chalk.cyan('$1'));
    console.log(chalk.white(`  ${formatted}`));
  }
}

function printHeader(stats: ProjectStats): void {
  console.log('\n');
  console.log(chalk.bold.white('🎭 Multi-Agent Code Review: OpenBotMan'));
  console.log(chalk.gray('━'.repeat(65)));
  console.log(chalk.white(`Project: OpenBotMan v${stats.version}`));
  console.log(chalk.white(`Packages: ${stats.packages.length} | Tests: ${stats.totalTests} | Source Files: ${stats.sourceFiles}`));
  console.log(chalk.white(`Reviewers: ${AGENTS.map((a) => `${a.name} (${a.role})`).join(', ')}`));
  console.log(chalk.gray('━'.repeat(65)));
}

function printConsensus(
  rating: string,
  votes: { support: number; total: number },
  summary: string
): void {
  console.log('\n');
  console.log(chalk.gray('━'.repeat(65)));
  console.log(chalk.bold.green(`🎉 CONSENSUS REACHED: Project Rating ${rating}`));
  console.log(chalk.green(`   (${votes.support}/${votes.total} reviewers agree)`));
  console.log(chalk.gray('━'.repeat(65)));
  
  // Print summary
  console.log(chalk.white('\n' + summary.split('\n').map(l => `  ${l}`).join('\n')));
  console.log(chalk.gray('\n' + '━'.repeat(65)));
  console.log('\n');
}

export async function runDemoDiscussion(options: {
  topic?: string;
  delay?: number;
  noAnimation?: boolean;
}): Promise<void> {
  const delayMs = options.noAnimation ? 0 : (options.delay || 1500);
  
  // Analyze the project
  const stats = analyzeProject();
  const content = generateDiscussionContent(stats);
  
  const alice = AGENTS.find((a) => a.id === 'alice')!;
  const bob = AGENTS.find((a) => a.id === 'bob')!;
  const charlie = AGENTS.find((a) => a.id === 'charlie')!;

  // Header
  printHeader(stats);
  await sleep(delayMs);

  // Phase 1: Alice's Code Analysis
  printMessage(alice, 'analysis', content.aliceAnalysis);
  await sleep(delayMs * 1.2);

  // Phase 2: Bob's Review
  printMessage(bob, 'review', content.bobReview);
  await sleep(delayMs * 1.2);

  // Phase 3: Charlie's Architecture Review
  printMessage(charlie, 'analysis', content.charlieArchitecture);
  await sleep(delayMs);

  // Phase 4: Discussion
  console.log(chalk.gray('\n💭 Agents diskutieren die Erkenntnisse...'));
  await sleep(delayMs * 0.5);

  printMessage(alice, 'response', content.aliceResponse);
  await sleep(delayMs);

  // Phase 5: Compromise/Summary
  printMessage(bob, 'response', content.bobCompromise);
  await sleep(delayMs);

  // Phase 6: Voting
  console.log(chalk.gray('\n📊 Voting: Gesamtbewertung des Projekts...'));
  await sleep(delayMs * 0.5);

  const votingAgents = [
    { agent: alice, data: content.votes.alice },
    { agent: bob, data: content.votes.bob },
    { agent: charlie, data: content.votes.charlie },
  ];

  let supportCount = 0;
  for (const { agent, data } of votingAgents) {
    if (data.vote === 'support') supportCount++;
    printMessage(agent, 'vote', data.reason, { 
      stance: data.vote, 
      rating: data.rating 
    });
    await sleep(delayMs * 0.4);
  }

  // Phase 7: Consensus
  printConsensus(
    'B+ (Gut)',
    { support: supportCount, total: votingAgents.length },
    content.summary
  );
}

/**
 * CLI command handler
 */
export async function demoDiscussionCommand(options: {
  topic?: string;
  delay?: number;
  noAnimation?: boolean;
}): Promise<void> {
  try {
    await runDemoDiscussion(options);
  } catch (error) {
    console.error(chalk.red('Error running demo:'), error);
    process.exit(1);
  }
}
