/**
 * Demo Discussion Command
 * 
 * Demonstrates a multi-agent discussion between mock agents.
 * Shows how proposals, arguments, voting, and consensus work.
 */

import chalk from 'chalk';

// ============================================================================
// Types
// ============================================================================

interface MockAgent {
  id: string;
  name: string;
  role: string;
  color: (text: string) => string;
  personality: string;
  stance: 'pro-typescript' | 'pro-javascript' | 'neutral';
}

interface DiscussionMessage {
  agent: MockAgent;
  type: 'proposal' | 'argument' | 'vote' | 'system';
  stance?: 'support' | 'against' | 'neutral';
  content: string;
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
    personality: 'Pragmatic developer who values type safety and tooling',
    stance: 'pro-typescript',
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Reviewer',
    color: chalk.yellow,
    personality: 'Experienced developer who prefers simplicity and quick iteration',
    stance: 'pro-javascript',
  },
  {
    id: 'charlie',
    name: 'Charlie',
    role: 'Architect',
    color: chalk.magenta,
    personality: 'Thoughtful architect who considers all perspectives',
    stance: 'neutral',
  },
];

// ============================================================================
// Mock Responses
// ============================================================================

interface TopicResponses {
  proposal: string;
  arguments: Record<string, { stance: 'support' | 'against' | 'neutral'; content: string }>;
  compromise: string;
  votes: Record<string, { vote: 'support' | 'against'; reason: string }>;
}

