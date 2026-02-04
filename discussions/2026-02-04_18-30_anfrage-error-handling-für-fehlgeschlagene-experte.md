# Discussion: # Anfrage: Error-Handling für fehlgeschlagene Experten-Antworten

## Problem

Wenn ein Agent/Experte während einer Diskussion einen Fehler hat (z.B. "Claude CLI error"), wird dessen Beitrag einfach übersprungen. Die Frage bleibt unbeantwortet und die Diskussion läuft weiter — mit unvollständigen Informationen.

## Aktuelles Verhalten

```
Round 2/5:
- Planner: Claude CLI error     ← Übersprungen!
- Coder: [Antwort]
- Reviewer: [Antwort]

Round 3/5:
- Planner: [Antwort]            ← Aber ursprüngliche Frage verloren!
```

## Gewünschtes Verhalten

1. **Tracking:** Fehlgeschlagene Fragen in einer Liste speichern
2. **Kontext erhalten:** Wer hat gefragt? Was war der Kontext?
3. **Retry-Möglichkeit:** Am Ende oder zwischen Runden erneut versuchen
4. **Transparenz:** Im Output klar markieren welche Fragen offen blieben
5. **Konsens-Impact:** Berücksichtigen dass Stimme fehlt bei Voting

## Datenstruktur-Vorschlag

```typescript
interface FailedQuestion {
  roundNumber: number;
  agentId: string;
  agentRole: string;
  prompt: string;
  previousContext: string[];  // Was wurde vorher gesagt?
  askedBy?: string;           // Wer hat die Frage gestellt?
  errorMessage: string;
  retryCount: number;
  timestamp: Date;
}

interface DiscussionState {
  rounds: Round[];
  failedQuestions: FailedQuestion[];
  pendingRetries: FailedQuestion[];
}
```

## Fragen an das Team

1. **Retry-Timing:** Sofort retry? Am Ende der Runde? Am Ende der Diskussion?
2. **Max-Retries:** Wie oft versuchen bevor endgültig aufgeben?
3. **Kontext-Update:** Sollte der Agent bei Retry den aktuellen Stand bekommen?
4. **Konsens-Berechnung:** Wie zählt eine fehlende Stimme?
5. **User-Notification:** Popup? Log? Separate Sektion im Output?
6. **Recovery-Mode:** Sollte es eine "Resolve open questions" Phase am Ende geben?

## Output-Format Vorschlag

```markdown
## Open Questions (Unresolved)

⚠️ The following expert responses failed and could not be recovered:

| Round | Agent | Error | Retry Attempts |
|-------|-------|-------|----------------|
| 2 | Planner | CLI timeout | 3 |
| 4 | Reviewer | Rate limit | 2 |

Consider re-running the discussion or manually consulting these experts.
```

## Randbedingungen

- Diskussion sollte nicht endlos hängen wegen Retries
- Partial-Results sind besser als keine Results
- User sollte informiert sein über Lücken
- Konsens-Qualität leidet bei fehlenden Stimmen → warnen!

## Ziel

Robustes Error-Handling das keine Fragen verliert und transparente Ergebnisse liefert.

**Date:** 2026-02-04 18:30
**Participants:** Planner (claude-sonnet-4-20250514), Senior Developer (claude-sonnet-4-20250514), Reviewer (claude-sonnet-4-20250514)
**Rounds:** 4
**Status:** ✅ CONSENSUS REACHED
**Duration:** 395s

---

## Round 1/10

### [Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)

# Vorschlag: Robustes Error-Handling für Diskussions-Experten

## Überblick

Ich schlage ein **3-Schicht Error-Handling System** vor: **Immediate Retry** → **Round Recovery** → **Post-Discussion Cleanup**. Dies maximiert die Erfolgschancen ohne die Diskussion zu blockieren.

## Architektur-Vorschlag

### 1. Erweiterte Datenstrukturen

```typescript
interface FailedQuestion {
  id: string;                    // Eindeutige ID für Tracking
  roundNumber: number;
  agentId: string;
  agentRole: string;
  prompt: string;
  contextSnapshot: string[];     // Diskussions-Stand zum Zeitpunkt
  errorType: 'CLI_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'NETWORK' | 'AUTH';
  errorMessage: string;
  retryCount: number;
  lastRetryAt?: Date;
  maxRetries: number;            // Dynamisch je nach Error-Type
  severity: 'CRITICAL' | 'MEDIUM' | 'LOW';
}

interface DiscussionConfig {
  errorHandling: {
    immediateRetryDelays: number[];     // [1000, 3000, 5000] ms
    roundRecoveryEnabled: boolean;      // Retry am Ende jeder Runde
    postDiscussionRecovery: boolean;    // Final cleanup phase
    maxRetriesPerErrorType: {
      CLI_ERROR: 3;
      TIMEOUT: 2;
      RATE_LIMIT: 4;
      NETWORK: 3;
      AUTH: 1;
    };
    consensusThreshold: {
      withMissing: 0.6;          // 60% bei fehlenden Stimmen
      normal: 0.7;               // 70% bei vollständiger Teilnahme
    };
  };
}
```

### 2. Error-Handling Pipeline

```typescript
class DiscussionErrorHandler {
  private failedQuestions = new Map<string, FailedQuestion>();
  private retryQueue = new PriorityQueue<FailedQuestion>();

  async handleAgentError(
    error: Error, 
    context: DiscussionContext
  ): Promise<'RETRY_NOW' | 'DEFER_TO_ROUND_END' | 'DEFER_TO_DISCUSSION_END' | 'ABANDON'> {
    
    const failedQ = this.createFailedQuestion(error, context);
    this.failedQuestions.set(failedQ.id, failedQ);
    
    // 1. Immediate Retry (für schnelle Fixes)
    if (this.shouldImmediateRetry(failedQ)) {
      await this.delay(this.getRetryDelay(failedQ));
      return 'RETRY_NOW';
    }
    
    // 2. Round Recovery (für Rate Limits etc.)
    if (this.shouldDeferToRoundEnd(failedQ)) {
      this.retryQueue.push(failedQ, this.getPriority(failedQ));
      return 'DEFER_TO_ROUND_END';
    }
    
    // 3. Post-Discussion Recovery (für kritische Fragen)
    if (failedQ.severity === 'CRITICAL') {
      return 'DEFER_TO_DISCUSSION_END';
    }
    
    return 'ABANDON';
  }

  // Retry-Strategien basierend auf Error-Type
  private shouldImmediateRetry(failed: FailedQuestion): boolean {
    return failed.errorType === 'NETWORK' && failed.retryCount < 2;
  }

  private shouldDeferToRoundEnd(failed: FailedQuestion): boolean {
    return ['RATE_LIMIT', 'CLI_ERROR'].includes(failed.errorType);
  }
}
```

