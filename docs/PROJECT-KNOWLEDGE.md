# OpenBotMan Project Knowledge Base

> Dieses Dokument enthält alle wichtigen Erkenntnisse, Entscheidungen und Visionen.
> Bei Neustart des Assistenten: Dieses Dokument lesen!

## Vision & Motto
**"Einfachheit kombiniert mit absoluter Leistung und Bedienerfreundlichkeit"**

### Der WOW-Effect
OpenBotMan löst ein echtes Problem im "VibeCoding":
- **Problem:** Ein LLM macht alles selbst (Planung, Umsetzung, Kontrolle)
- **Lösung:** Spezialisierte Agenten (verschiedene LLMs) planen gemeinsam
- **Ergebnis:** Fertiges Konzept wird an Coding-LLM übergeben

---

## Architektur-Entscheidungen

### Stack (Konsens vom 2026-02-04)
- **TypeScript-First** - kein Python/FastAPI
- **Next.js** für Web-UI (nicht Express)
- **Bestehende CLI wrappen** - nicht neu schreiben
- **100h MVP** Zielrahmen

### Rate-Limiting (implementiert 2026-02-04)
- `bottleneck` Library
- Provider-spezifische Delays (Claude CLI: 1.5s, API: 500ms)
- Exponential Backoff mit Jitter
- Max 3 Retries (konfigurierbar)
- Datei: `packages/cli/src/utils/rate-limiter.ts`

### Error-Handling (verbessert 2026-02-04)
- **3 Retries** mit Exponential Backoff (2s → 4s → 8s)
- Professionelle Fehlerdarstellung im Output
- Transparente Dokumentation bei Agent-Ausfällen
- Diskussion wird fortgesetzt auch bei einzelnen Agent-Fehlern
- `FailedQuestionTracker` Klasse

### Workspace-Context (✅ IMPLEMENTIERT 2026-02-04)
**Das Killer-Feature!** Agenten sehen jetzt den echten Code:
```bash
openbotman discuss "Feature X" --workspace . --include "src/**/*.ts"
```
- `--workspace <path>`: Projekt-Root
- `--include <patterns>`: Glob-Patterns für Dateien
- `--max-context <kb>`: Limit (default: 100KB)
- Stdin statt CLI-Args (kein ENAMETOOLONG mehr)
- Auto-Ignore: node_modules, dist, .git

### IDE-Integration (Diskussion 2026-02-04)
**Status:** ❌ Kein Konsens, aber klare Tendenz

**Empfohlene Reihenfolge (KISS-Approach):**

1. **Phase 0 - CLI Enhancement** ✅ ERLEDIGT
   - `--workspace` und `--include` Parameter
   - Stdin für große Kontexte
   - Funktioniert produktiv!

2. **Phase 1 - VSCode Extension (1 Woche)**
   - Command Palette Integration
   - Sammelt Workspace-Kontext automatisch
   - Ruft CLI auf, zeigt Output in Panel

3. **Phase 2 - MCP Server (2-3 Wochen)**
   - Erst wenn Phase 1 funktioniert!
   - Komplexe Security-Anforderungen

### MCP-Server Support (Diskussion 2026-02-04)
**Status:** ❌ Kein Konsens - Security-Bedenken

**Was gut ankam:**
- MVP-Ansatz: Ein MCP-Server (filesystem) als PoC
- Interne Integration statt Plugin-System
- Error-Handling von Tag 1

**Kritische Bedenken:**
- Child-Processes = Code Injection Risk
- Memory-Limits reichen nicht (Fork-Bombs, File-Handles)
- Zu viel Scope für Alpha-Stadium

**Vorgeschlagene Alternativen:**
- **WASM-Sandbox** statt Child-Processes (echte Isolation)
- **Docker-basierte Sandboxes** mit seccomp/AppArmor

**Entscheidung:** MCP wird zurückgestellt bis:
1. CLI + Workspace Feature stabil
2. Requirements sauber dokumentiert
3. Security-Konzept ausgearbeitet

Diskussion: `discussions/2026-02-04_20-37_wie-sollte-ich-mcp-server-support-für-openbotman-i.md`

---

## Geplante Features

### 1. VSCode Extension (Priorität: HOCH)
- Command Palette → OpenBotMan starten
- Workspace-Kontext automatisch sammeln
- Output in Panel anzeigen
- "Apply Result" für Coding-LLM

### 2. Agent Tool Access (Priorität: MITTEL)
- Web-Recherche für Agenten
- File-Access (Codebase lesen)
- Erst nach Security-Review
- Prompt: `prompts/agent-tool-access.md`

