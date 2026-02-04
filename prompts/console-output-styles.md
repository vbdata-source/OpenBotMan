# OpenBotMan Console Output: UX-Optimierung

## Kontext
OpenBotMan zeigt Multi-Agent-Diskussionen in der Konsole an. Aktuell wird der komplette Text jedes Agenten nach Abschluss ausgegeben. Das kann überwältigend sein und man "verliert den Faden" der Diskussion.

## Ziel
Analysiert verschiedene Output-Styles für die Konsolen-Ausgabe und empfehlt eine flexible Lösung.

## Vorgeschlagene Modi

### 1. Compact Mode (Standard für CLI)
Pro Agent eine Zeile mit Live-Status:
```
Runde 1/4
🎯 Planner      [████████░░] Analyzing...
💻 Developer   ✅ SUPPORT - Memory-Limits definieren
🔍 Reviewer    ⚠️ CONCERN - Security prüfen

Runde 2/4
🎯 Planner      [████░░░░░░] Revising proposal...
💻 Developer   ⏳ Waiting...
🔍 Reviewer    ⏳ Waiting...
```
- Übersichtlich, man sieht den "roten Faden"
- Position sofort sichtbar nach Abschluss
- Am Ende: vollständige Zusammenfassung

### 2. Verbose Mode (für Debugging/Lernen)
Kompletter Output jedes Agenten in Echtzeit:
```
🎯 [Planner] Analyzing...
Ich analysiere die Architektur und sehe folgende Punkte:
1. Die Provider-Abstraktion ist solid...
2. Das Rate-Limiting könnte verbessert werden...
[POSITION: PROPOSAL]
```
- Alle "Gedanken" sichtbar
- Gut zum Lernen wie Agenten denken
- Kann unübersichtlich werden bei langen Diskussionen

### 3. Stream Mode (Live-Typing)
Zeichen für Zeichen wie bei ChatGPT:
```
🎯 [Planner] █
Ich analy|
```
- "AI-Feeling" mit Live-Output
- Kann langsam wirken bei vielen Agenten
- Technisch aufwändiger (braucht sendStream statt send)

### 4. JSON/Event Mode (für IDE-Integration)
Strukturierte Events für programmatische Nutzung:
```json
{"event":"agent_start","agent":"planner","round":1}
{"event":"agent_thinking","agent":"planner","text":"Analysiere..."}
{"event":"agent_done","agent":"planner","position":"PROPOSAL"}
{"event":"round_complete","round":1,"consensus":false}
```
- Perfekt für IDE-Integration (VSCode Extension)
- Maschinen-lesbar
- Kann parallel zu anderem Mode laufen (--json-events)

## Zu analysierende Fragen

1. **Default-Modus:** Welcher Modus sollte Standard sein?
2. **CLI-Parameter:** `--output-style compact|verbose|stream|json`?
3. **Kombinierbarkeit:** Kann man Compact + JSON-Events kombinieren?
4. **Fortschritts-Anzeige:** Wie zeigt man Fortschritt bei langen Aufrufen?
5. **Farben/Formatierung:** Konsistentes Farbschema für Positionen?
6. **IDE-Integration:** Welche Events braucht eine IDE mindestens?

## Technische Randbedingungen
- TypeScript-First
- Bestehende chalk/ora Dependencies nutzen
- Muss mit Rate-Limiting/Retries harmonieren
- Performance: Kein spürbarer Overhead durch Output-Formatierung

## Erwartetes Ergebnis
- Empfohlener Default-Modus
- CLI-Parameter-Design
- Event-Schema für IDE-Integration
- Implementierungs-Roadmap