### 3. Konsens-Anpassung

```typescript
class ConsensusCalculator {
  calculateAdjustedConsensus(
    responses: AgentResponse[], 
    failedQuestions: FailedQuestion[]
  ): ConsensusResult {
    
    const totalExpectedAgents = responses.length + failedQuestions.length;
    const actualResponses = responses.length;
    const participationRate = actualResponses / totalExpectedAgents;
    
    // Dynamische Schwelle basierend auf Teilnahme
    let threshold = participationRate >= 0.8 ? 0.7 : 0.6;
    
    // Kritische Experten-Fehler → höhere Schwelle nötig
    const criticalMissing = failedQuestions.some(q => 
      ['security', 'architect'].includes(q.agentRole) && q.severity === 'CRITICAL'
    );
    
    if (criticalMissing) {
      threshold = 0.8; // Mehr Sicherheit erforderlich
    }
    
    return {
      consensus: this.calculateVotes(responses) >= threshold,
      confidence: participationRate,
      warnings: this.generateWarnings(failedQuestions),
      threshold
    };
  }
}
```

## Implementation Flow

```
┌─ Agent Request ─┐
│                 │
▼                 │
Try Execute       │
│                 │
├─ Success ────────┴─→ Continue Discussion
│
├─ Error ─┐
          │
          ▼
     Error Handler
          │
          ├─ RETRY_NOW ─────────┐
          │                    │
          ├─ DEFER_TO_ROUND ───┴─→ Add to Retry Queue
          │
          ├─ DEFER_TO_END ─────→ Critical Questions List
          │
          └─ ABANDON ──────────→ Log & Continue
```

## Recovery-Phasen

### Phase 1: Round Recovery
Nach jeder Runde, vor der nächsten:

```typescript
async processRoundRecovery(roundNumber: number): Promise<void> {
  const roundFailures = this.retryQueue.popByRound(roundNumber);
  
  for (const failed of roundFailures) {
    try {
      // Aktueller Kontext + ursprüngliche Frage
      const updatedContext = this.getCurrentDiscussionState();
      const response = await this.retryWithContext(failed, updatedContext);
      
      // Erfolg → zurück in die Diskussion integrieren
      this.integrateDelayedResponse(failed, response, roundNumber + 1);
      
    } catch (error) {
      this.escalateToFinalRecovery(failed);
    }
  }
}
```

### Phase 2: Final Recovery
Am Ende der Diskussion:

```typescript
async processFinalRecovery(): Promise<DiscussionSummary> {
  const criticalFailures = this.getCriticalFailures();
  
  for (const critical of criticalFailures) {
    // Letzter Versuch mit vollständigem Kontext
    const finalAttempt = await this.finalRetryAttempt(critical);
    
    if (finalAttempt.success) {
      // Als "Late Expert Opinion" anhängen
      this.appendLateResponse(critical, finalAttempt.response);
    }
  }
  
  return this.generateSummaryWithGaps();
}
```

## Output-Formatting

```markdown
## Discussion Summary

### Core Results
[Normale Zusammenfassung]

### Expert Recovery Status

✅ **Successfully Recovered** (2/5)
- Round 2, Security Expert: Recovered in round 3
- Round 4, Performance Expert: Recovered post-discussion

⚠️ **Partial Recovery** (1/5)  
- Round 3, Database Expert: CLI timeout (3/3 retries failed)
  *Impact: Database optimization concerns not fully addressed*

❌ **Unresolved** (2/5)
- Round 1, UX Expert: Authentication failure
- Round 4, DevOps Expert: Rate limit exceeded

### Consensus Confidence
- **Adjusted Threshold:** 60% (vs normal 70% due to missing inputs)
- **Participation Rate:** 75% (9/12 expected responses)
- **Final Consensus:** ✅ Achieved (confidence: MEDIUM)

⚠️ **Recommendation:** Consider manual consultation with unresolved experts before implementation.
```

## Konfiguration per Discussion Type

```yaml
discussionTypes:
  architecture_review:
    errorHandling:
      criticalRoles: [architect, security, performance]
      maxMissingCritical: 1
      consensusThreshold: 0.8

  feature_planning:
    errorHandling:
      criticalRoles: [product, ux]
      maxMissingCritical: 0
      consensusThreshold: 0.7
      
  bug_triage:
    errorHandling:
      criticalRoles: [debug_specialist, affected_team_lead]
      maxMissingCritical: 0
      consensusThreshold: 0.6
      fastRetryEnabled: true
```

## Monitoring & Metrics

```typescript
interface ErrorMetrics {
  totalFailures: number;
  failuresByType: Record<ErrorType, number>;
  recoveryRate: {
    immediate: number;    // 0.0 - 1.0
    roundEnd: number;
    postDiscussion: number;
  };
  averageRetryDelay: number;
  consensusImpact: {
    discussionsAffected: number;
    thresholdLowerings: number;
  };
}
```

## Vorteile dieses Ansatzes

1. **Nicht-blockierend:** Diskussion läuft weiter trotz Fehlern
2. **Maximale Recovery:** 3 Stufen für verschiedene Error-Types
3. **Transparenz:** Klare Kommunikation was fehlt/recovered wurde
4. **Adaptive Schwellen:** Konsens passt sich an Teilnahme an
5. **Priorisierung:** Kritische Experten bekommen mehr Retry-Versuche
6. **Konfigurierbar:** Per Diskussions-Type anpassbar

## Implementierungs-Prioritäten

1. **Phase 1:** Immediate Retry + Basic Error Tracking
2. **Phase 2:** Round Recovery + Adjusted Consensus  
3. **Phase 3:** Final Recovery + Rich Output Formatting
4. **Phase 4:** Advanced Metrics + Discussion-Type Configs

[POSITION: PROPOSAL] - Dreischichtiges Error-Handling mit adaptiven Schwellen und transparenter Recovery-Kommunikation

**Position:** 💡 PROPOSAL - Dreischichtiges Error-Handling mit adaptiven Schwellen und transparenter Recovery-Kommunikation

### [Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)

spawn ENAMETOOLONG

**Position:** ⚠️ CONCERN - Position unclear from response

### [Reviewer] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)

spawn ENAMETOOLONG

**Position:** ⚠️ CONCERN - Position unclear from response

**Round Status:**
- Positions: 2 CONCERN
- Consensus: No

---

## Round 2/10

### [Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)

Claude CLI error

**Position:** 💡 PROPOSAL - Position unclear from response

### [Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)

## Code-Perspektive zum Error-Handling

