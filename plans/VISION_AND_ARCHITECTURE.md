# OpenBotMan: Vision & Architecture Metadata

Dieses Dokument beschreibt den strategischen Wert von OpenBotMan im Vergleich zu monolithischen Einzel-Agenten-Systemen (wie Claude Code, Cursor, Gemini IDE Integrations) und skizziert die Architektur-Vision (IST vs. SOLL Zustand). Es dient als Kontext und Leitfaden für KI-Agenten und Entwickler, die an der Erweiterung des Systems arbeiten.

---

## 1. Kern-Wertversprechen: Multi-Agenten-System vs. Einzel-Agent

Ein nacktes LLM (Large Language Model) ist ein brillanter, aber isolierter Mustererkenner. Wenn man ihm Tools gibt, wird es zu einem mächtigen Assistenten. Ein **Einzel-Agent** hat jedoch systembedingte Limitationen:

1.  **Tunnelblick & Confirmation Bias:** Ein Einzel-Agent verliebt sich oft in seinen ersten Lösungsansatz. Wenn er sich in einen Bug verrennt, versucht er stur, denselben fehlerhaften Code auf andere Weise zu patchen, anstatt das Grundkonzept in Frage zu stellen.
2.  **Context Dilution:** Ein "Universal-Agent", der Architektur planen, Code schreiben, Security prüfen und QA machen soll, benötigt einen gigantischen, komplexen System-Prompt. Je mehr Rollen ein LLM gleichzeitig einnimmt, desto verwässerter (diluted) wird seine Aufmerksamkeit und Präzision.
3.  **Fehlende "Checks and Balances":** Niemand kontrolliert den Kontrolleur.

**Die Lösung durch OpenBotMan:**
OpenBotMan erzwingt einen **Symmetriebruch**. Durch die Trennung von Rollen (z. B. `Planner`, `Coder`, `Reviewer`) mit jeweils hochspezialisierten System-Prompts entsteht ein System der gegenseitigen Kontrolle. Der automatische **Konsens-Mechanismus** (`SUPPORT` / `CONCERN` / `OBJECTION`) zwingt die KIs dazu, sich gegenseitig zu korrigieren. Das Resultat ist ein qualitativ deutlich hochwertigerer Output, da konzeptionelle und logische Fehler durch die Diskussion (Peer-Review) herausgefiltert werden, bevor Code ausgeführt wird.

---

## 2. IST-Zustand (Status Quo)

OpenBotMan ist eine produktiv einsetzbare Multi-Agenten-Plattform mit 6 aktiven Paketen (Stand: Maerz 2026).

**Staerken des IST-Zustands:**
*   **Orchestrierung:** Ein Meta-Agent (Orchestrator) leitet Unter-Agenten mit 6 Meta-Tools (`delegate_task`, `create_discussion`, `run_workflow`, `query_knowledge`, `add_knowledge`, `request_human_input`).
*   **Intelligentes Konsens-Protokoll:** Strukturierte Multi-Runden-Diskussionen mit Positions-Tracking (`SUPPORT` / `SUPPORT_WITH_CONDITIONS` / `CONCERN` / `OBJECTION`). Bedingte Zustimmungen werden als offene Bedingungen getrackt und muessen in fokussierten Folgerunden adressiert werden - kein vorzeitiger Konsens bei offenen Sicherheitsfragen.
*   **Provider-Agnostik:** Lokale (Ollama, LM Studio) und Cloud-Modelle (Claude Opus 4.6, Gemini 2.5 Flash/Pro, GPT-4o, o3) koennen pro Agent gemischt werden.
*   **Projekt-Inventur:** Automatische statische Code-Analyse vor Diskussionen - Dateien, Exports, Imports, Abhaengigkeitsgraph, Purpose-Erkennung. Inventur-Ergebnisse werden im Job gespeichert und in VSCode/Web-UI angezeigt.
*   **Multi-Frontend:** VSCode-Extension (Live-Output, Job-TreeView), Web-UI (React Dashboard), CLI - alle gegen denselben API-Server.
*   **Persistenz:** Jobs werden in JSON persistiert (inkl. Agent-Fortschritt, Inventur-Info, Runden-Ergebnisse). Diskussionsergebnisse als Markdown gespeichert.
*   **Infrastruktur:** YAML-Konfigurationssystem mit Teams, Agenten-Definitionen (`AgentCapabilities`), rollenbasierte System-Prompts, `protocol`-Paket mit 80+ Message-Typen.

**Schwaechen des IST-Zustands:**
*   **"Denker, aber keine Macher":** Die Agenten diskutieren brillant ueber Code-Architektur, koennen aber (abseits der 6 Meta-Tools) nicht aktiv in die Systemumgebung (Dateisystem, APIs, Web) eingreifen. Ein Plugin-System (Phase 1-3 geplant, siehe `plans/plugin-system-phase1.md`) soll dies aendern.
*   **MCP unvollstaendig:** Der existierende MCP-Server (`packages/mcp-server`) hat Tool-Definitionen, aber die Handler sind Stubs ohne echte Orchestrator-Anbindung. Ein MCP-Client fuer externe Community-Tools fehlt noch (Phase 2a/2b geplant).
*   **Knowledge Base nicht verdrahtet:** Das Paket `packages/knowledge-base` existiert mit Vector-DB-Support (ChromaDB, Qdrant), ist aber noch nicht in den Diskussions-Workflow integriert. Agenten lernen noch nicht automatisch aus abgeschlossenen Diskussionen.

---

## 3. SOLL-Zustand & Vision (Der Use-Case für die Zukunft)

