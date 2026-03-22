# OpenBotMan - Offene Ideen & Features

> Konsolidiert aus IDEAS.md, FUTURE-IDEAS.md, IMPLEMENTATION-ROADMAP.md, WEBUI-ROADMAP.md
> Stand: Maerz 2026

---

## Bereits umgesetzt (nicht erneut planen!)

- Multi-Provider Support (Claude, Gemini, OpenAI, Ollama, LM Studio)
- Multi-Runden-Diskussionen mit Konsens-Mechanismus (SUPPORT/CONCERN/OBJECTION)
- Condition-Tracking bei SUPPORT_WITH_CONDITIONS
- Projekt-Inventur (statische Code-Analyse vor Diskussionen)
- Async Job Queue mit persistentem Status
- Web-UI (React Dashboard, JobView, NewDiscussion, Settings)
- VSCode Extension (Live-Output, Job-TreeView, Auto-Save)
- CLI (discuss, auth, consensus)
- Agent Teams (config.yaml, vordefinierte Teams)
- Provider-agnostische Agent-Zuweisung pro config.yaml
- Diskussionsergebnisse als Markdown gespeichert

---

## Kurzfristig (naechste Schritte)

### Plugin-System (Phase 1-3)
**Status:** Plan liegt vor in `plugin-system-phase1.md`
- [ ] ToolRegistry fuer externe Tools
- [ ] AuditLogger (Security ab Tag 1)
- [ ] MCP Server Stubs anbinden (Phase 2a)
- [ ] MCP Client fuer externe Community-Tools (Phase 2b)
- [ ] Custom Plugin Loader mit Sandbox (Phase 3)

### Web-UI Verbesserungen
- [ ] Settings-Seite: Graphischer Agent-Editor
- [ ] Settings-Seite: Team-Editor mit Config-Speicherung
- [ ] Live-Diskussion: Wer spricht gerade (Typing-Indicator)
- [ ] Live-Diskussion: Position-Badges pro Agent
- [ ] Dark Mode / Light Mode Toggle
- [ ] WebSockets statt Polling fuer Echtzeit-Updates

### Knowledge Base verdrahten
**Status:** Paket existiert (`packages/knowledge-base`), noch nicht im Workflow
- [ ] Orchestrator: query_knowledge/add_knowledge mit echtem Backend verbinden
- [ ] Diskussions-Workflow: Automatisch Learnings aus Konsens extrahieren
- [ ] Details siehe `KNOWLEDGE-BASE-ROADMAP.md`

---

## Mittelfristig

### Rate-Limiting & Error-Handling
- [ ] Provider-spezifische Rate-Limits (bottleneck Library)
- [ ] Error-Classification (RETRYABLE / FATAL / RATE_LIMITED)
- [ ] Quality Warnings bei fehlenden Experten
- [ ] Consensus Confidence Score

### Kosten-Tracking
- [ ] Token-Zaehler pro Diskussion
- [ ] Kosten-Berechnung in Echtzeit
- [ ] Budget-Warnung bei Schwellwert

### Web-Recherche
- [ ] Pre-Discussion Search (Brave/Tavily API)
- [ ] Fakten-Check vor Diskussion

### Parallele Agent-Ausfuehrung
- [ ] Agents innerhalb einer Runde parallel statt sequentiell
- [ ] Task-Splitting durch Orchestrator

---

## Langfristig (Vision)

### Docker Deployment
- [ ] Dockerfile + docker-compose.yml
- [ ] Multi-stage Build, Health Checks

### Channels Integration
- [ ] Microsoft Teams Bot
- [ ] Telegram Bot
- [ ] Discord / Slack

### Enterprise Security
- [ ] OAuth2/JWT Authentication
- [ ] Role-Based Access Control (RBAC)
- [ ] Immutable Audit-Logs
- [ ] GDPR Compliance

### Quality Gates & Perfection Loop
- [ ] Automatische Qualitaetspruefung (Coverage, Complexity, Security)
- [ ] Iterative Verbesserung bis alle Gates erfuellt

### Auto-Documentation
- [ ] Agents dokumentieren Entscheidungen automatisch
- [ ] Pattern-Erkennung aus abgeschlossenen Diskussionen

### Globales CLI
```bash
openbotman discuss "Thema"
openbotman chat
openbotman agents
```

---

## Nicht weiterverfolgt (bewusst verworfen)

- **Rust Core:** Urspruenglich geplant fuer Performance-kritische Pfade. TypeScript reicht voellig aus.
- **Neo4j Graph-DB:** Zu komplex fuer den Nutzen. ChromaDB/Qdrant fuer Vector Search genuegt.
- **FastAPI/Python Backend fuer Web-UI:** Web-UI ist React + Vite, API-Server ist Express/TypeScript.
- **Next.js:** Nicht noetig, Vite + React reicht.
- **URL-Crawling im MVP:** Sicherheitsbedenken, auf spaeter verschoben.