Als Entwickler sehe ich das Problem täglich: Ein API-Call scheitert, ein CLI timeoutet, und plötzlich fehlen kritische Informationen in der Pipeline. Der Vorschlag ist technisch solide und praktikabel.

### Implementation-Details

**Retry-Strategie:**
```typescript
class RetryManager {
  private backoffDelays = [1000, 2000, 5000]; // ms
  
  async retryWithBackoff(failed: FailedQuestion): Promise<AgentResponse | null> {
    for (let i = 0; i < this.backoffDelays.length; i++) {
      await this.delay(this.backoffDelays[i]);
      try {
        return await this.executeAgent(failed.agentId, failed.prompt);
      } catch (error) {
        failed.retryCount++;
        // Continue to next attempt
      }
    }
    return null; // Final failure
  }
}
```

**Kontext-Preservation:**
```typescript
interface RetryContext {
  originalPrompt: string;
  discussionState: string; // Markdown der bisherigen Diskussion
  specificContext: string; // Was hat sich seit Original-Frage geändert?
}

// Beim Retry: Kontext erweitern statt ersetzen
const retryPrompt = `${originalPrompt}

CONTEXT UPDATE:
${discussionState}

Please provide your expert response considering the above discussion.`;
```

### Edge-Cases die beachtet werden müssen

1. **Cascading Failures:** Agent A scheitert → Agent B kann nicht antworten weil Input fehlt
2. **Circular Dependencies:** Agent A wartet auf B, B wartet auf A-Retry
3. **Memory Leaks:** FailedQuestion-Arrays können bei vielen Diskussionen groß werden
4. **Race Conditions:** Retry läuft während neue Runde startet

### Konsens-Impact Handling

```typescript
calculateConsensus(responses: AgentResponse[], failed: FailedQuestion[]): ConsensusResult {
  const totalExpected = responses.length + failed.length;
  const actualVotes = responses.length;
  
  // Warnung bei <80% Participation
  if (actualVotes / totalExpected < 0.8) {
    return {
      consensus: false,
      confidence: 'LOW',
      reason: `Only ${actualVotes}/${totalExpected} experts responded`
    };
  }
  
  // Normal consensus calculation
  return this.standardConsensus(responses);
}
```

### Performance-Überlegungen

- **Timeout-Kaskaden:** Ein langsamer Agent kann ganze Diskussion verzögern
- **Resource-Limits:** Multiple Retries = mehr API-Calls = höhere Kosten  
- **Memory Usage:** Kontext kann bei langen Diskussionen sehr groß werden

### Praktische Umsetzung

1. **Timing:** Retry am Ende jeder Runde (nicht sofort)
2. **Max-Retries:** 3 Attempts mit exponential backoff
3. **Graceful Degradation:** Weitermachen auch wenn Retries scheitern
4. **Clear Logging:** Jeder Fehler dokumentiert für Debugging

### Code-Qualität Aspekte

Der Vorschlag befolgt Clean Code Prinzipien:
- Single Responsibility (FailedQuestion, RetryManager)
- Fail-Safe (Diskussion läuft weiter)
- Observable (Transparente Logs)
- Testable (Klare Interfaces)

**[POSITION: SUPPORT_WITH_CONDITIONS]** - Timeout-Limits und Memory-Management müssen definiert werden, sonst kann das System bei vielen Failures hängen bleiben oder zu viel RAM verbrauchen.

**Position:** ☑️ SUPPORT_WITH_CONDITIONS

### [Reviewer] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)

## Kritische Analyse des Error-Handling-Vorschlags

### Risiken und Probleme

**1. Performance-Degradation**
- Retry-Mechanismus kann Diskussionen erheblich verlängern
- Cascade-Failures: Wenn ein Agent wiederholt fehlschlägt, blockiert er die gesamte Pipeline
- Memory-Overhead: Speichern aller failed questions mit vollem Kontext

**2. Race Conditions & State-Konsistenz**
- Was passiert wenn während Retry andere Agents neue Erkenntnisse haben?
- Context-Staleness: Retry mit veraltetem Kontext kann schlechte Antworten produzieren
- Deadlock-Potential bei zirkulären Dependencies

**3. Komplexitäts-Explosion**
```typescript
// Das wird schnell zu komplex:
if (retry.count < MAX_RETRIES) {
  if (shouldUpdateContext()) {
    context = await rebuildContext(retry.roundNumber);
    // Aber was wenn rebuildContext() auch fehlschlägt?
  }
  // Exponential backoff? Linear? User-configurable?
}
```

**4. User Experience Verschlechterung**
- User wartet länger, bekommt aber möglicherweise schlechtere Ergebnisse
- Unvorhersagbare Execution-Zeiten
- False Promise: "Alle Fragen werden beantwortet" vs. Realität

### Edge-Cases

**Was bei diesen Szenarien?**
- Agent stirbt während Retry → Stack overflow
- Network partition → Endlos-Retries 
- Rate limiting → Alle Agents betroffen
- Malformed response nach Retry → Parse error

### Alternative: Fail-Fast mit Recovery-Mode

```typescript
// Weniger komplex, vorhersagbarer:
interface DiscussionResult {
  consensus: ConsensusResult;
  warnings: Warning[];
  recovery: {
    availableExperts: string[];
    manualQuestions: string[];
  }
}
```

**Vorteile:**
- Keine Retry-Komplexität
- User hat Kontrolle über Follow-up
- Klare Expectations
- Deterministische Performance

### Memory-Leak Risiko

Die `FailedQuestion` Struktur speichert `previousContext: string[]` - bei langen Diskussionen wird das exponentiell groß. Fehler-Objekte leben länger als die eigentliche Diskussion.

### Konsens-Validität Problem

Ein 70%-Konsens von 3/5 Agents ist etwas anderes als 70% von 4/5 wegen einem Error. Der Vorschlag behandelt das nicht adäquat.

**Mein Gegenvorschlag:**
1. Fail-Fast mit klarem Logging
2. Separate "Resolution Phase" nur auf User-Request
3. Memory-effiziente Error-Sammlung
4. Transparente Konsens-Qualitäts-Metriken

[POSITION: CONCERN] - Retry-Mechanismus zu komplex, bevorzuge Fail-Fast mit Recovery-Option

**Position:** ⚠️ CONCERN - Retry-Mechanismus zu komplex, bevorzuge Fail-Fast mit Recovery-Option

**Round Status:**
- Positions: 1 SUPPORT_WITH_CONDITIONS, 1 CONCERN
- Consensus: No

---

## Round 3/10

### [Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)

# Überarbeiteter Vorschlag: Pragmatisches Error-Handling für Experten-Antworten

## Kernprinzip: Fail-Fast + Smart Recovery

