# Smart Discussion Mode - Automatische Fragetyp-Erkennung

## Context - HOHE PRIORITAET

Das System behandelt JEDE Anfrage als Entscheidungsfrage und erzwingt
Multi-Runden-Konsens. Eine einfache Informationsfrage wie "Was sind die
neuesten Features in Node.js 25?" fuehrt zu 4+ Runden mit SUPPORT_WITH_CONDITIONS,
Rollback-Plaenen und Security-Reviews. Das ist Ressourcenverschwendung und
voellig am Ziel vorbei.

**Problem:** Kein Unterschied zwischen Informationsfrage und Entscheidungsfrage.
**Loesung:** Der erste Agent (Proposer) erkennt den Fragetyp und das System
passt automatisch maxRounds und Prompt-Stil an.

## Fragetypen

| Typ | Beispiel | Runden | Konsens? |
|-----|----------|--------|----------|
| INFO | "Was gibt es Neues in X?" | 1 | Nein - jeder Agent liefert Fakten aus seiner Perspektive |
| DECISION | "Sollen wir X oder Y verwenden?" | 3-10 | Ja - voller Konsens-Mechanismus |
| ANALYSIS | "Analysiere unsere Architektur" | 2-3 | Teilweise - Sammeln + kurze Abstimmung |

## Design

### 1. Fragetyp-Erkennung im Proposer-Prompt

Der erste Agent (buildProposerPrompt) bekommt eine zusaetzliche Anweisung:

```
Bevor du antwortest, klassifiziere die Anfrage:
[MODE: INFO] - Reine Informationsfrage, keine Entscheidung noetig
[MODE: DECISION] - Entscheidung/Empfehlung wird erwartet
[MODE: ANALYSIS] - Tiefe Analyse mit Bewertung

Setze den MODE-Tag am ANFANG deiner Antwort.
```

### 2. Server erkennt MODE-Tag

In runDiscussion(), nach der ersten Agent-Antwort:
- Parse [MODE: INFO|DECISION|ANALYSIS] aus response.text
- Bei INFO: setze maxRounds = 1 (aktuelle Runde ist die einzige)
- Bei ANALYSIS: setze maxRounds = min(3, configuredMaxRounds)
- Bei DECISION: maxRounds bleibt wie konfiguriert

### 3. Prompt-Anpassung fuer Nicht-Entscheidungsfragen

Bei INFO-Modus bekommen die restlichen Agents einen anderen Prompt:
- KEIN "[POSITION: ...]" erforderlich
- Stattdessen: "Ergaenze die bisherigen Informationen aus deiner
  Experten-Perspektive. Wiederhole nichts."
- Position wird automatisch auf SUPPORT gesetzt (kein Konsens-Theater)

Bei ANALYSIS-Modus:
- Reduzierte Positions-Anforderung
- Fokus auf Ergaenzungen statt Widerspruch
- Max 2-3 Runden

### 4. Ergebnis-Format anpassen

INFO-Ergebnis: Keine "Konsens erreicht" Meldung, sondern
"Experten-Zusammenfassung" mit Beitraegen aller Agents.

## Betroffene Dateien

1. **consensus.ts** - buildProposerPrompt: MODE-Tag Anweisung
2. **consensus.ts** - Neuer buildInfoRoundPrompt (kein Position noetig)
3. **server.ts** - runDiscussion: MODE-Tag parsen, maxRounds anpassen
4. **server.ts** - Prompt-Auswahl basierend auf erkanntem Modus
5. **consensus.ts** - formatConsensusResult: Alternatives Format fuer INFO

## Was NICHT geaendert wird

- evaluateRound() - bleibt unveraendert
- Die Position-Extraktion - bleibt als Fallback
- Die Config - maxRounds bleibt konfigurierbar als Obergrenze
- Die UI - funktioniert weiterhin, zeigt einfach weniger Runden

## Risiken

| Risiko | Mitigation |
|--------|-----------|
| Falsche Klassifizierung | Fallback auf DECISION (aktuelles Verhalten) |
| Agent ignoriert MODE-Tag | Default: DECISION (sicherer) |
| INFO wird zu oberflaechlich | Alle Agents antworten trotzdem aus ihrer Rolle |

## Verifikation

1. "Was sind die Features von X?" → 1 Runde, kein Konsens-Theater
2. "Sollen wir X oder Y verwenden?" → Normaler Multi-Runden-Konsens
3. "Analysiere unsere Codebase" → 2-3 Runden mit Bewertung
4. Bestehende 514+ Tests gruen