const MOCK_RESPONSES: Record<string, TopicResponses> = {
  'openbotman': {
    proposal: `Ich habe das OpenBotMan-Projekt analysiert und bin beeindruckt! 
Hier meine Bewertung:

✅ **Stärken:**
- Saubere Monorepo-Struktur mit Turborepo
- 408 Tests mit hoher Coverage
- Claude CLI Provider ermöglicht Pro-Abo Nutzung
- Discussion Engine für Multi-Agent-Kommunikation
- Gute Trennung: Protocol, Knowledge-Base, Orchestrator

📊 **Code-Qualität: 8/10** - Solide Architektur!`,

    arguments: {
      bob: {
        stance: 'neutral',
        content: `Gute Analyse, Alice! Ich sehe aber auch Verbesserungspotential:

⚠️ **Zu verbessern:**
- Keine E2E-Tests vorhanden
- Error-Handling könnte konsistenter sein
- Einige Funktionen sind noch nicht dokumentiert
- Windows-Kompatibilität hatte Probleme (native modules)

📊 **Meine Bewertung: 7/10** - Gut, aber Raum für Verbesserung.`,
      },
      charlie: {
        stance: 'support',
        content: `Beide Perspektiven sind valide. Als Architekt sehe ich:

🏗️ **Architektur-Highlights:**
- Plugin-System ist gut erweiterbar
- Provider-Abstraktion (Anthropic/CLI) ist elegant
- Event-basierte Kommunikation skaliert gut
- Knowledge-Base mit Vector-DB ist zukunftssicher

🔮 **Empfehlungen für v2.1:**
- MCP-Server weiter ausbauen
- Streaming für Real-Time Responses
- Dashboard/UI für Monitoring`,
      },
    },

    compromise: `Nach unserer Analyse können wir folgendes Fazit ziehen:

🏆 **OpenBotMan v2.0 Gesamtbewertung:**

| Kategorie | Score |
|-----------|-------|
| Architektur | 9/10 |
| Code-Qualität | 8/10 |
| Test-Coverage | 8/10 |
| Dokumentation | 6/10 |
| Erweiterbarkeit | 9/10 |

**Gesamt: 8/10** ⭐⭐⭐⭐

🎯 **Top 3 Prioritäten für nächste Version:**
1. E2E-Tests hinzufügen
2. Dokumentation verbessern
3. Dashboard/UI entwickeln

Das Projekt ist production-ready für den aktuellen Scope!`,

    votes: {
      alice: {
        vote: 'support',
        reason: 'Exzellente Basis für Multi-Agent Orchestrierung',
      },
      bob: {
        vote: 'support',
        reason: 'Mit den empfohlenen Verbesserungen wird es noch besser',
      },
      charlie: {
        vote: 'support',
        reason: 'Architektonisch solide, gute Erweiterbarkeit',
      },
    },
  },

  default: {
    proposal: `Ich schlage vor, TypeScript für unser Projekt zu verwenden. 
Die Vorteile sind:
- Statische Typisierung fängt Fehler zur Compile-Zeit
- Bessere IDE-Unterstützung und Auto-Completion
- Einfachere Refactorings in großen Codebasen
- Selbstdokumentierender Code durch Typ-Annotationen`,

    arguments: {
      bob: {
        stance: 'against',
        content: `Ich verstehe die Vorteile von TypeScript, aber ich sehe auch Nachteile:
- Längere Build-Zeiten durch Kompilierung
- Mehr Boilerplate-Code für Typ-Definitionen
- Steile Lernkurve für Entwickler ohne TypeScript-Erfahrung
- JavaScript ist flexibler für schnelles Prototyping

Für ein kleines Team könnte JavaScript effizienter sein.`,
      },
      charlie: {
        stance: 'neutral',
        content: `Beide Ansätze haben ihre Berechtigung. Lasst mich einen Kompromiss vorschlagen:

Wir könnten einen graduellen Ansatz wählen:
1. Start mit TypeScript im "loose" Mode
2. Kritische Module streng typisieren
3. Prototypen zunächst in JavaScript, dann migrieren

So nutzen wir die Vorteile beider Welten.`,
      },
    },

    compromise: `Nach Abwägung aller Argumente schlage ich folgenden Kompromiss vor:

🔹 TypeScript als Standard, aber mit pragmatischen Einstellungen:
   - strict: false anfangs, später aktivieren
   - any erlaubt für Legacy-Code
   - Fokus auf neue Module

🔹 Graduelle Migration für bestehenden Code

🔹 Code-Reviews prüfen Typ-Qualität

Damit bekommen wir Typ-Sicherheit ohne die Entwicklung zu bremsen.`,

    votes: {
      alice: {
        vote: 'support',
        reason: 'TypeScript mit pragmatischen Settings ist ein guter Kompromiss',
      },
      bob: {
        vote: 'support',
        reason: 'Der graduelle Ansatz adressiert meine Bedenken',
      },
      charlie: {
        vote: 'support',
        reason: 'Ein ausgewogener Ansatz, der alle Perspektiven berücksichtigt',
      },
    },
  },
};

// ============================================================================
// Demo Runner
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Print a message with formatting
 */
function printMessage(msg: DiscussionMessage): void {
  const { agent, type, stance, content } = msg;

  let prefix = '';
  let stanceStr = '';

  switch (type) {
    case 'proposal':
      prefix = '💡 PROPOSAL';
      break;
    case 'argument':
      prefix = stance === 'support' ? '✅ ARGUMENT' : stance === 'against' ? '❌ ARGUMENT' : '🤔 ARGUMENT';
      stanceStr = stance ? ` (${stance})` : '';
      break;
    case 'vote':
      prefix = stance === 'support' ? '✅ VOTE' : '❌ VOTE';
      stanceStr = `: ${stance}`;
      break;
    case 'system':
      console.log(chalk.gray(`\n${content}\n`));
      return;
  }

  console.log(agent.color(`\n[${agent.name}] ${prefix}${stanceStr}:`));
  
  // Indent and color content
  const lines = content.split('\n');
  for (const line of lines) {
    console.log(chalk.white(`  ${line}`));
  }
}

/**
 * Print header
 */
