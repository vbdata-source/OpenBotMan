# OpenBotMan Web-UI / UX Konzept

## Ausgangslage

OpenBotMan ist ein Multi-Agent AI Orchestrator, der mehrere KI-Experten zu einem Thema diskutieren lässt und einen Konsens findet. Aktuell gibt es:

### Bestehende Interfaces
1. **CLI** (`pnpm cli discuss "Thema"`) - Terminal-basiert
2. **VSCode Extension** - IDE-Integration mit Live-Output
3. **HTTP API** (`POST /api/v1/discuss`) - Programmatischer Zugang

### Architektur
```
┌─────────────────────────────────────────────────────────────┐
│                    OpenBotMan Monorepo                       │
├─────────────────────────────────────────────────────────────┤
│  packages/                                                   │
│  ├── api-server/     → HTTP API (Express, Port 8080)        │
│  ├── cli/            → Command Line Interface               │
│  ├── orchestrator/   → Kern-Logik, Provider-Abstraktion     │
│  ├── protocol/       → Shared Types                         │
│  └── ide-vscode/     → VSCode Extension                     │
├─────────────────────────────────────────────────────────────┤
│  config.yaml         → Zentrale Konfiguration               │
│  .env                → Secrets (API Keys)                   │
└─────────────────────────────────────────────────────────────┘
```

### Aktuelle Config-Struktur (config.yaml)

```yaml
discussion:
  model: "claude-sonnet-4-20250514"  # Default Model
  timeout: 60                         # Sekunden pro Agent
  maxRounds: 10                       # Max Konsens-Runden
  maxContext: 100000                  # Max Kontext in Bytes
  outputDir: "./discussions"          # Ergebnis-Speicherort

  # Modulare Prompts (zentral definiert, per ID referenziert)
  prompts:
    software-architect:
      systemPrompt: "Du bist ein erfahrener Software-Architekt..."
    software-developer:
      systemPrompt: "Du bist ein Senior Developer..."
    software-researcher:
      systemPrompt: "Du bist ein Research Analyst..."
    software-reviewer:
      systemPrompt: "Du bist ein Security & Quality Expert..."

  # Agenten-Definitionen
  agents:
    - id: planner
      name: "Strategic Planner"
      role: architect
      emoji: "🎯"
      provider: google           # Provider: google, ollama, openai, claude-cli, claude-api
      model: gemini-2.0-flash
      promptId: software-architect  # Referenz auf Prompt

    - id: coder
      name: "Senior Developer"
      role: coder
      emoji: "💻"
      provider: ollama           # Lokales LLM
      model: qwen3-coder:30b
      promptId: software-developer

    - id: researcher
      name: "Research Analyst"
      role: researcher
      emoji: "🔬"
      provider: openai
      model: qwen/qwen3-coder-30b
      baseUrl: http://localhost:1234/v1  # LM Studio
      promptId: software-researcher

    - id: reviewer
      name: "Security & Quality Expert"
      role: reviewer
      emoji: "🔍"
      provider: claude-cli       # Claude CLI
      model: claude-sonnet-4-20250514
      promptId: software-reviewer

  # Teams (vordefinierte Agent-Gruppen)
  teams:
    - id: full
      name: "🌟 Volles Team (4 Experten)"
      description: "Alle Experten für umfassende Analyse"
      agents: [planner, coder, researcher, reviewer]
      default: true
      workflows: [full-analysis, architecture]

    - id: quick
      name: "⚡ Schnelle Analyse"
      description: "Planner + Reviewer für schnelle Einschätzung"
      agents: [planner, reviewer]

    - id: code-review
      name: "💻 Code Review"
      agents: [coder, reviewer]
      workflows: [code-review, code-quality]

    - id: security
      name: "🔒 Security Fokus"
      agents: [researcher, reviewer]
      workflows: [security-review]

    - id: local-only
      name: "🏠 Nur Lokal (kostenlos)"
      description: "Ollama + LM Studio - keine API-Kosten"
      agents: [coder, researcher]
      workflows: [performance]

    - id: cloud-only
      name: "☁️ Nur Cloud (schnell)"
      agents: [planner, reviewer]
```

### Unterstützte Provider
| Provider | Beschreibung | API Key nötig? |
|----------|--------------|----------------|
| `google` | Google Gemini | Ja (GOOGLE_API_KEY) |
| `openai` | OpenAI GPT / kompatible APIs | Ja (OPENAI_API_KEY) |
| `claude-api` | Anthropic Claude SDK | Ja (ANTHROPIC_API_KEY) |
| `claude-cli` | Claude CLI (lokale Auth) | Nein |
| `ollama` | Lokale LLMs via Ollama | Nein |

### API Endpoints
```
GET  /health              → Health Check
GET  /api/v1/teams        → Liste aller Teams
POST /api/v1/discuss      → Diskussion starten
GET  /api/v1/jobs/:id     → Job-Status abfragen
```

### Features
1. **Multi-Round Consensus** - Agenten diskutieren bis Konsens erreicht
2. **Async Jobs** - Langläufige Diskussionen im Hintergrund
3. **Workspace/Include** - Projektdateien als Kontext mitgeben
4. **Per-Agent Provider** - Jeder Agent kann anderen Provider/Model nutzen
5. **Workflow-Teams** - Automatische Team-Auswahl basierend auf Workflow-Typ

### Bekannte Pain Points
1. Config-Änderungen erfordern YAML-Editing und Server-Neustart
2. Keine Übersicht über laufende/vergangene Jobs außer in Logs
3. Prompt-Anpassungen sind umständlich
4. Provider-Status (online/offline) nicht sichtbar
5. Keine Kosten-Übersicht (API-Calls)

---

## Aufgabe

Entwickelt ein **Web-UI Konzept** für OpenBotMan mit folgenden Anforderungen:

### Must-Have Features
1. **Dashboard** - Übersicht über laufende/abgeschlossene Diskussionen
2. **Neue Diskussion starten** - Topic eingeben, Team/Agents wählen, Workspace optional
3. **Live-Ansicht** - Agent-Responses in Echtzeit verfolgen
4. **Ergebnis-Ansicht** - Konsens, Action Items, Export (Markdown/PDF)

### Nice-to-Have Features
1. **Agent-Verwaltung** - Agents erstellen/bearbeiten/löschen
2. **Team-Verwaltung** - Teams zusammenstellen
3. **Prompt-Editor** - System-Prompts bearbeiten
4. **Provider-Status** - Welche Provider sind verfügbar/online
5. **Kosten-Tracking** - API-Kosten pro Diskussion

### Technische Rahmenbedingungen
- Muss mit bestehendem Express API-Server integrieren
- TypeScript bevorzugt
- Responsive Design (Desktop + Tablet)
- Keine Benutzer-Authentifizierung (lokales Tool)

### Offene Fragen
1. **Framework** - React, Vue, Svelte, oder anderes?
2. **Styling** - Tailwind, CSS-in-JS, Component Library?
3. **State Management** - Wie mit Echtzeit-Updates umgehen?
4. **Hosting** - Statisch serviert vom API-Server oder separater Build?

Bitte entwickelt ein konkretes UX-Konzept mit:
- Screen-Beschreibungen
- User Flow
- Technologie-Empfehlungen
- Implementierungs-Roadmap (MVP → Full)
