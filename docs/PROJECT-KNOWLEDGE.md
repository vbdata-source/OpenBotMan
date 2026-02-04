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
- Max 3 Retries
- Datei: `packages/cli/src/utils/rate-limiter.ts`

### Error-Handling (implementiert 2026-02-04)
- Single Retry (2s delay)
- Fail-Fast danach
- Transparente Dokumentation im Output
- `FailedQuestionTracker` Klasse
- Datei: `packages/cli/src/utils/rate-limiter.ts`

---

## Geplante Features

### 1. IDE-Integration (Diskussion 2026-02-04)
- VSCode Extension?
- MCP-Anbindung?
- Tastenkombination → OpenBotMan Manager starten
- Source-Zugriff aus IDE
- Prompt: `prompts/ide-integration-usecase.md`

### 2. Agent Tool Access (geplant)
- Web-Recherche für Agenten
- File-Access (Codebase lesen)
- MCP-Tools für Agenten
- Prompt: `prompts/agent-tool-access.md`

### 3. Web-UI (Konsens vom 2026-02-04)
- Hub-and-Spoke Design
- 3-Klick Team-Erstellung
- 4-Wochen Roadmap
- Prompt: `prompts/webui-config-features.md`

---

## Diskussions-Ergebnisse

| Datum | Thema | Status | Ergebnis |
|-------|-------|--------|----------|
| 2026-02-04 | Web-UI Stack | ✅ Konsens | TypeScript/Next.js, 100h MVP |
| 2026-02-04 | Config UI | ✅ Konsens | Hub-and-Spoke, 3-Klick Teams |
| 2026-02-04 | Rate-Limiting | ❌ Kein Konsens | bottleneck, 1s delay |
| 2026-02-04 | Error-Handling | ✅ Konsens | 1 retry, fail-fast |
| 2026-02-04 | IDE-Integration | 🔄 Läuft | - |

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

*Letzte Aktualisierung: 2026-02-04*