### 3. Web-UI (Priorität: MITTEL)
- Hub-and-Spoke Design
- 3-Klick Team-Erstellung
- 4-Wochen Roadmap
- Prompt: `prompts/webui-config-features.md`

### 4. MCP-Server (Priorität: NIEDRIG - zurückgestellt)
- Braucht Security-Konzept
- WASM oder Docker Sandbox
- Frühestens nach VSCode Extension

---

## Diskussions-Ergebnisse

| Datum | Thema | Status | Ergebnis |
|-------|-------|--------|----------|
| 2026-02-04 | Web-UI Stack | ✅ Konsens | TypeScript/Next.js, 100h MVP |
| 2026-02-04 | Config UI | ✅ Konsens | Hub-and-Spoke, 3-Klick Teams |
| 2026-02-04 | Rate-Limiting | ❌ Kein Konsens | bottleneck, 1s delay |
| 2026-02-04 | Error-Handling | ✅ Konsens | 1 retry, fail-fast |
| 2026-02-04 | IDE-Integration | ❌ Kein Konsens | CLI→VSCode→MCP (KISS) |
| 2026-02-04 | Architektur-Analyse | ✅ Konsens | Solide Basis, Memory-Limits definieren |
| 2026-02-04 | MCP-Server | ❌ Kein Konsens | Security-Bedenken, zurückgestellt |

---

## Priorisierte Roadmap

### ✅ Erledigt (Phase 0)
- [x] CLI: `--workspace` und `--include` Parameter
- [x] Project-Context an Agenten übergeben
- [x] Stdin für große Kontexte (ENAMETOOLONG fix)
- [x] Retry-Logik (3 Retries mit Backoff)
- [x] Professionelles Error-Handling

### Kurzfristig (Phase 1)
- [ ] VSCode Extension MVP
- [ ] Command Palette Commands
- [ ] Output Panel
- [ ] "Apply Result" Integration

### Mittelfristig (Phase 2)
- [ ] Web-UI MVP
- [ ] Agent Tool Access (nach Security-Review)

### Langfristig (Phase 3)
- [ ] MCP Server (nach Security-Konzept)
- [ ] WASM/Docker Sandbox für Tools

---

## HIGH PRIORITY: AJBot ↔ OpenBotMan Integration

**Ziel:** AJBot (OpenClaw) kann OpenBotMan direkt aufrufen ohne Juergen als Mittelsmann.

**Warum wichtig:**
- AJBot kann selbständig Experten-Analysen machen
- Schnellerer Workflow (kein Copy-Paste von Befehlen)
- AJBot wird mächtiger durch Multi-Agent-Support

**Optionen:**
1. **HTTP API** (schnellste Lösung)
   - Einfacher REST-Endpoint
   - `POST /discuss` mit topic, workspace, include
   - AJBot fetcht das Ergebnis

2. **MCP Server** (eleganteste Lösung)
   - OpenBotMan als MCP-Tool für andere LLMs
   - Standard-Protokoll, zukunftssicher

3. **OpenClaw Skill** (einfachste Lösung)
   - Shell-Wrapper der CLI aufruft
   - Schnell implementierbar

**Status:** GEPLANT - nach VSCode Extension

---

## Technische Details

### CLI-Aufruf mit Workspace
```bash
pnpm cli discuss "Deine Frage" \
  --workspace C:\Sources\MeinProjekt \
  --include "src/**/*.ts,lib/**/*.js" \
  --max-context 100 \
  --agents 3 \
  --max-rounds 4 \
  --output C:\Sources\MeinProjekt\discussions \
  --verbose
```

### Provider-Konfiguration
- Claude CLI: 1.5s Delay, 3 Retries
- OpenAI API: 200ms Delay
- Gemini API: 200ms Delay
- Ollama: 100ms (lokal)

---

## Workflows

### Vor jeder Implementierung
1. Problem/Feature als Prompt formulieren
2. OpenBotMan Diskussion starten
3. Experten-Konsens abwarten
4. Erst DANN implementieren

### Git-Regel
**ALLES muss ins Git:**
- Prompts
- Diskussions-Ergebnisse
- Entscheidungen
- Dieses Dokument aktualisieren!

---

## Kontakt & Setup
- **Maintainer:** Juergen Viertbauer
- **Repo:** https://github.com/vbdata-source/OpenBotMan.git
- **Assistent:** AJBot (OpenClaw)

---

*Letzte Aktualisierung: 2026-02-04 20:40*