Basierend auf dem Feedback implementieren wir ein **zweistufiges System**: Schnell erkennen wann etwas schief läuft, dann benutzergesteuerte Recovery ohne die laufende Diskussion zu blockieren.

## 1. Sofortige Fehlerbehandlung (Fail-Fast)

```typescript
interface FailedQuestion {
  roundNumber: number;
  agentId: string;
  agentRole: string;
  question: string;
  errorType: 'timeout' | 'rate_limit' | 'auth_failed' | 'unknown';
  errorMessage: string;
  timestamp: Date;
  contextSnapshot: string[];  // Nur letzten 3 Beiträge
}

interface DiscussionResult {
  rounds: Round[];
  consensus: ConsensusResult;
  failedQuestions: FailedQuestion[];
  completionStatus: 'complete' | 'partial' | 'degraded';
}
```

**Timeout-Limits:**
- Agent-Response: 30s max
- Gesamte Diskussion: 10min max
- Memory-Limit: Max 50 failed questions gespeichert

## 2. Memory-Management (Reviewer's Bedenken adressiert)

```typescript
class DiscussionManager {
  private readonly MAX_FAILED_QUESTIONS = 50;
  private readonly MAX_CONTEXT_LINES = 3;
  
  addFailedQuestion(failed: FailedQuestion): void {
    // LRU eviction bei Memory-Limit
    if (this.failedQuestions.length >= this.MAX_FAILED_QUESTIONS) {
      this.failedQuestions.shift(); // Älteste entfernen
    }
    
    // Kontext begrenzen
    failed.contextSnapshot = failed.contextSnapshot.slice(-this.MAX_CONTEXT_LINES);
    this.failedQuestions.push(failed);
  }
}
```

## 3. Intelligente Konsens-Berechnung

```typescript
interface ConsensusResult {
  decision: 'approve' | 'reject' | 'incomplete';
  confidence: number; // 0-1, reduziert bei missing votes
  votes: AgentVote[];
  missingVotes: string[];
  reliability: 'high' | 'medium' | 'low'; // Basiert auf failure rate
}

function calculateReliability(totalAgents: number, failedCount: number): string {
  const failureRate = failedCount / totalAgents;
  if (failureRate === 0) return 'high';
  if (failureRate < 0.3) return 'medium';
  return 'low';
}
```

## 4. Benutzergesteuerte Recovery

**Ende der Diskussion:**
```
🎯 Discussion Complete (PARTIAL - 2 questions failed)

┌─ Consensus: SUPPORT_WITH_CONDITIONS (confidence: 0.7) ─┐
│ ✓ Planner: SUPPORT                                    │
│ ✓ Coder: SUPPORT_WITH_CONDITIONS                      │
│ ✗ Reviewer: [TIMEOUT]                                 │
│ ✗ Security: [RATE_LIMIT]                              │
└─ Reliability: MEDIUM (2/4 agents responded) ──────────┘

⚠️  Missing Expert Input:
• Reviewer (Round 2): Security implications of new auth flow
• Security (Round 3): Rate limiting strategy validation

Options:
[r] Retry failed questions now
[c] Continue with partial consensus  
[m] Manual expert consultation
[s] Skip and document gaps
```

## 5. Vereinfachte Recovery-Optionen

**Option R - Targeted Retry:**
```typescript
async retryFailedQuestions(): Promise<void> {
  for (const failed of this.failedQuestions) {
    if (failed.errorType === 'timeout' || failed.errorType === 'rate_limit') {
      // Einfacher einzelner Retry, kein Backoff
      const response = await this.askAgent(failed.agentId, failed.question);
      if (response) {
        console.log(`✓ Recovered: ${failed.agentRole}`);
        this.failedQuestions = this.failedQuestions.filter(f => f !== failed);
      }
    }
  }
}
```

**Option M - Manual Mode:**
```
🤝 Manual Expert Consultation

Missing: Reviewer opinion on "Security implications of new auth flow"

[Your input as Reviewer]: [____________]
[Skip this question]:     [s]
[Ask different expert]:   [a]
```

## 6. Transparente Dokumentation

**Output-Format:**
```markdown
# Multi-Agent Discussion Results

## Consensus: SUPPORT_WITH_CONDITIONS
**Confidence:** Medium (70%) - 2 of 4 experts responded
**Reliability:** Medium - Some expert input missing

### Expert Positions:
✓ **Planner**: SUPPORT - Architecture looks solid
✓ **Coder**: SUPPORT_WITH_CONDITIONS - Need better error handling
⚠️ **Reviewer**: TIMEOUT - Question about security implications unresolved
⚠️ **Security**: RATE_LIMIT - Rate limiting validation pending

### Unresolved Questions:
1. **Security implications** (asked to Reviewer, Round 2)
2. **Rate limiting strategy** (asked to Security, Round 3)

**⚠️ Recommendation:** Consider manual expert review before implementation
```

## 7. Pragmatische Defaults

```typescript
const ERROR_HANDLING_CONFIG = {
  maxRetries: 1,                    // Nur 1 Retry statt 3
  retryTimeoutMs: 15000,           // Kurzer Timeout für Retry
  continueOnPartialConsensus: true, // Nicht blockieren
  minRequiredVotes: 2,             // Minimum für gültigen Konsens
  autoRecoveryThreshold: 0.7       // Bei >70% failures keine Auto-Recovery
};
```

## Kernvorteile dieses Ansatzes

✅ **Performance**: Keine blocking retries während Diskussion
✅ **Memory-sicher**: Begrenzte Queue-Größe, kompakter Kontext  
✅ **Benutzerfreundlich**: Klare Optionen statt automatischer Complexity
✅ **Transparent**: Zeigt deutlich was fehlt und warum
✅ **Flexibel**: Verschiedene Recovery-Strategien je nach Situation
✅ **Fail-Safe**: System läuft auch bei partial failures weiter

Der Ansatz bevorzugt **"gute genug" Ergebnisse schnell** über **"perfekte" Ergebnisse langsam**, was für die meisten praktischen Use Cases optimal ist.

[POSITION: PROPOSAL] - Implementiert Fail-Fast mit benutzergesteuerten Recovery-Optionen, begrenzt Memory-Footprint und bietet transparente partial-consensus Unterstützung

**Position:** 💡 PROPOSAL - Implementiert Fail-Fast mit benutzergesteuerten Recovery-Optionen, begrenzt Memory-Footprint und bietet transparente partial-consensus Unterstützung

### [Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)

## Code-Implementation Analyse des Error-Handling Vorschlags

Als Entwickler sehe ich sowohl starke Punkte als auch kritische Implementierungs-Details, die geklärt werden müssen.

### ✅ Starke Architektur-Entscheidungen

