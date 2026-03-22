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
  | 'OBJECTION'
  | 'ERROR';

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
  resolvedPoints: string[];
  unresolvedConditions: string[];
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
 * Extract conditions from SUPPORT_WITH_CONDITIONS responses.
 * Looks for numbered lists, bullet points, and bold items after the position tag.
 */
export function extractConditions(contributions: AgentContribution[]): string[] {
  const conditions: string[] = [];

  for (const contrib of contributions) {
    if (contrib.position !== 'SUPPORT_WITH_CONDITIONS') continue;

    const content = contrib.content;

    // Find content after the position tag or after keywords like "Bedingungen", "conditions"
    const positionIdx = content.indexOf('[POSITION: SUPPORT_WITH_CONDITIONS]');
    const searchArea = positionIdx >= 0 ? content : content;

    const lines = searchArea.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Match numbered items: "1. **Plugin-Isolation**: ..." or "1. Plugin müssen..."
      const numberedMatch = trimmed.match(/^\d+\.\s+\*{0,2}(.+?)\*{0,2}(?::\s*(.+))?$/);
      if (numberedMatch) {
        const label = numberedMatch[1]!.replace(/\*{1,2}/g, '').trim();
        // Skip generic intro lines
        if (label.length > 5 && !label.match(/^(ich|wir|das|die|der|es|aber|und|oder|diese|mein|dein)/i)) {
          conditions.push(`[${contrib.agentName}] ${label}`);
          continue;
        }
      }

      // Match bullet points with bold: "- **Condition**: description"
      const bulletMatch = trimmed.match(/^[-*]\s+\*{2}(.+?)\*{2}(?::\s*(.+))?$/);
      if (bulletMatch) {
        const label = bulletMatch[1]!.trim();
        if (label.length > 3) {
          conditions.push(`[${contrib.agentName}] ${label}`);
        }
      }
    }

    // Fallback: if no structured conditions found, use the position reason
    if (conditions.filter(c => c.startsWith(`[${contrib.agentName}]`)).length === 0 && contrib.positionReason) {
      conditions.push(`[${contrib.agentName}] ${contrib.positionReason}`);
    }
  }

  return conditions;
}

/**
 * Check if a condition has been addressed in subsequent contributions.
 * A condition is considered addressed when another agent explicitly references
 * and accepts/discusses it.
 */
export function findAddressedConditions(
  conditions: string[],
  contributions: AgentContribution[]
): string[] {
  const addressed: string[] = [];

  for (const condition of conditions) {
    // Extract the condition text without the agent prefix
    const conditionText = condition.replace(/^\[.+?\]\s*/, '').toLowerCase();
    // Take key words (3+ chars) for matching
    const keywords = conditionText.split(/[\s,.:;-]+/).filter(w => w.length >= 3);

    for (const contrib of contributions) {
      const lowerContent = contrib.content.toLowerCase();
      // Check if enough keywords appear in the response (at least 50% of keywords)
      const matchCount = keywords.filter(kw => lowerContent.includes(kw)).length;
      if (keywords.length > 0 && matchCount >= Math.ceil(keywords.length * 0.5)) {
        // Check for signals of acknowledgement
        if (
          lowerContent.includes('akzeptiert') ||
          lowerContent.includes('einverstanden') ||
          lowerContent.includes('stimme zu') ||
          lowerContent.includes('umgesetzt') ||
          lowerContent.includes('berücksichtigt') ||
          lowerContent.includes('integriert') ||
          lowerContent.includes('addressed') ||
          lowerContent.includes('agreed') ||
          lowerContent.includes('accepted') ||
          contrib.position === 'SUPPORT' ||
          contrib.position === 'SUPPORT_WITH_CONDITIONS'
        ) {
          addressed.push(condition);
          break;
        }
      }
    }
  }

  return addressed;
}

/**
 * Extract resolved/agreed points from contributions where all agents agree.
 * Points are considered resolved when supported (SUPPORT or SUPPORT_WITH_CONDITIONS)
 * and no one objects.
 */
export function extractResolvedPoints(contributions: AgentContribution[]): string[] {
  const resolved: string[] = [];

  for (const contrib of contributions) {
    if (contrib.position === 'SUPPORT' || contrib.position === 'SUPPORT_WITH_CONDITIONS') {
      // Extract key points from supportive contributions
      const lines = contrib.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Capture bullet points, numbered items, and action items that indicate agreement
        if (
          (trimmed.match(/^[-*]\s+\[?[xX✓]\]?\s*(.+)/) ||
           trimmed.match(/^(?:stimme zu|einverstanden|unterstütze|agree|support):\s*(.+)/i) ||
           trimmed.match(/^✅\s*(.+)/))
        ) {
          const point = trimmed.replace(/^[-*]\s+\[?[xX✓]\]?\s*/, '').replace(/^✅\s*/, '').trim();
          if (point.length > 10) {
            resolved.push(point);
          }
        }
      }
    }
  }

  return resolved;
}