Um sich als ultimative Entwickler-Plattform zu etablieren, muss OpenBotMan Stärken ausspielen, die ein reiner Einzel-Agent niemals erreichen kann. Die Vision verschiebt OpenBotMan von einem reinen **Instrument** zu einer **autonomen virtuellen Projektgruppe**.

### A. Heterogene Modell-Schwärme (Best-of-Breed)
Ein optimales OpenBotMan-Team nutzt fuer jede Aufgabe das weltweit beste Modell:
*   `Architect` (Claude Opus 4.6) entwirft das Design mit tiefem Code-Verstaendnis.
*   `Researcher` (Gemini 2.5 Pro) verarbeitet mit seinem 1M+ Token Kontextfenster ganze Dokumentationen.
*   `Security Reviewer` (GPT-4o / o3) fuehrt statische Code-Analysen und Reasoning durch.
*   `Junior Dev` (Lokales Ollama/Qwen via LM Studio) erledigt parallel einfache Refactoring-Aufgaben kostenguenstig.
*   **Bereits umgesetzt:** Die `config.yaml` erlaubt pro Agent individuelle Provider/Modell-Zuweisung. Teams wie `cloud-only`, `local-only` oder `full` sind vordefiniert.
*   **Ziel:** Die Kombination verschiedener KI-Gehirne mit unterschiedlichen Architektur-Bias erschafft echte kollektive Intelligenz.

### B. Das Plugin- und MCP-Netzwerk (Agenten als "Macher")
Die System-Bruecke zwischen Diskussion und Aktion. Geplant in 4 Phasen (Details: `plans/plugin-system-phase1.md`):
*   **Phase 1 (naechster Schritt):** `ToolRegistry` + `AuditLogger` - Infrastruktur fuer externe Tools, Security ab Tag 1.
*   **Phase 2a - MCP Server (Inbound):** Die bestehenden Stubs in `packages/mcp-server` mit dem echten Orchestrator verdrahten. IDEs wie VSCode koennen dann reale Aktionen in OpenBotMan ausloesen.
*   **Phase 2b - MCP Client (Outbound):** Ein `MCPClientManager` verbindet sich zu externen Community-MCP-Servern (GitHub, Postgres, Slack, Google Drive) und registriert deren Tools dynamisch in der internen `ToolRegistry`.
*   **Phase 3 - Custom Plugins:** Lokaler Plugin-Loader aus dem `skills/`-Ordner mit Sandbox-Isolation und Capability-basierter Zugriffskontrolle.

### C. Asynchrone, parallele Workflows
Teilweise bereits umgesetzt:
*   **Bereits vorhanden:** Async Job Queue mit persistentem Status, Agent-Fortschritt pro Runde, Live-Polling in VSCode und Web-UI. Diskussionen laufen im Hintergrund, der Entwickler wird ueber Ergebnisse benachrichtigt.
*   **Noch offen:** Parallele Agent-Ausfuehrung innerhalb einer Runde (aktuell sequentiell). Der Orchestrator koennte Tasks splitten: Agent A liest Logs, Agent B schreibt parallel Unit-Tests. Agent C aggregiert die Daten.
*   Dieses "Fire-and-Forget"-Paradigma fuer komplexe Refactorings ist der groesste Effizienz-Hebel.

### D. Long-Term Memory (Die Knowledge Base)
*   **Infrastruktur vorhanden:** `packages/knowledge-base` mit Vector-DB-Backends (In-Memory, ChromaDB, Qdrant), 10 Wissenstypen (decision, pattern, learning, code, doc, conversation, error, metric, config, security), semantischer Suche und Metadaten-Filterung.
*   **Noch nicht verdrahtet:** Der Orchestrator hat `query_knowledge` und `add_knowledge` als Meta-Tools, aber der Diskussions-Workflow im API-Server extrahiert noch nicht automatisch Learnings aus abgeschlossenen Konsens-Ergebnissen.
*   **Ziel:** Aus jeder Diskussion extrahiert das System automatisch Best-Practices ("In diesem Projekt nutzen wir `worker_threads` statt `vm`" oder "Wir testen exklusiv mit Vitest"). Neue Diskussionsgruppen koennen durch die Knowledge Base in Sekunden "eingearbeitet" werden.

---

## 4. Umsetzungsstand (Maerz 2026)

| Vision | Status | Naechster Schritt |
|--------|--------|-------------------|
| Multi-Agenten-Konsens | Produktiv | Condition-Tracking laeuft, fokussierte Folgerunden |
| Heterogene Modell-Schwärme | Produktiv | Pro Agent individueller Provider/Modell in config.yaml |
| Plugin-System | Geplant | Phase 1: ToolRegistry + AuditLogger |
| MCP Server (Inbound) | Stub vorhanden | Phase 2a: Stubs mit Orchestrator verdrahten |
| MCP Client (Outbound) | Nicht begonnen | Phase 2b: MCPClientManager |
| Async Workflows | Teilweise | Job Queue laeuft, parallele Agents noch offen |
| Knowledge Base | Paket vorhanden | Verdrahtung in Diskussions-Workflow |
| Custom Plugins | Nicht begonnen | Phase 3: Plugin Loader + Sandbox |

## Fazit
Ein Einzel-Agent ist ein Taschenrechner. OpenBotMan ist das Entwickler-Buero.
Der zukuenftige Wert liegt nicht im "besseren Generieren von Texten", sondern in der **Kombination asynchroner Orchestrierung, Modell-Diversitaet (heterogene Schwaerme) und tiefgreifender System-Interaktion ueber MCP.**
