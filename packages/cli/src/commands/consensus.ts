/**
 * Consensus Engine
 * 
 * Implements iterative consensus-finding for multi-agent discussions.
 * Agents express positions (SUPPORT, CONCERN, OBJECTION) and iterate
 * until consensus is reached or max rounds are exhausted.
 */

import chalk from 'chalk';

// ============================================================================
// Types
// ============================================================================

/**
 * Agent positions in consensus voting
 */
export type ConsensusPosition = 
  | 'PROPOSAL'           // Initial proposal (proposer only)
  | 'SUPPORT'            // Full support
  | 'SUPPORT_WITH_CONDITIONS'  // Support with conditions
  | 'CONCERN'            // Has concerns but no veto
  | 'OBJECTION';         // Blocks consensus

/**
 * A single contribution in a consensus round
 */
export interface ConsensusContribution {
  /** Agent identifier */
  agentId: string;
  
  /** Agent display name */
  agentName: string;
  
  /** Agent role (coder, reviewer, architect) */
  role: string;
  
  /** Model used */
  model: string;
  
  /** Provider used (CLI, API) */
  provider: string;
  
  /** Agent emoji */
  emoji: string;
  
  /** Full response content */
  content: string;
  
  /** Extracted position */
  position: ConsensusPosition;
  
  /** Position reasoning (if any) */
  positionReason?: string;
  
  /** Timestamp */
  timestamp: Date;
}

/**
 * Status of a single round
 */
export interface RoundStatus {
  /** Round number (1-indexed) */
  round: number;
  
  /** Total rounds allowed */
  maxRounds: number;
  
  /** All contributions this round */
  contributions: ConsensusContribution[];
  
  /** Count by position type */
  positionCounts: Record<ConsensusPosition, number>;
  
  /** Whether consensus was reached */
  consensusReached: boolean;
  
  /** List of blocking objections */
  objections: string[];
  
  /** List of concerns (non-blocking) */
  concerns: string[];
  
  /** List of conditions */
  conditions: string[];
}

/**
 * Final consensus result
 */
export interface ConsensusResult {
  /** Topic of discussion */
  topic: string;
  
  /** All rounds */
  rounds: RoundStatus[];
  
  /** Whether consensus was achieved */
  consensusReached: boolean;
  
  /** Total number of rounds used */
  totalRounds: number;
  
  /** Final consensus summary (if reached) */
  finalConsensus?: string;
  
  /** Action items extracted */
  actionItems: Array<{
    task: string;
    assignee?: string;
  }>;
  
  /** All conditions that must be met */
  allConditions: string[];
  
  /** All noted concerns */
  allConcerns: string[];
  
  /** Total duration in ms */
  durationMs: number;
  
  /** Participating agents */
  participants: Array<{
    id: string;
    name: string;
    role: string;
    model: string;
    provider: string;
  }>;
}

// ============================================================================
// Position Extraction
// ============================================================================

/**
 * Extract position from agent response
 * 
 * Looks for [POSITION: ...] markers in the response.
 * Falls back to content analysis if no marker found.
 */
