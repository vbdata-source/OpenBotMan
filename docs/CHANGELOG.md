# Changelog

Alle wichtigen Änderungen an OpenBotMan werden hier dokumentiert.

## [2.0.0-alpha.3] - 2026-02-06

### ✨ Neue Features

#### Multi-Model Support (NEU)
- **Per-Agent Provider** - Jeder Agent kann eigenes Model/Provider haben
  ```yaml
  discussion:
    agents:
      - id: coder
        provider: claude-cli
        model: claude-sonnet-4-20250514
      - id: planner
        provider: google
        model: gemini-2.0-flash
        apiKey: ${GOOGLE_API_KEY}
  ```
- **Unterstützte Provider**: claude-cli, claude-api, google, openai, ollama
- **Provider Labels** - Anzeige zeigt "Gemini", "GPT", "CLI" statt nur "CLI/API"

#### Environment & Config
- **`.env` Support** - Alle API-Keys an einem Ort
  - `.env.example` als Template
  - `start-server.ps1` / `start-server.cmd` für einfachen Start
- **`${VAR}` Auflösung** - Environment-Variablen in config.yaml
- **Config aus Root** - CLI findet config.yaml auch aus packages/cli

#### VSCode Extension
- **Auto-Save Results** - Diskussionen werden automatisch als Markdown gespeichert
  - Setting: `openbotman.autoSaveResults` (default: true)
  - Setting: `openbotman.discussionsPath` (default: "discussions")
- **"Datei öffnen" Button** - Nach Abschluss direkt zur MD-Datei

### 🐛 Bug Fixes

- **Config nicht gefunden** - CLI suchte nur in packages/cli, jetzt auch in Parent-Dirs
- **`.env` nicht geladen** - dotenv suchte im falschen Verzeichnis
- **`${VAR}` nicht aufgelöst** - API-Keys wurden als Literal-String gelesen
- **TypeScript Fehler** - Provider-Type Casting korrigiert

### ⚙️ Neue Dateien

- `packages/api-server/src/config.ts` - Config Loader mit Agent-Definitionen
- `.env.example` - Template für Environment-Variablen
- `start-server.ps1` - PowerShell Start-Script
- `start-server.cmd` - CMD Start-Script

---

## [2.0.0-alpha.2] - 2026-02-06

### ✨ Neue Features

#### Model-Transparenz & Agent-Gruppen
- **Model-Anzeige** - Jeder Agent zeigt verwendetes Model in der Ausgabe
- **Provider-Info** - Provider (claude-cli/claude-api) wird angezeigt
- **Agent-Gruppen Konzept** - Dokumentation für zukünftige Agent-Verwaltung
- Vorbereitung für Token-Tracking und Kosten-Anzeige

#### VSCode Extension
- **Agent Progress Tracking** - Live-Anzeige der arbeitenden Agents in der Sidebar
  - Zeigt Status: waiting → thinking → complete
  - Animierte Icons während der Arbeit
  - Runden-Fortschritt (z.B. "Runde 2/5")
  
- **Verbose Mode** - Konfigurierbare Live-Ausgabe (`openbotman.verboseLevel`)
  - Level 0: Nur Endergebnis
  - Level 1: Agent-Zusammenfassungen live (vollständig)
  - Level 2: Zusätzlich Thinking-Notifications
  
- **Server Auto-Start** - Automatische Server-Erkennung und Start
  - Popup "Server starten?" wenn Server nicht läuft
  - Öffnet Terminal und führt `start-api.bat` aus
  - Neuer Befehl: "OpenBotMan: Server starten"

- **Code Review Befehl** - Review der aktuellen Datei/Auswahl
  - Shortcut: `Ctrl+Shift+R`
  - Analysiert automatisch die offene Datei
  - Optionale Text-Selektion für gezieltes Review

- **Konfigurierbare Timeouts**
  - `openbotman.timeoutMinutes` (Default: 60, Range: 1-180)
  - `openbotman.pollIntervalSeconds` (Default: 3, Range: 1-30)

#### API Server

- **Multi-Runden Konsens-System** - Echte Agent-Diskussionen
  - Agents reagieren aufeinander über mehrere Runden
  - Positions-System: SUPPORT, CONCERN, OBJECTION
  - Automatische Konsens-Erkennung
  - Weiterführung bei Einwänden bis maxRounds
  
- **Agent Progress API** - Echtzeit-Fortschritt über REST
  - `GET /api/v1/jobs/:id` mit Agent-Status
  - `?verbose=true` für vollständige Agent-Antworten
  - Runden-Tracking mit currentRound/maxRounds

### 🐛 Bug Fixes

- **Windows PATH-Probleme** - Intel-Pfade mit Leerzeichen/Sonderzeichen
- **PowerShell Kompatibilität** - `.\start-api.bat` statt `start-api.bat`
- **Falsches Package gestartet** - api-server statt orchestrator
- **Extension Icons** - `iconPath` statt Text-Icons im TreeView
- **Timeout zu kurz** - Von 6 auf 60 Minuten erhöht (konfigurierbar)
- **Agent Timeout** - Jeder Agent bekommt volles Timeout, nicht geteilt
- **Job Cleanup** - Jobs werden bei Timeout/Error aus TreeView entfernt
- **TypeScript Types** - Proper typing für Job API responses
- **Axios entfernt** - Native fetch statt externe Dependency

### 📦 Neue Packages/Module

- `packages/api-server/src/consensus.ts` - Konsens-Engine
- `packages/api-server/src/jobs.ts` - Job-Queue mit Agent-Tracking

### ⚙️ Konfiguration

Neue VSCode Settings:
```json
{
  "openbotman.apiUrl": "http://localhost:8080",
  "openbotman.apiKey": "your-api-key",
  "openbotman.timeoutMinutes": 60,
  "openbotman.pollIntervalSeconds": 3,
  "openbotman.verboseLevel": 1
}
```

### 📋 API Änderungen

**Job Status Response** (erweitert):
```json
{
  "id": "job-123",
  "status": "running",
  "currentRound": 2,
  "maxRounds": 5,
  "currentAgent": "Architect",
  "agents": [
    {
      "name": "Analyst",
      "role": "Analytiker",
      "status": "complete",
      "durationMs": 15000,
      "fullResponse": "..." // nur mit ?verbose=true
    }
  ]
}
```

---

## [2.0.0-alpha.1] - 2026-02-05

### ✨ Neue Features

- **HTTP API Server** - REST-Schnittstelle für Diskussionen
- **Async Jobs** - Hintergrund-Verarbeitung mit Polling
- **Provider Abstraction** - claude-cli und claude-api Provider
- **VSCode Extension** - Erste Version mit Basis-Befehlen
- **Workspace Context** - `--workspace` und `--include` für Projekt-Analyse

### 📦 Packages

- `@openbotman/api-server` - HTTP REST API
- `@openbotman/orchestrator` - Multi-Agent Koordination
- `@openbotman/cli` - Command Line Interface
- `@openbotman/protocol` - Shared Types
- `@openbotman/knowledge-base` - Wissens-Verwaltung

---

## Legende

- ✨ Neue Features
- 🐛 Bug Fixes
- 📦 Neue Packages
- ⚙️ Konfiguration
- 📋 API Änderungen
- 🔒 Security
- ⚡ Performance
- 📚 Dokumentation