/**
 * Evaluate round for consensus
 */
export function evaluateRound(
  round: number,
  contributions: AgentContribution[],
  previousResolvedPoints: string[] = [],
  previousUnresolvedConditions: string[] = []
): RoundResult {
  const positionCounts: Record<ConsensusPosition, number> = {
    'PROPOSAL': 0,
    'SUPPORT': 0,
    'SUPPORT_WITH_CONDITIONS': 0,
    'CONCERN': 0,
    'OBJECTION': 0,
    'ERROR': 0,
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

  // Build resolved points: carry forward previous + extract new from this round
  const newResolved = extractResolvedPoints(contributions);
  const resolvedPoints = [...new Set([...previousResolvedPoints, ...newResolved])];

  // Extract new conditions from this round's SUPPORT_WITH_CONDITIONS
  const newConditions = extractConditions(contributions);

  // Check which previous conditions have been addressed in this round
  const addressedConditions = previousUnresolvedConditions.length > 0
    ? findAddressedConditions(previousUnresolvedConditions, contributions)
    : [];

  // Unresolved = (previous unresolved - addressed) + new conditions
  const stillUnresolved = previousUnresolvedConditions.filter(
    c => !addressedConditions.includes(c)
  );
  const unresolvedConditions = [...new Set([...stillUnresolved, ...newConditions])];

  // Consensus rules:
  // 1. No objections
  // 2. All voting agents support (with or without conditions)
  // 3. No unresolved conditions from previous rounds
  //    (new conditions in this round trigger a follow-up, but don't block
  //     if this is already a condition-focused round with all SUPPORT)
  const votingContributions = contributions.filter(c => c.position !== 'PROPOSAL');
  const allSupport = votingContributions.length > 0 &&
    votingContributions.every(c =>
      c.position === 'SUPPORT' || c.position === 'SUPPORT_WITH_CONDITIONS'
    );

  const hasUnaddressedPreviousConditions = stillUnresolved.length > 0;
  const hasNewConditions = newConditions.length > 0;

  const consensusReached =
    positionCounts['OBJECTION'] === 0 &&
    allSupport &&
    !hasUnaddressedPreviousConditions &&
    // New conditions in first consensus attempt → force follow-up
    // But if we're in round 2+ and agents still add conditions while supporting,
    // accept consensus to avoid endless loops
    (!hasNewConditions || round >= 3);

  return {
    round,
    contributions,
    positionCounts,
    consensusReached,
    objections,
    concerns,
    resolvedPoints,
    unresolvedConditions,
  };
}

/**
 * Build prompt for first round (proposal)
 */
export function buildProposerPrompt(
  topic: string,
  context: string,
  options?: { contextType?: 'inventory' | 'raw-code' | 'none' }
): string {
  const hasCode = context && context.includes('```');
  const hasInventory = options?.contextType === 'inventory';

  return `Du bist der erste Agent in einer Multi-Agent-Diskussion.

## Deine Aufgabe
Analysiere das folgende Thema und erstelle einen strukturierten Vorschlag.
${hasInventory ? `
**PROJEKT-INVENTAR + CODE bereitgestellt:**
Du hast ein strukturiertes Projekt-Inventar (Datei-Uebersicht + Abhaengigkeitsgraph) erhalten,
gefolgt von dem Quellcode der wichtigsten Dateien.
1. Nutze das Inventar fuer den Gesamtueberblick (Architektur, Abhaengigkeiten)
2. Analysiere den bereitgestellten Quellcode im Detail
3. Referenziere konkrete Dateien, Funktionen und Code-Stellen
4. Wenn du Code einer nicht enthaltenen Datei benoetigst, nenne den Pfad explizit` :
hasCode ? `
**WICHTIG - CODE-ANALYSE PFLICHT:**
Dir wurde Quellcode zur Analyse bereitgestellt. Du MUSST:
1. Konkrete Dateinamen nennen (z.B. "In config.ts...")
2. Spezifische Funktionen/Variablen referenzieren
3. Code-Stellen zitieren wenn du Probleme findest
4. Verbesserungen mit konkreten Code-Beispielen zeigen

Beginne deine Analyse mit: "## Code-Analyse" und liste die analysierten Dateien auf!` : ''}

## Thema
${topic}

${context ? `## Code-Kontext (analysiere diesen Code!)\n${context}` : ''}

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
  agentRole: string,
  resolvedPoints: string[] = [],
  options?: { contextType?: 'inventory' | 'raw-code' | 'none' }
): string {
  const previousResponses = previousContributions
    .map(c => `### ${c.agentName} (${c.role}) - [${c.position}]\n${c.content}`)
    .join('\n\n---\n\n');

  const hasCode = context && context.includes('```');
  const hasInventory = options?.contextType === 'inventory';

  const resolvedSection = resolvedPoints.length > 0
    ? `\n## Bereits geklärte Punkte (NICHT erneut diskutieren!)
Die folgenden Punkte wurden in vorherigen Runden bereits akzeptiert.
Wiederhole oder diskutiere diese NICHT erneut. Konzentriere dich NUR auf offene Punkte.

${resolvedPoints.map(p => `- [x] ${p}`).join('\n')}
`
    : '';

  return `Du bist ein ${agentRole} in Runde ${round} einer Multi-Agent-Diskussion.
${hasInventory ? `
**PROJEKT-INVENTAR + CODE bereitgestellt:**
Nutze das Inventar fuer den Gesamtueberblick und den Quellcode fuer Detail-Analyse.
Referenziere konkrete Dateien, Funktionen und Code-Stellen!` :
hasCode ? `
**WICHTIG - CODE-ANALYSE:**
Dir wurde Quellcode bereitgestellt. Referenziere konkrete Dateien, Funktionen und Code-Stellen in deiner Analyse!` : ''}

## Thema
${topic}

${context ? `## Code-Kontext\n${context}` : ''}
${resolvedSection}
## Bisherige Beiträge
${previousResponses}

## Deine Aufgabe
1. Bewerte NUR die noch OFFENEN Punkte kritisch
2. Ergänze fehlende Perspektiven zu offenen Punkten
3. Reagiere auf Punkte der anderen Agents
4. Bei Meinungsverschiedenheiten: Begründe deine Position
5. Wiederhole KEINE bereits geklärten Punkte

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
 * Build prompt for condition-focused follow-up rounds.
 * Directs agents to address specific unresolved conditions rather than
 * reopening the entire discussion.
 */
export function buildConditionRoundPrompt(
  topic: string,
  context: string,
  previousContributions: AgentContribution[],
  round: number,
  agentRole: string,
  unresolvedConditions: string[],
  resolvedPoints: string[] = [],
  options?: { contextType?: 'inventory' | 'raw-code' | 'none' }
): string {
  const previousResponses = previousContributions
    .map(c => `### ${c.agentName} (${c.role}) - [${c.position}]\n${c.content}`)
    .join('\n\n---\n\n');

  const hasCode = context && context.includes('```');
  const hasInventory = options?.contextType === 'inventory';

  const resolvedSection = resolvedPoints.length > 0
    ? `\n## Bereits geklaerte Punkte (NICHT erneut diskutieren!)
${resolvedPoints.map(p => `- [x] ${p}`).join('\n')}
`
    : '';

  const conditionsSection = unresolvedConditions
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  return `Du bist ein ${agentRole} in Runde ${round} einer Multi-Agent-Diskussion.

## FOKUS: Offene Bedingungen klaeren
In der vorherigen Runde wurde bedingte Zustimmung gegeben.
Die folgenden Bedingungen muessen JETZT adressiert werden:

${conditionsSection}

**Deine Aufgabe in dieser Runde:**
- Gehe auf JEDE offene Bedingung ein
- Sage klar ob du die Bedingung akzeptierst, ablehnst oder modifizierst
- Schlage konkrete Umsetzungen vor
- Diskutiere NICHT erneut bereits geklaerte Punkte
${hasInventory ? `
Nutze das Projekt-Inventar und den Code fuer konkrete Referenzen.` :
hasCode ? `
Referenziere konkrete Dateien und Code-Stellen.` : ''}

## Thema
${topic}

${context ? `## Code-Kontext\n${context}` : ''}
${resolvedSection}
## Bisherige Beitraege
${previousResponses}

## Position (PFLICHT!)
Beende mit genau einer dieser Positionen:
- [POSITION: SUPPORT] - Alle Bedingungen akzeptiert/adressiert
- [POSITION: SUPPORT_WITH_CONDITIONS] - Weitere Bedingungen noetig
- [POSITION: CONCERN] - Bedenken bei einzelnen Bedingungen
- [POSITION: OBJECTION] - Bedingungen nicht akzeptabel

Begruende deine Position kurz nach dem Tag.
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

    if (round.unresolvedConditions.length > 0) {
      lines.push(`#### 🔓 Offene Bedingungen (${round.unresolvedConditions.length})`);
      for (const condition of round.unresolvedConditions) {
        lines.push(`- ${condition}`);
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