export function extractPosition(content: string): { 
  position: ConsensusPosition; 
  reason?: string;
} {
  // Look for explicit position marker
  const positionMatch = content.match(/\[POSITION:\s*(SUPPORT_WITH_CONDITIONS|SUPPORT|CONCERN|OBJECTION|PROPOSAL)\](?:\s*[-–—]\s*(.+))?/i);
  
  if (positionMatch) {
    const position = positionMatch[1]!.toUpperCase() as ConsensusPosition;
    const reason = positionMatch[2]?.trim();
    return { position, reason };
  }
  
  // Look for position in text (less reliable)
  const lowerContent = content.toLowerCase();
  
  // Check for objection indicators
  if (
    lowerContent.includes('ich widerspreche') ||
    lowerContent.includes('einspruch') ||
    lowerContent.includes('kann ich nicht unterstützen') ||
    lowerContent.includes('lehne ich ab') ||
    lowerContent.includes('blockierend') ||
    lowerContent.includes('i object') ||
    lowerContent.includes('strong objection')
  ) {
    return { position: 'OBJECTION' };
  }
  
  // Check for concern indicators
  if (
    lowerContent.includes('bedenken') ||
    lowerContent.includes('sorge') ||
    lowerContent.includes('problematisch') ||
    lowerContent.includes('zu bedenken') ||
    lowerContent.includes('concern') ||
    lowerContent.includes('worried')
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
  
  // Check for support indicators
  if (
    lowerContent.includes('stimme zu') ||
    lowerContent.includes('unterstütze') ||
    lowerContent.includes('gute idee') ||
    lowerContent.includes('einverstanden') ||
    lowerContent.includes('agree') ||
    lowerContent.includes('support') ||
    lowerContent.includes('good approach')
  ) {
    return { position: 'SUPPORT' };
  }
  
  // Default to CONCERN if no clear position
  return { position: 'CONCERN', reason: 'Position unclear from response' };
}

/**
 * Extract conditions from response
 */
export function extractConditions(content: string): string[] {
  const conditions: string[] = [];
  
  // Look for explicit conditions
  const conditionPatterns = [
    /(?:unter der bedingung|vorausgesetzt|sofern|wenn wir)[,:]?\s*(.+?)(?:\.|$)/gi,
    /(?:condition|provided that|assuming)[,:]?\s*(.+?)(?:\.|$)/gi,
    /\[BEDINGUNG\]:\s*(.+?)(?:\n|$)/gi,
    /\[CONDITION\]:\s*(.+?)(?:\n|$)/gi,
  ];
  
  for (const pattern of conditionPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const condition = match[1]?.trim();
      if (condition && condition.length > 5) {
        conditions.push(condition);
      }
    }
  }
  
  return conditions;
}

/**
 * Extract action items from response
 */
export function extractActionItems(content: string): Array<{ task: string; assignee?: string }> {
  const items: Array<{ task: string; assignee?: string }> = [];
  
  // Look for action item patterns
  const patterns = [
    /- \[ \]\s*(.+?)(?:\((?:assigned|zugewiesen)[:\s]*(.+?)\))?(?:\n|$)/gi,
    /(?:TODO|TASK|ACTION)[:\s]+(.+?)(?:\n|$)/gi,
    /(?:nächster schritt|next step)[:\s]+(.+?)(?:\n|$)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const task = match[1]?.trim();
      const assignee = match[2]?.trim();
      if (task && task.length > 5) {
        items.push({ task, assignee });
      }
    }
  }
  
  return items;
}

// ============================================================================
// Round Evaluation
// ============================================================================

/**
 * Evaluate a round's contributions
 */
export function evaluateRound(
  round: number,
  maxRounds: number,
  contributions: ConsensusContribution[]
): RoundStatus {
  const positionCounts: Record<ConsensusPosition, number> = {
    'PROPOSAL': 0,
    'SUPPORT': 0,
    'SUPPORT_WITH_CONDITIONS': 0,
    'CONCERN': 0,
    'OBJECTION': 0,
  };
  
  const objections: string[] = [];
  const concerns: string[] = [];
  const conditions: string[] = [];
  
  for (const contrib of contributions) {
    positionCounts[contrib.position]++;
    
    if (contrib.position === 'OBJECTION') {
      objections.push(`${contrib.agentName}: ${contrib.positionReason || 'No reason given'}`);
    }
    
    if (contrib.position === 'CONCERN') {
      concerns.push(`${contrib.agentName}: ${contrib.positionReason || 'Unspecified concern'}`);
    }
    
    if (contrib.position === 'SUPPORT_WITH_CONDITIONS') {
      const extractedConditions = extractConditions(contrib.content);
      conditions.push(...extractedConditions.map(c => `${contrib.agentName}: ${c}`));
      if (contrib.positionReason) {
        conditions.push(`${contrib.agentName}: ${contrib.positionReason}`);
      }
    }
  }
  
  // Consensus is reached when:
  // - No OBJECTION votes
  // - At least one vote (excluding PROPOSAL)
  // - All votes are SUPPORT or SUPPORT_WITH_CONDITIONS
  const votingContributions = contributions.filter(c => c.position !== 'PROPOSAL');
  const consensusReached = 
    positionCounts['OBJECTION'] === 0 &&
    votingContributions.length > 0 &&
    votingContributions.every(c => 
      c.position === 'SUPPORT' || c.position === 'SUPPORT_WITH_CONDITIONS'
    );
  
  return {
    round,
    maxRounds,
    contributions,
    positionCounts,
    consensusReached,
    objections,
    concerns,
    conditions,
  };
}

