/**
 * Consensus Engine for API Server
 * 
 * Implements multi-round consensus-finding for discussions.
 * Ported from CLI implementation.
 */

export type ConsensusPosition = 
  | 'PROPOSAL'
  | 'SUPPORT'
  | 'SUPPORT_WITH_CONDITIONS'
  | 'CONCERN'
  | 'OBJECTION';

export interface AgentContribution {
  agentName: string;
  role: string;
  content: string;
  position: ConsensusPosition;
  positionReason?: string;
  durationMs: number;
  model?: string;
  provider?: string;
}

export interface RoundResult {
  round: number;
  contributions: AgentContribution[];
  positionCounts: Record<ConsensusPosition, number>;
  consensusReached: boolean;
  objections: string[];
  concerns: string[];
}

export interface ConsensusResult {
  topic: string;
  rounds: RoundResult[];
  consensusReached: boolean;
  totalRounds: number;
  finalSummary: string;
  actionItems: string[];
  durationMs: number;
}

/**
 * Extract position from agent response
 */
export function extractPosition(content: string): { 
  position: ConsensusPosition; 
  reason?: string;
} {
  // Look for explicit position marker
  const positionMatch = content.match(
    /\[POSITION:\s*(SUPPORT_WITH_CONDITIONS|SUPPORT|CONCERN|OBJECTION|PROPOSAL)\](?:\s*[-–—]\s*(.+))?/i
  );
  
  if (positionMatch) {
    const position = positionMatch[1]!.toUpperCase() as ConsensusPosition;
    const reason = positionMatch[2]?.trim();
    return { position, reason };
  }
  
  // Fallback: analyze content
  const lowerContent = content.toLowerCase();
  
  // Check for objection
  if (
    lowerContent.includes('widerspreche') ||
    lowerContent.includes('einspruch') ||
    lowerContent.includes('kann ich nicht unterstützen') ||
    lowerContent.includes('lehne ab') ||
    lowerContent.includes('i object') ||
    lowerContent.includes('strong objection') ||
    lowerContent.includes('kritische mängel')
  ) {
    return { position: 'OBJECTION' };
  }
  
  // Check for concern
  if (
    lowerContent.includes('bedenken') ||
    lowerContent.includes('sorge') ||
    lowerContent.includes('problematisch') ||
    lowerContent.includes('concern') ||
    lowerContent.includes('worried') ||
    lowerContent.includes('kritisch')
  ) {
    return { position: 'CONCERN' };
  }
  
  // Check for conditional support
  if (
    lowerContent.includes('unter der bedingung') ||
    lowerContent.includes('wenn wir') ||
    lowerContent.includes('sofern') ||
    lowerContent.includes('vorausgesetzt') ||
    lowerContent.includes('with the condition') ||
    lowerContent.includes('provided that')
  ) {
    return { position: 'SUPPORT_WITH_CONDITIONS' };
  }
  
  // Check for support
  if (
    lowerContent.includes('stimme zu') ||
    lowerContent.includes('unterstütze') ||
    lowerContent.includes('gute idee') ||
    lowerContent.includes('einverstanden') ||
    lowerContent.includes('agree') ||
    lowerContent.includes('support')
  ) {
    return { position: 'SUPPORT' };
  }
  
  // Default to CONCERN
  return { position: 'CONCERN', reason: 'Position unclear' };
}

/**
 * Evaluate round for consensus
 */
export function evaluateRound(
  round: number,
  contributions: AgentContribution[]
): RoundResult {
  const positionCounts: Record<ConsensusPosition, number> = {
    'PROPOSAL': 0,
    'SUPPORT': 0,
    'SUPPORT_WITH_CONDITIONS': 0,
    'CONCERN': 0,
    'OBJECTION': 0,
  };
  
  const objections: string[] = [];
  const concerns: string[] = [];
  
  for (const contrib of contributions) {
    positionCounts[contrib.position]++;
    
    if (contrib.position === 'OBJECTION') {
      objections.push(`${contrib.agentName}: ${contrib.positionReason || 'Keine Begründung'}`);
    }
    
    if (contrib.position === 'CONCERN') {
      concerns.push(`${contrib.agentName}: ${contrib.positionReason || 'Unspezifiziertes Bedenken'}`);
    }
  }
  
  // Consensus: No objections and all support or conditional support
  const votingContributions = contributions.filter(c => c.position !== 'PROPOSAL');
  const consensusReached = 
    positionCounts['OBJECTION'] === 0 &&
    votingContributions.length > 0 &&
    votingContributions.every(c => 
      c.position === 'SUPPORT' || c.position === 'SUPPORT_WITH_CONDITIONS'
    );
  
  return {
    round,
    contributions,
    positionCounts,
    consensusReached,
    objections,
    concerns,
  };
}

