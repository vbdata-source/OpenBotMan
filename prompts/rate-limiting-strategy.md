# Anfrage: Rate-Limiting Strategie für Claude CLI

## Problem

Bei Multi-Agent Diskussionen kommt es zu "Claude CLI error" Meldungen, vermutlich weil Anfragen zu schnell hintereinander an die API geschickt werden.

## Aktuelles Verhalten

- 3 Agents senden quasi gleichzeitig Anfragen
- Claude CLI/API hat Rate-Limits
- Bei Überschreitung: "Claude CLI error" → Runde wird übersprungen
- Keine Retry-Logik vorhanden

## Gewünschtes Verhalten

1. **Präventiv:** Mindestwartezeit zwischen Anfragen einhalten
2. **Reaktiv:** Bei Fehler intelligent retry mit Backoff
3. **Transparent:** User informieren wenn Rate-Limit greift

## Fragen an das Team

1. **Wartezeit:** Wie viel Millisekunden zwischen CLI-Aufrufen minimal?
2. **Sequentiell vs Parallel:** Sollten Agents sequentiell statt parallel anfragen?
3. **Backoff-Strategie:** Exponential Backoff? Feste Wartezeit? Jitter?
4. **Queue-System:** Brauchen wir eine Request-Queue mit Rate-Limiting?
5. **Provider-spezifisch:** Unterschiedliche Limits für Claude/OpenAI/Gemini?

## Technischer Kontext

```typescript
// Aktuell: Parallel Requests
const responses = await Promise.all([
  planner.send(prompt),
  coder.send(prompt),
  reviewer.send(prompt),
]);

// Mögliche Lösung: Sequential mit Delay
for (const agent of agents) {
  await agent.send(prompt);
  await delay(RATE_LIMIT_MS);
}
```

## Randbedingungen

- Performance nicht zu stark beeinträchtigen
- Unterschiedliche Provider haben unterschiedliche Limits
- Claude CLI nutzt Anthropic API im Hintergrund
- User-Experience: Lieber langsamer als Fehler

## Ziel

Konkrete Implementierungs-Strategie mit Code-Beispielen für robustes Rate-Limiting in OpenBotMan.