/**
 * Format round status for display
 */
export function formatRoundStatus(status: RoundStatus): string {
  const parts: string[] = [];
  
  // Position counts
  const counts: string[] = [];
  if (status.positionCounts['SUPPORT'] > 0) {
    counts.push(`${status.positionCounts['SUPPORT']} SUPPORT`);
  }
  if (status.positionCounts['SUPPORT_WITH_CONDITIONS'] > 0) {
    counts.push(`${status.positionCounts['SUPPORT_WITH_CONDITIONS']} SUPPORT_WITH_CONDITIONS`);
  }
  if (status.positionCounts['CONCERN'] > 0) {
    counts.push(`${status.positionCounts['CONCERN']} CONCERN`);
  }
  if (status.positionCounts['OBJECTION'] > 0) {
    counts.push(`${status.positionCounts['OBJECTION']} OBJECTION`);
  }
  
  parts.push(`📊 Status: ${counts.join(', ')}`);
  
  if (status.consensusReached) {
    parts.push(chalk.green('✅ CONSENSUS REACHED!'));
  } else {
    parts.push(chalk.yellow('❌ No consensus'));
    if (status.objections.length > 0) {
      parts.push(chalk.red(`   Blocking: ${status.objections.length} objection(s)`));
    }
  }
  
  return parts.join('\n');
}

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * System prompt addition for consensus protocol
 */
export const CONSENSUS_PROTOCOL_PROMPT = `
## Konsens-Protokoll

Du nimmst an einer strukturierten Multi-Agent-Diskussion teil.
Am Ende deiner Antwort MUSST du eine Position angeben:

- \`[POSITION: SUPPORT]\` - Volle Zustimmung zum Vorschlag
- \`[POSITION: SUPPORT_WITH_CONDITIONS]\` - Zustimmung mit Bedingungen
- \`[POSITION: CONCERN]\` - Bedenken, aber kein Veto (Diskussion kann weitergehen)
- \`[POSITION: OBJECTION]\` - Einspruch, blockiert Konsens (erfordert Überarbeitung)

Beispiel:
"... Zusammenfassend denke ich, der Ansatz ist gut, aber wir sollten X beachten.
[POSITION: SUPPORT_WITH_CONDITIONS] - Memory-Limits müssen definiert werden"

Wenn du OBJECTION wählst, erkläre warum und was geändert werden müsste.
Wenn du SUPPORT_WITH_CONDITIONS wählst, nenne die Bedingungen.
`;

/**
 * Build proposer prompt for a round
 */