**LRU-basierte Memory-Limits:**
```typescript
// Gut: Verhindert Memory-Leaks
if (this.failedQuestions.length >= this.MAX_FAILED_QUESTIONS) {
  this.failedQuestions.shift(); // Oldest first
}
```

**Fail-Fast Pattern mit Timeouts:**
```typescript
// Sinnvoll: Keine hängenden Diskussionen
const TIMEOUTS = {
  agentResponse: 30000,    // 30s
  totalDiscussion: 600000, // 10min
  retryResponse: 15000     // 15s
};
```

### 🚨 Kritische Implementierungs-Bedenken

**1. Race Conditions bei Concurrent Retries:**
```typescript
// Problematisch - mehrere gleichzeitige retryFailedQuestions()
async retryFailedQuestions(): Promise<void> {
  for (const failed of this.failedQuestions) { // ← Kann sich während Loop ändern
    // ...
    this.failedQuestions = this.failedQuestions.filter(f => f !== failed);
  }
}
```

**Lösung:**
```typescript
private retryInProgress = false;

async retryFailedQuestions(): Promise<void> {
  if (this.retryInProgress) throw new Error('Retry already in progress');
  this.retryInProgress = true;
  
  try {
    const toRetry = [...this.failedQuestions]; // Snapshot
    for (const failed of toRetry) {
      // ... retry logic
    }
  } finally {
    this.retryInProgress = false;
  }
}
```

**2. Error-Type Detection - Zu optimistisch:**
```typescript
// Wie erkennst du zuverlässig errorType?
errorType: 'timeout' | 'rate_limit' | 'auth_failed' | 'unknown';
```

Claude CLI gibt oft generische Fehlermeldungen. Brauchen wir robuste Parsing-Regeln:
```typescript
function classifyError(message: string): ErrorType {
  if (/timeout|timed out/i.test(message)) return 'timeout';
  if (/rate limit|too many requests/i.test(message)) return 'rate_limit';
  if (/auth|unauthorized|forbidden/i.test(message)) return 'auth_failed';
  return 'unknown';
}
```

**3. Context-Snapshot Performance:**
```typescript
// Bei jeder failed question den Context kopieren?
failed.contextSnapshot = failed.contextSnapshot.slice(-this.MAX_CONTEXT_LINES);
```

Das sollte lazy/on-demand passieren, nicht bei jedem Fehler:
```typescript
interface FailedQuestion {
  // ... andere fields
  getContext(): string[] {
    return this.discussion.getRecentContext(this.roundNumber, 3);
  }
}
```

### 🔧 Implementierungs-Komplexität

**User-Interface für Recovery:**
```bash
# Das Manual Mode Interface ist komplex zu implementieren
[Your input as Reviewer]: [____________]  # ← Wie validieren wir das?
[Ask different expert]:   [a]            # ← Agent-Substitution Logic?
```

Einfachere Alternative:
```typescript
enum RecoveryAction {
  RETRY_FAILED,     // Nur retry, kein Manual Input
  SKIP_AND_LOG,     // Dokumentiere als missing
  ABORT_DISCUSSION  // Bei kritischen failures
}
```

### 💡 Code-Qualitäts-Verbesserungen

**1. Builder Pattern für DiscussionResult:**
```typescript
class DiscussionResultBuilder {
  private result: Partial<DiscussionResult> = {};
  
  withFailedQuestion(failed: FailedQuestion): this {
    this.result.failedQuestions = [...(this.result.failedQuestions || []), failed];
    return this;
  }
  
  build(): DiscussionResult {
    const failureRate = this.calculateFailureRate();
    return {
      ...this.result,
      completionStatus: failureRate > 0.5 ? 'degraded' : 
                       failureRate > 0 ? 'partial' : 'complete'
    };
  }
}
```

**2. Error-specific Retry-Strategien:**
```typescript
const RETRY_STRATEGIES = {
  timeout: { maxRetries: 1, backoffMs: 0 },
  rate_limit: { maxRetries: 2, backoffMs: 5000 },
  auth_failed: { maxRetries: 0, backoffMs: 0 }, // Sofort aufgeben
  unknown: { maxRetries: 1, backoffMs: 1000 }
};
```

### 🎯 Vereinfachungs-Vorschlag

Statt komplexer Recovery-Modi, fokussiere auf zwei klare Pfade:

```typescript
class ErrorHandling {
  // Pfad 1: Silent Recovery (für unkritische failures)
  async attemptSilentRecovery(failed: FailedQuestion): Promise<boolean> {
    if (failed.errorType === 'timeout' && failed.retryCount === 0) {
      return await this.singleRetry(failed);
    }
    return false; // Keine automatische Recovery
  }
  
  // Pfad 2: Report & Continue (für alle anderen)
  reportIncompleteConsensus(result: DiscussionResult): void {
    console.log(`⚠️  ${result.failedQuestions.length} questions unresolved`);
    console.log('Consensus based on available responses only');
  }
}
```

### 📊 Testing-Überlegungen

Wir brauchen umfangreiche Tests für Edge Cases:
- Was passiert bei 100% failure rate?
- Memory-Behavior bei vielen kleinen vs wenigen großen Context-Snapshots
- Performance bei 1000+ concurrent discussions

[POSITION: SUPPORT_WITH_CONDITIONS] - Grundkonzept ist solide, aber Implementierung muss vereinfacht werden. Race Condition Protection, robuste Error-Classification und simplere Recovery-Modi sind Voraussetzungen für eine stabile Implementation.

**Position:** ☑️ SUPPORT_WITH_CONDITIONS - Grundkonzept ist solide, aber Implementierung muss vereinfacht werden. Race Condition Protection, robuste Error-Classification und simplere Recovery-Modi sind Voraussetzungen für eine stabile Implementation.

### [Reviewer] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)

Claude CLI error

**Position:** ⚠️ CONCERN - Position unclear from response

**Round Status:**
- Positions: 1 SUPPORT_WITH_CONDITIONS, 1 CONCERN
- Consensus: No

---

## Round 4/10

### [Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)

# Überarbeiteter Vorschlag: Vereinfachtes Error-Handling mit transparenter Recovery

## Kernprinzip: Einfach, Robust, Transparent

Basierend auf dem Feedback vereinfachen wir das Error-Handling drastisch und fokussieren auf die drei wichtigsten Aspekte:

### 1. Error-Classification (Vereinfacht)

```typescript
enum ErrorType {
  RETRYABLE = 'retryable',    // CLI timeout, network errors
  FATAL = 'fatal',            // Auth errors, invalid config
  RATE_LIMITED = 'rate_limited' // Rate limits
}

interface FailedQuestion {
  agentId: string;
  agentRole: string;
  question: string;
  errorType: ErrorType;
  errorMessage: string;
  timestamp: Date;
}
```