function printHeader(topic: string, agents: MockAgent[]): void {
  console.log('\n');
  console.log(chalk.bold.white('🎭 Multi-Agent Discussion Demo'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log(chalk.white(`Topic: "${topic}"`));
  console.log(
    chalk.white(
      `Participants: ${agents.map((a) => `${a.name} (${a.role})`).join(', ')}`
    )
  );
  console.log(chalk.gray('━'.repeat(60)));
}

/**
 * Print consensus result
 */
function printConsensus(
  reached: boolean,
  decision: string,
  votes: { support: number; against: number; total: number }
): void {
  console.log('\n');
  console.log(chalk.gray('━'.repeat(60)));
  
  if (reached) {
    console.log(chalk.bold.green(`🎉 CONSENSUS REACHED: ${decision}`));
    console.log(chalk.green(`   (${votes.support}/${votes.total} support)`));
  } else {
    console.log(chalk.bold.red(`❌ NO CONSENSUS`));
    console.log(chalk.red(`   Support: ${votes.support}, Against: ${votes.against}`));
  }
  
  console.log(chalk.gray('━'.repeat(60)));
  console.log('\n');
}

/**
 * Run the demo discussion
 */
export async function runDemoDiscussion(options: {
  topic?: string;
  delay?: number;
  noAnimation?: boolean;
}): Promise<void> {
  const topic = options.topic || 'Sollen wir TypeScript oder JavaScript verwenden?';
  const delayMs = options.noAnimation ? 0 : (options.delay || 1000);
  
  // Check if topic is about OpenBotMan - use special responses
  const isOpenBotManTopic = topic.toLowerCase().includes('openbotman') || 
                           topic.toLowerCase().includes('projekt') ||
                           topic.toLowerCase().includes('qualität') ||
                           topic.toLowerCase().includes('review');
  const responses = isOpenBotManTopic ? MOCK_RESPONSES['openbotman']! : MOCK_RESPONSES['default']!;
  
  const alice = AGENTS.find((a) => a.id === 'alice')!;
  const bob = AGENTS.find((a) => a.id === 'bob')!;
  const charlie = AGENTS.find((a) => a.id === 'charlie')!;

  // Header
  printHeader(topic, AGENTS);

  await sleep(delayMs);

  // Phase 1: Proposal
  printMessage({
    agent: alice,
    type: 'proposal',
    content: responses.proposal,
  });

  await sleep(delayMs * 1.5);

  // Phase 2: Counter-argument
  printMessage({
    agent: bob,
    type: 'argument',
    stance: responses.arguments['bob']!.stance,
    content: responses.arguments['bob']!.content,
  });

  await sleep(delayMs * 1.5);

  // Phase 3: Neutral perspective
  printMessage({
    agent: charlie,
    type: 'argument',
    stance: responses.arguments['charlie']!.stance,
    content: responses.arguments['charlie']!.content,
  });

  await sleep(delayMs);

  // Phase 4: Compromise
  printMessage({
    agent: alice,
    type: 'system',
    content: '',
  });
  console.log(chalk.gray.italic('💭 Alice considers the feedback...'));
  
  await sleep(delayMs);
  
  printMessage({
    agent: charlie,
    type: 'proposal',
    content: responses.compromise,
  });

  await sleep(delayMs);

  // Phase 5: Voting
  console.log(chalk.gray('\n📊 Voting phase...'));
  await sleep(delayMs / 2);

  const votingAgents = [alice, bob, charlie] as const;
  let supportCount = 0;
  let againstCount = 0;

  for (const agent of votingAgents) {
    const voteData = responses.votes[agent.id];
    if (!voteData) continue;

    const isSupport = voteData.vote === 'support';
    if (isSupport) supportCount++;
    else againstCount++;

    printMessage({
      agent,
      type: 'vote',
      stance: isSupport ? 'support' : 'against',
      content: voteData.reason,
    });

    await sleep(delayMs / 2);
  }

  // Phase 6: Result
  const consensusReached = supportCount >= 2;
  const decision = consensusReached ? 'TypeScript (pragmatischer Ansatz)' : 'Keine Einigung';

  printConsensus(consensusReached, decision, {
    support: supportCount,
    against: againstCount,
    total: votingAgents.length,
  });
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
