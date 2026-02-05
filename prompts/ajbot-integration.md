# AJBot ↔ OpenBotMan Integration: Direkte Kommunikation

## Kontext
AJBot ist ein KI-Assistent (läuft auf OpenClaw) der aktuell mit Juergen über Telegram kommuniziert. Um OpenBotMan zu nutzen, muss AJBot Befehle an Juergen schicken, der sie dann ausführt.

**Problem:** Das ist langsam und umständlich.

**Ziel:** AJBot soll OpenBotMan direkt aufrufen können.

## Use-Case
```
Juergen: "Analysiere wie wir Feature X am besten implementieren"

AJBot (intern):
1. Erkennt: Das braucht Experten-Analyse
2. Ruft OpenBotMan direkt auf
3. Wartet auf Ergebnis
4. Präsentiert Juergen den Experten-Konsens

Juergen sieht: Strukturierte Analyse ohne manuelles CLI-Tippen
```

## Zu analysierende Optionen

### 1. HTTP API
```
POST /api/discuss
{
  "topic": "Implementiere User Authentication",
  "workspace": "/path/to/project",
  "include": ["src/**/*.ts"],
  "agents": 3,
  "maxRounds": 4
}

Response (SSE oder Polling):
{
  "status": "complete",
  "consensus": true,
  "result": "## Konsens: JWT Authentication..."
}
```

**Pro:** Einfach, universell, AJBot kann fetch() nutzen
**Contra:** Braucht laufenden Server

### 2. MCP Server
```typescript
// OpenBotMan als MCP Tool
{
  name: "openbotman_discuss",
  description: "Start multi-agent expert discussion",
  inputSchema: {
    topic: "string",
    workspace: "string",
    include: "string[]"
  }
}
```

**Pro:** Standard-Protokoll, andere LLMs können es auch nutzen
**Contra:** MCP hat Security-Bedenken (siehe frühere Diskussion)

### 3. OpenClaw Skill
```yaml
# skills/openbotman/SKILL.md
name: openbotman
description: Multi-Agent Expert Discussions

# Wrapper der CLI aufruft
```

**Pro:** Sehr einfach, nutzt bestehende CLI
**Contra:** Nur für OpenClaw, nicht universell

### 4. Unix Socket / Named Pipe
```
/tmp/openbotman.sock
```

**Pro:** Schnell, kein HTTP-Overhead
**Contra:** Komplexer, OS-spezifisch

## Fragen zur Analyse

1. **Priorität:** HTTP API vs MCP vs Skill - was zuerst?
2. **Streaming:** Soll AJBot Live-Updates sehen oder nur Endergebnis?
3. **Auth:** Wie authentifiziert sich AJBot beim API?
4. **Deployment:** Läuft OpenBotMan API auf gleichem Server wie OpenClaw?
5. **Fallback:** Was wenn OpenBotMan nicht erreichbar?

## Erwartetes Ergebnis
- Empfohlene Integrations-Methode
- Architektur-Skizze
- Implementierungs-Aufwand
- Security-Überlegungen