export function buildProposerPrompt(
  topic: string,
  round: number,
  previousRound?: RoundStatus
): string {
  const parts: string[] = [];
  
  parts.push(`# Diskussions-Thema\n${topic}`);
  parts.push('');
  
  if (round === 1) {
    parts.push('## Deine Aufgabe');
    parts.push('Erstelle einen initialen Vorschlag zu diesem Thema.');
    parts.push('Strukturiere deinen Vorschlag klar und präzise.');
    parts.push('');
    parts.push('[POSITION: PROPOSAL] am Ende deiner Antwort.');
  } else if (previousRound) {
    parts.push(`## Runde ${round} - Überarbeiteter Vorschlag`);
    parts.push('');
    parts.push('Basierend auf dem Feedback der vorherigen Runde:');
    parts.push('');
    
    // Include feedback
    if (previousRound.objections.length > 0) {
      parts.push('### 🚫 Einsprüche (müssen adressiert werden):');
      for (const obj of previousRound.objections) {
        parts.push(`- ${obj}`);
      }
      parts.push('');
    }
    
    if (previousRound.concerns.length > 0) {
      parts.push('### ⚠️ Bedenken:');
      for (const concern of previousRound.concerns) {
        parts.push(`- ${concern}`);
      }
      parts.push('');
    }
    
    if (previousRound.conditions.length > 0) {
      parts.push('### 📋 Bedingungen:');
      for (const condition of previousRound.conditions) {
        parts.push(`- ${condition}`);
      }
      parts.push('');
    }
    
    parts.push('### Vorherige Beiträge:');
    for (const contrib of previousRound.contributions) {
      parts.push(`**[${contrib.agentName}]** (${contrib.position})`);
      parts.push(contrib.content.slice(0, 500) + (contrib.content.length > 500 ? '...' : ''));
      parts.push('');
    }
    
    parts.push('---');
    parts.push('Erstelle einen ÜBERARBEITETEN Vorschlag, der das Feedback berücksichtigt.');
    parts.push('[POSITION: PROPOSAL] am Ende deiner Antwort.');
  }
  
  return parts.join('\n');
}

/**
 * Build responder prompt for a round
 */
export function buildResponderPrompt(
  topic: string,
  round: number,
  proposal: ConsensusContribution,
  previousResponses: ConsensusContribution[],
  agentRole: string
): string {
  const parts: string[] = [];
  
  parts.push(`# Diskussions-Thema\n${topic}`);
  parts.push('');
  parts.push(`## Runde ${round} - Aktueller Vorschlag`);
  parts.push('');
  parts.push(`**[${proposal.agentName}]** (${proposal.role})`);
  parts.push(proposal.content);
  parts.push('');
  
  if (previousResponses.length > 0) {
    parts.push('## Bisherige Reaktionen dieser Runde:');
    for (const resp of previousResponses) {
      parts.push(`**[${resp.agentName}]** (${resp.position})`);
      parts.push(resp.content.slice(0, 300) + (resp.content.length > 300 ? '...' : ''));
      parts.push('');
    }
  }
  
  parts.push('---');
  parts.push(`Als ${agentRole}: Reagiere auf den Vorschlag.`);
  parts.push('Analysiere kritisch und gib deine Position an.');
  parts.push('');
  parts.push('WICHTIG: Beende deine Antwort mit einer Position:');
  parts.push('- [POSITION: SUPPORT] - Volle Zustimmung');
  parts.push('- [POSITION: SUPPORT_WITH_CONDITIONS] - Mit Bedingungen');
  parts.push('- [POSITION: CONCERN] - Bedenken (kein Veto)');
  parts.push('- [POSITION: OBJECTION] - Einspruch (blockiert)');
  
  return parts.join('\n');
}

// ============================================================================
// Position Emoji & Colors
// ============================================================================

/**
 * Get emoji for position
 */
export function getPositionEmoji(position: ConsensusPosition): string {
  switch (position) {
    case 'PROPOSAL': return '💡';
    case 'SUPPORT': return '✅';
    case 'SUPPORT_WITH_CONDITIONS': return '☑️';
    case 'CONCERN': return '⚠️';
    case 'OBJECTION': return '🚫';
    default: return '❓';
  }
}

/**
 * Get chalk color for position
 */
export function getPositionColor(position: ConsensusPosition): (text: string) => string {
  switch (position) {
    case 'PROPOSAL': return chalk.blue;
    case 'SUPPORT': return chalk.green;
    case 'SUPPORT_WITH_CONDITIONS': return chalk.greenBright;
    case 'CONCERN': return chalk.yellow;
    case 'OBJECTION': return chalk.red;
    default: return chalk.gray;
  }
}