/**
 * Build prompt for first round (proposal)
 */
export function buildProposerPrompt(topic: string, context: string): string {
  return `Du bist der erste Agent in einer Multi-Agent-Diskussion.

## Deine Aufgabe
Analysiere das folgende Thema und erstelle einen strukturierten Vorschlag.

## Thema
${topic}

${context ? `## Kontext\n${context}` : ''}

## Format
Beende deine Analyse mit einer klaren Position:
[POSITION: PROPOSAL]

Strukturiere deine Antwort mit:
1. Analyse der Situation
2. Konkrete Empfehlungen
3. Action Items (als - [ ] Liste)
`;
}

/**
 * Build prompt for subsequent rounds (responding)
 */
export function buildResponderPrompt(
  topic: string,
  context: string,
  previousContributions: AgentContribution[],
  round: number,
  agentRole: string
): string {
  const previousResponses = previousContributions
    .map(c => `### ${c.agentName} (${c.role}) - [${c.position}]\n${c.content}`)
    .join('\n\n---\n\n');
  
  return `Du bist ein ${agentRole} in Runde ${round} einer Multi-Agent-Diskussion.

## Thema
${topic}

${context ? `## Kontext\n${context}` : ''}

## Bisherige Beiträge
${previousResponses}

## Deine Aufgabe
1. Bewerte die bisherigen Analysen kritisch
2. Ergänze fehlende Perspektiven
3. Reagiere auf Punkte der anderen Agents
4. Bei Meinungsverschiedenheiten: Begründe deine Position

## Position (PFLICHT!)
Beende mit genau einer dieser Positionen:
- [POSITION: SUPPORT] - Volle Zustimmung
- [POSITION: SUPPORT_WITH_CONDITIONS] - Zustimmung mit Bedingungen
- [POSITION: CONCERN] - Bedenken, aber kein Veto
- [POSITION: OBJECTION] - Einspruch, blockiert Konsens

Begründe deine Position kurz nach dem Tag.
`;
}

/**
 * Extract action items from markdown
 */
export function extractActionItems(content: string): string[] {
  const items: string[] = [];
  const regex = /- \[ \] (.+)/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      items.push(match[1]);
    }
  }
  
  return items;
}

/**
 * Format consensus result as markdown
 */
export function formatConsensusResult(result: ConsensusResult): string {
  const lines: string[] = [];
  
  lines.push(`# ${result.topic}`);
  lines.push('');
  lines.push(`**Status:** ${result.consensusReached ? '✅ Konsens erreicht' : '⚠️ Kein Konsens'}`);
  lines.push(`**Runden:** ${result.totalRounds}`);
  lines.push(`**Dauer:** ${Math.round(result.durationMs / 1000)}s`);
  lines.push('');
  
  // Each round
  for (const round of result.rounds) {
    lines.push(`---`);
    lines.push(`## Runde ${round.round}`);
    lines.push('');
    
    // Position summary
    const positions = Object.entries(round.positionCounts)
      .filter(([_, count]) => count > 0)
      .map(([pos, count]) => `${pos}: ${count}`)
      .join(' | ');
    lines.push(`**Positionen:** ${positions}`);
    
    if (round.consensusReached) {
      lines.push('**✅ Konsens in dieser Runde erreicht!**');
    }
    lines.push('');
    
    // Agent contributions
    for (const contrib of round.contributions) {
      lines.push(`### ${contrib.agentName}`);
      const modelInfo = contrib.model ? ` | ${contrib.model}` : '';
      lines.push(`*${contrib.role} | [${contrib.position}] | ${Math.round(contrib.durationMs / 1000)}s${modelInfo}*`);
      lines.push('');
      lines.push(contrib.content);
      lines.push('');
    }
    
    // Objections and concerns
    if (round.objections.length > 0) {
      lines.push('#### ❌ Einsprüche');
      for (const obj of round.objections) {
        lines.push(`- ${obj}`);
      }
      lines.push('');
    }
    
    if (round.concerns.length > 0) {
      lines.push('#### ⚠️ Bedenken');
      for (const concern of round.concerns) {
        lines.push(`- ${concern}`);
      }
      lines.push('');
    }
  }
  
  // Action items
  if (result.actionItems.length > 0) {
    lines.push('---');
    lines.push('## Action Items');
    for (const item of result.actionItems) {
      lines.push(`- [ ] ${item}`);
    }
  }
  
  return lines.join('\n');
}
