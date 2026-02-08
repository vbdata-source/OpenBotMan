# Settings-Seite für OpenBotMan Web-UI

## Kontext

OpenBotMan hat eine Web-UI (React + TypeScript + Tailwind) auf Port 3000.
Der API-Server läuft auf Port 8080.

Aktuell existieren:
- Dashboard (Job-Übersicht)
- NewDiscussion (neue Diskussion starten)
- JobView (Job-Details mit Agent-Fortschritt)

Die Konfiguration liegt in `config.yaml` und enthält:
- Agents (id, name, emoji, role, provider, model, systemPrompt, apiKey, baseUrl)
- Teams (id, name, agents[], default, workflows[])
- Globale Settings (maxRounds, timeout, maxContext)

## Anforderung

Wir brauchen eine **Settings-Seite** um die `config.yaml` graphisch zu bearbeiten.

### Funktionen

1. **Agent-Editor**
   - Liste aller Agents anzeigen
   - Agent hinzufügen/bearbeiten/löschen
   - Felder: name, emoji, role, provider (dropdown), model, systemPrompt, apiKey, baseUrl
   - Provider-abhängige Felder (z.B. baseUrl nur bei openai)

2. **Team-Editor**
   - Liste aller Teams anzeigen
   - Team hinzufügen/bearbeiten/löschen
   - Agents per Drag&Drop oder Multi-Select zuweisen
   - Default-Team markieren

3. **General Settings**
   - maxRounds (Slider oder Input)
   - timeout (Sekunden)
   - maxContext (KB)

4. **Save-Funktion**
   - Änderungen in config.yaml speichern
   - Server muss NICHT neu gestartet werden (config wird bei jedem Request gelesen)
   - Validierung vor dem Speichern

## Technische Fragen

1. **API Design**: Wie sollen die Endpoints aussehen?
   - `GET /api/v1/config` - Ganze Config lesen?
   - `PUT /api/v1/config` - Ganze Config speichern?
   - Oder granular: `/api/v1/agents`, `/api/v1/teams`?

2. **Sicherheit**: 
   - API Keys im Frontend anzeigen? (maskiert?)
   - Wie mit Environment-Variablen umgehen (`${GOOGLE_API_KEY}`)?

3. **UI-Komponenten**:
   - Tabs vs. Accordion vs. Separate Seiten?
   - Inline-Editing vs. Modal-Dialoge?
   - Unsaved Changes Warning?

4. **Validierung**:
   - Client-side, Server-side, oder beides?
   - Was passiert bei ungültiger Config?

## Constraints

- Keine neuen Dependencies wenn möglich
- Muss auf Windows funktionieren
- Shadcn UI Komponenten bevorzugen
- Deutsch als UI-Sprache

## Erwartetes Ergebnis

Architektur-Empfehlung mit:
- API Endpoint Design
- UI Struktur (Wireframe-Beschreibung)
- Komponenten-Aufteilung
- Sicherheitskonzept für API Keys
- Validierungsstrategie