### 2. Sofortige Behandlung (Keine komplexe Recovery)

```typescript
async askExpert(agentId: string, question: string): Promise<string | null> {
  try {
    return await this.callAgent(agentId, question);
  } catch (error) {
    const errorType = this.classifyError(error);
    
    // NUR ein Retry-Versuch für RETRYABLE errors
    if (errorType === ErrorType.RETRYABLE) {
      try {
        await this.sleep(2000); // 2s wait
        return await this.callAgent(agentId, question);
      } catch (retryError) {
        this.recordFailedQuestion(agentId, question, retryError);
        return null; // Continue without this expert
      }
    }
    
    this.recordFailedQuestion(agentId, question, error);
    return null;
  }
}
```

### 3. Transparente Dokumentation

```typescript
interface DiscussionResult {
  rounds: Round[];
  consensus: ConsensusResult;
  failedQuestions: FailedQuestion[];
  qualityWarnings: string[];
}
```

### 4. Output-Format

```markdown
## Discussion Results

### Consensus: ACHIEVED (7/8 experts responded)
- Planner: SUPPORT_WITH_CONDITIONS
- Coder: SUPPORT  
- Reviewer: **FAILED** (CLI timeout)
- Senior Developer: SUPPORT_WITH_CONDITIONS

⚠️ **Quality Impact**: 1 expert unreachable - consensus based on 7/8 responses

### Failed Questions (1)
| Expert | Error | Question Preview |
|--------|--------|------------------|
| Reviewer | CLI timeout after retry | "What are the security implications..." |

**Recommendation**: Re-run discussion or manually consult Reviewer role for complete coverage.
```

### 5. Memory-Protection (Einfach)

```typescript
class FailedQuestionTracker {
  private failedQuestions: FailedQuestion[] = [];
  private readonly MAX_FAILED = 50; // Simple limit
  
  record(failed: FailedQuestion): void {
    this.failedQuestions.push(failed);
    
    // Simple LRU cleanup
    if (this.failedQuestions.length > this.MAX_FAILED) {
      this.failedQuestions.shift();
    }
  }
}
```

### 6. Konsens-Anpassung (Pragmatisch)

```typescript
calculateConsensus(responses: AgentResponse[]): ConsensusResult {
  const totalExpected = this.agents.length;
  const actualResponses = responses.filter(r => r.response !== null);
  const failedCount = totalExpected - actualResponses.length;
  
  return {
    achieved: actualResponses.length >= this.minimumResponses,
    confidence: actualResponses.length / totalExpected,
    qualityWarnings: failedCount > 0 ? 
      [`${failedCount} expert(s) unreachable - reduced confidence`] : []
  };
}
```

## Implementierung: 3 Phasen

### Phase 1: Error-Classification & Single Retry
- Implementiere `classifyError()` basierend auf bekannten Error-Patterns
- Ein Retry-Versuch mit 2s Delay für RETRYABLE errors
- Dokumentation aller Failed Questions

### Phase 2: Transparente Ausgabe
- Failed Questions in Discussion Results
- Quality Warnings im Output
- Clear recommendations für User

### Phase 3: Konsens-Anpassung
- Confidence-Score basierend auf Response-Rate
- Minimum-Response-Threshold konfigurierbar
- Quality-Impact Warnings

## Vereinfachungen gegenüber ursprünglichem Vorschlag:

1. **Kein komplexes Recovery-System** - nur ein Retry
2. **Keine Race Condition Protection** - einfacher sequential flow
3. **Keine User-Intervention** während Discussion
4. **Feste Error-Categories** statt dynamische Classification
5. **Einfache Memory-Limits** statt intelligente Cleanup-Strategien

## Vorteile dieser Vereinfachung:

- **Implementierbar**: Klare, überschaubare Schritte
- **Robust**: Fail-Fast verhindert hängende Diskussionen  
- **Transparent**: User sieht was schief gelaufen ist
- **Vorhersagbar**: Keine komplexen Recovery-Modi
- **Memory-Safe**: Einfache aber effektive Limits

Die Lösung fokussiert auf **Transparenz über Perfektion** - besser eine ehrliche Antwort mit dokumentierten Lücken als eine scheinbar perfekte aber unzuverlässige.

[POSITION: PROPOSAL]

**Position:** 💡 PROPOSAL

### [Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)

Aus Implementierungs-Sicht analysiere ich den vereinfachten Vorschlag:

## Positive Aspekte

**Klare Code-Struktur**: Der Ansatz mit `ErrorType` enum und einfacher Retry-Logik ist sauber implementierbar. Die `askExpert()` Methode hat eine klare Verantwortlichkeit und vorhersagbares Verhalten.

**Robustes Error-Handling**: Die Kategorisierung in RETRYABLE/FATAL/RATE_LIMITED deckt die häufigsten CLI-Fehler ab. Ein single retry mit 2s delay ist ein bewährtes Pattern - nicht zu aggressiv, aber fängt transiente Probleme ab.

**Memory-Safety**: Die einfache LRU-Strategie mit MAX_FAILED=50 ist pragmatisch und verhindert Memory-Leaks ohne Overhead.

## Implementierungs-Bedenken

**Error-Classification-Logic**: Die `classifyError()` Methode wird komplex werden. Verschiedene CLIs (Claude, Gemini, GPT-4) haben unterschiedliche Error-Patterns:

```typescript
classifyError(error: unknown): ErrorType {
  const message = error instanceof Error ? error.message : String(error);
  
  // Claude CLI specific
  if (message.includes('timeout') || message.includes('ECONNRESET')) {
    return ErrorType.RETRYABLE;
  }
  
  // Gemini CLI specific  
  if (message.includes('rate limit exceeded')) {
    return ErrorType.RATE_LIMITED;
  }
  
  // Auth issues - verschiedene Formate je Provider
  if (message.includes('unauthorized') || message.includes('invalid api key')) {
    return ErrorType.FATAL;
  }
  
  // Default fallback?
  return ErrorType.FATAL; // Oder RETRYABLE?
}
```

**Async Error-Handling Edge Cases**: Was passiert wenn der Retry selbst eine Exception wirft? Der Code muss defensive Programming für alle CLI-Interaktionen haben.

**TypeScript-Typ-Safety**: `FailedQuestion` sollte generic sein für verschiedene Agent-Typen. Aktuell ist `agentId: string` zu lose.

## Performance-Überlegungen

**Blocking Retries**: Der 2s `sleep()` blockiert die gesamte Discussion. Bei 8 Experten mit jeweils potentiellen Retries können das 16+ Sekunden Delay werden.

**Besserer Ansatz**:
```typescript
const RETRY_DELAYS = { 
  [ErrorType.RETRYABLE]: 1000,
  [ErrorType.RATE_LIMITED]: 5000 
};
```

