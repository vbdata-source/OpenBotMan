# Konsens-Logik: Sollte der Proposer reviewen?

## Problem

Aktuell kann ein Konsens bereits in **Runde 1** erreicht werden:

```
Runde 1:
  Agent 1 (Proposer): PROPOSAL → "Mein Plan ist X"
  Agent 2: SUPPORT_WITH_CONDITIONS → "Ja, aber nur wenn A"
  Agent 3: SUPPORT_WITH_CONDITIONS → "Ja, aber nur wenn B"
  Agent 4: SUPPORT_WITH_CONDITIONS → "Ja, aber nur wenn C"
  
→ Konsens erreicht! ✅
```

**Das Problem:** Der Proposer (Agent 1) sieht **nie** die Bedingungen A, B, C der anderen Agents. Er hat keine Chance:
- Die Bedingungen zu reviewen
- Seinen Vorschlag anzupassen
- Einen konsolidierten Final-Plan zu erstellen

## Kontext

- **Aktueller Code:** `packages/api-server/src/consensus.ts`
- **Konsens-Bedingung:** Alle Positionen sind SUPPORT oder SUPPORT_WITH_CONDITIONS (keine CONCERN, keine OBJECTION)
- **Rollen:** Proposer macht initialen Vorschlag, Responder reagieren darauf

## Fragen an die Experten

### 1. Ist das aktuelle Verhalten sinnvoll?

Argumente dafür:
- Schneller Konsens = weniger API-Kosten
- Wenn alle zustimmen, warum weitere Runden?

Argumente dagegen:
- Proposer kann Bedingungen nicht einarbeiten
- Kein "finaler, konsolidierter" Vorschlag
- Bedingungen könnten sich widersprechen

### 2. Welche Lösung ist am besten?

**Option A: Minimum 2 Runden erzwingen**
```typescript
// config.yaml
discussion:
  minRounds: 2  // NEU
  maxRounds: 10
```
- Pro: Einfach zu implementieren
- Contra: Verschwendet Runden wenn echter Konsens besteht

**Option B: Proposer-Review bei Conditions**
```
Wenn SUPPORT_WITH_CONDITIONS vorhanden:
  → Proposer bekommt Extra-Runde
  → Muss Bedingungen adressieren
  → Dann erst Konsens-Check
```
- Pro: Nur bei Bedarf extra Runde
- Contra: Komplexere Logik

**Option C: SUPPORT_WITH_CONDITIONS ≠ Konsens**
```
Nur SUPPORT (ohne Conditions) zählt als Konsens.
SUPPORT_WITH_CONDITIONS erfordert weitere Runden.
```
- Pro: Zwingt zur Klärung der Bedingungen
- Contra: Könnte zu vielen Runden führen

**Option D: Konsolidierungs-Phase**
```
Nach Konsens-Runde:
  → Automatische Zusammenfassung aller Bedingungen
  → Proposer erstellt Final-Dokument
  → Kein weiterer Vote nötig
```
- Pro: Sauberer Abschluss
- Contra: Zusätzlicher Schritt

**Option E: Hybrid - Warnung statt Blockade**
```
Bei schnellem Konsens mit Conditions:
  → Warnung: "Konsens mit offenen Bedingungen"
  → User kann entscheiden: Akzeptieren oder weitere Runde
```
- Pro: Flexibel
- Contra: Manuelle Entscheidung nötig

### 3. Wie soll das UI damit umgehen?

- Sollen die Bedingungen prominent angezeigt werden?
- Soll der User entscheiden können, ob weitere Runden nötig sind?
- Automatische Zusammenfassung der Conditions?

## Erwartetes Ergebnis

1. Klare Empfehlung welche Option umgesetzt werden soll
2. Begründung warum
3. Implementierungsdetails (welche Dateien, welche Änderungen)
4. Aufwandsschätzung
