# Anfrage: Error-Handling für fehlgeschlagene Experten-Antworten

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