**Concurrent vs Sequential**: Sollten wir failed questions parallel retry-en statt sequential?

## Code-Quality Verbesserungen

**Error-Context verloren**: Aktuell speichern wir nur `errorMessage: string`. Für Debugging brauchen wir mehr:

```typescript
interface FailedQuestion {
  agentId: string;
  agentRole: string; 
  question: string;
  errorType: ErrorType;
  originalError: Error;        // Full error object
  context: {                   // Debug context
    roundNumber: number;
    timestamp: Date;
    previousResponses: string[];
  };
  retryAttempted: boolean;
  retryError?: Error;
}
```

**Configuration needed**:
```typescript
interface ErrorHandlingConfig {
  maxRetries: number;           // Currently hardcoded to 1
  retryDelayMs: number;         // Currently hardcoded to 2000
  maxFailedQuestions: number;   // Currently hardcoded to 50
  minimumResponses: number;     // For consensus calculation
}
```

## Implementierungs-Priorität

1. **Phase 1 ist machbar** - Error classification + single retry
2. **Phase 2 braucht UI-Design** - Wie zeigen wir failed questions benutzerfreundlich?
3. **Phase 3 ist algorithmisch** - Consensus-Berechnung mit missing votes

**Aufwands-Schätzung**: 2-3 Tage für Phase 1, wenn Error-Patterns für alle CLIs dokumentiert sind.

## Praktische Concerns

**Testing**: Wie simulieren wir CLI-Failures für Tests? Brauchen Mock-CLIs mit kontrollierten Error-Modes.

**Monitoring**: In Produktion brauchen wir Metrics über Error-Rates pro Agent-Type.

**Graceful Degradation**: Was ist das Minimum viable consensus? 50% der Experten? 1 Expert? Konfigurierbar machen.

Insgesamt ist der Vorschlag gut implementierbar, aber die Error-Classification-Logik wird die meiste Arbeit sein.

[POSITION: SUPPORT_WITH_CONDITIONS] - Error-Context erweitern, Configuration-Layer hinzufügen, Error-Patterns je CLI dokumentieren

**Position:** ☑️ SUPPORT_WITH_CONDITIONS - Error-Context erweitern, Configuration-Layer hinzufügen, Error-Patterns je CLI dokumentieren

### [Reviewer] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)

Als reviewer analysiere ich den vereinfachten Error-Handling Vorschlag kritisch:

## Positive Bewertung

**Pragmatischer Ansatz**: Die Fokussierung auf "Transparenz über Perfektion" ist sinnvoll. Besser eine funktionierende Lösung mit dokumentierten Schwächen als ein überkomplexes System.

**Klare Error-Classification**: Die drei ErrorTypes (RETRYABLE, FATAL, RATE_LIMITED) sind verständlich und decken die wichtigsten Szenarien ab.

**Einfache Retry-Strategie**: Ein Retry mit 2s Delay ist vernünftig - verhindert endlose Retry-Loops.

## Kritische Bedenken

### 1. Unvollständige Error-Classification
```typescript
enum ErrorType {
  RETRYABLE = 'retryable',    // Was genau? Timeout? Network?
  FATAL = 'fatal',            // Auth UND config? Sehr unterschiedlich!
  RATE_LIMITED = 'rate_limited'
}
```

**Problem**: Zu grobe Kategorisierung. Ein Authentifizierungsfehler braucht andere Behandlung als ein Konfigurations-Fehler.

### 2. Race Condition Risk
```typescript
// NUR ein Retry-Versuch für RETRYABLE errors
if (errorType === ErrorType.RETRYABLE) {
  await this.sleep(2000);
  return await this.callAgent(agentId, question);
}
```

**Problem**: Wenn mehrere Agents gleichzeitig retry-en, können sie sich gegenseitig beeinflussen (Rate Limits, CLI Resource Conflicts).

### 3. Memory-Leak Potential
```typescript
private readonly MAX_FAILED = 50; // Simple limit
```

**Problem**: 50 failed questions mit potentiell großen Kontexten können durchaus mehrere MB sein. Bei lang-laufenden Diskussionen problematisch.

### 4. Konsens-Validierung unvollständig
```typescript
achieved: actualResponses.length >= this.minimumResponses,
```

**Frage**: Was ist `minimumResponses`? Hardcoded? Konfigurierbar? Abhängig von der Diskussion?

### 5. Silent Degradation Risk

Das System "versteckt" Probleme zu gut:
```typescript
return null; // Continue without this expert
```

**Risk**: Bei systematischen Problemen (z.B. alle CLI calls scheitern) merkt der User erst spät, dass die Diskussion wertlos ist.

## Verbesserungsvorschläge

### Error-Classification verfeinern:
```typescript
enum ErrorType {
  NETWORK_TIMEOUT = 'network_timeout',
  AUTH_INVALID = 'auth_invalid', 
  CONFIG_ERROR = 'config_error',
  RATE_LIMITED = 'rate_limited',
  CLI_NOT_FOUND = 'cli_not_found'
}
```

### Circuit Breaker Pattern:
```typescript
class AgentCircuitBreaker {
  private failures = 0;
  private lastFailure?: Date;
  
  shouldAttempt(): boolean {
    if (this.failures >= 3 && 
        this.lastFailure && 
        Date.now() - this.lastFailure.getTime() < 60000) {
      return false; // Stop trying for 1 minute
    }
    return true;
  }
}
```

### Quality Gate Validation:
```typescript
if (actualResponses.length < totalExpected * 0.5) {
  throw new Error("Discussion quality too low - less than 50% experts responded");
}
```

## Security & Reliability Concerns

1. **Error Messages leaking sensitive info**: Error-Logs könnten API-Keys oder interne Pfade enthalten
2. **No fallback strategy**: Was passiert wenn ALLE Agents scheitern?
3. **Resource cleanup**: Werden failed subprocess calls ordentlich cleaned up?

## Fazit

Der Vorschlag ist ein guter **Minimally Viable Product** Ansatz, hat aber einige Lücken die in der Praxis Probleme verursachen können. Die Vereinfachung ist richtig, aber einige Edge Cases sollten bedacht werden.

**Empfehlung**: Implementierung in Phasen wie vorgeschlagen, aber mit erweiterten Error-Types und einem einfachen Circuit Breaker für wiederholte Failures.

[POSITION: SUPPORT_WITH_CONDITIONS] - Error-Classification verfeinern, Circuit Breaker für wiederholte Failures, Quality Gates gegen Silent Degradation

**Position:** ☑️ SUPPORT_WITH_CONDITIONS - Error-Classification verfeinern, Circuit Breaker für wiederholte Failures, Quality Gates gegen Silent Degradation

**Round Status:**
- Positions: 2 SUPPORT_WITH_CONDITIONS
- Consensus: Yes

---

## Final Consensus

# Überarbeiteter Vorschlag: Vereinfachtes Error-Handling mit transparenter Recovery

## Kernprinzip: Einfach, Robust, Transparent

Basierend auf dem Feedback vereinfachen wir das Error-Handling drastisch und fokussieren auf die drei wichtigsten Aspekte:

### 1. Error-Classification (Vereinfacht)

```typescript
enum ErrorType {
  RETRYABLE = 'retryable',    // CLI timeout, network errors
  FATAL = 'fatal',            // Auth errors, invalid config
  RATE_LIMITED = 'rate_limited' // Rate limits
}

interface FailedQuestion {
  agentId: string;
  agentRole: string;
  question: string;
  errorType: ErrorType;
  errorMessage: string;
  timestamp: Date;
}
```

### 2. Sofortige Behandlung (Keine komplexe Recovery)

```typescript
async askExpert(agentId: string, question: string): Promise<string | null> {
  try {
    return await this.callAgent(agentId, question);
  } catch (error) {
    const errorType = this.classifyError(error);
    
    // NUR ein Retry-Versuch für RETRYABLE errors
    if (errorType === ErrorType.RETRYABLE) {
      try {
        await this.sleep(2000); // 2s wait
        return await this.callAgent(agentId, question);
      } catch (retryError) {
        this.recordFailedQuestion(agentId, question, retryError);
        return null; // Continue without this expert
      }
    }
    
    this.recordFailedQuestion(agentId, question, error);
    return null;
  }
}
```

### 3. Transparente Dokumentation

```typescript
interface DiscussionResult {
  rounds: Round[];
  consensus: ConsensusResult;
  failedQuestions: FailedQuestion[];
  qualityWarnings: string[];
}
```

### 4. Output-Format

```markdown
## Discussion Results

### Consensus: ACHIEVED (7/8 experts responded)
- Planner: SUPPORT_WITH_CONDITIONS
- Coder: SUPPORT  
- Reviewer: **FAILED** (CLI timeout)
- Senior Developer: SUPPORT_WITH_CONDITIONS

⚠️ **Quality Impact**: 1 expert unreachable - consensus based on 7/8 responses

### Failed Questions (1)
| Expert | Error | Question Preview |
|--------|--------|------------------|
| Reviewer | CLI timeout after retry | "What are the security implications..." |

**Recommendation**: Re-run discussion or manually consult Reviewer role for complete coverage.
```

### 5. Memory-Protection (Einfach)

```typescript
class FailedQuestionTracker {
  private failedQuestions: FailedQuestion[] = [];
  private readonly MAX_FAILED = 50; // Simple limit
  
  record(failed: FailedQuestion): void {
    this.failedQuestions.push(failed);
    
    // Simple LRU cleanup
    if (this.failedQuestions.length > this.MAX_FAILED) {
      this.failedQuestions.shift();
    }
  }
}
```

### 6. Konsens-Anpassung (Pragmatisch)

```typescript
calculateConsensus(responses: AgentResponse[]): ConsensusResult {
  const totalExpected = this.agents.length;
  const actualResponses = responses.filter(r => r.response !== null);
  const failedCount = totalExpected - actualResponses.length;
  
  return {
    achieved: actualResponses.length >= this.minimumResponses,
    confidence: actualResponses.length / totalExpected,
    qualityWarnings: failedCount > 0 ? 
      [`${failedCount} expert(s) unreachable - reduced confidence`] : []
  };
}
```

## Implementierung: 3 Phasen

### Phase 1: Error-Classification & Single Retry
- Implementiere `classifyError()` basierend auf bekannten Error-Patterns
- Ein Retry-Versuch mit 2s Delay für RETRYABLE errors
- Dokumentation aller Failed Questions

### Phase 2: Transparente Ausgabe
- Failed Questions in Discussion Results
- Quality Warnings im Output
- Clear recommendations für User

### Phase 3: Konsens-Anpassung
- Confidence-Score basierend auf Response-Rate
- Minimum-Response-Threshold konfigurierbar
- Quality-Impact Warnings

## Vereinfachungen gegenüber ursprünglichem Vorschlag:

1. **Kein komplexes Recovery-System** - nur ein Retry
2. **Keine Race Condition Protection** - einfacher sequential flow
3. **Keine User-Intervention** während Discussion
4. **Feste Error-Categories** statt dynamische Classification
5. **Einfache Memory-Limits** statt intelligente Cleanup-Strategien

## Vorteile dieser Vereinfachung:

- **Implementierbar**: Klare, überschaubare Schritte
- **Robust**: Fail-Fast verhindert hängende Diskussionen  
- **Transparent**: User sieht was schief gelaufen ist
- **Vorhersagbar**: Keine komplexen Recovery-Modi
- **Memory-Safe**: Einfache aber effektive Limits

Die Lösung fokussiert auf **Transparenz über Perfektion** - besser eine ehrliche Antwort mit dokumentierten Lücken als eine scheinbar perfekte aber unzuverlässige.

[POSITION: PROPOSAL]

## Conditions & Concerns

### Conditions
- Senior Developer: S]** - Timeout-Limits und Memory-Management müssen definiert werden, sonst kann das System bei vielen Failures hängen bleiben oder zu viel RAM verbrauchen
- Senior Developer: S] - Grundkonzept ist solide, aber Implementierung muss vereinfacht werden
- Senior Developer: Protection, robuste Error-Classification und simplere Recovery-Modi sind Voraussetzungen für eine stabile Implementation
- Senior Developer: Grundkonzept ist solide, aber Implementierung muss vereinfacht werden. Race Condition Protection, robuste Error-Classification und simplere Recovery-Modi sind Voraussetzungen für eine stabile Implementation.
- Senior Developer: S] - Error-Context erweitern, Configuration-Layer hinzufügen, Error-Patterns je CLI dokumentieren
- Senior Developer: Error-Context erweitern, Configuration-Layer hinzufügen, Error-Patterns je CLI dokumentieren
- Reviewer: S] - Error-Classification verfeinern, Circuit Breaker für wiederholte Failures, Quality Gates gegen Silent Degradation
- Reviewer: Error-Classification verfeinern, Circuit Breaker für wiederholte Failures, Quality Gates gegen Silent Degradation

### Noted Concerns
- Senior Developer: Position unclear from response
- Reviewer: Position unclear from response
- Reviewer: Retry-Mechanismus zu komplex, bevorzuge Fail-Fast mit Recovery-Option

---

*Generated by OpenBotMan Multi-Agent Discussion*