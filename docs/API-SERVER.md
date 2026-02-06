# OpenBotMan API Server

HTTP REST API für Multi-Agent-Diskussionen.

## Quickstart

```cmd
# Server starten
cd C:\Sources\OpenBotMan
set OPENBOTMAN_API_KEYS=mein-api-key
.\start-api.bat
```

Oder mit pnpm:
```cmd
pnpm api
```

## Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0-alpha.1",
  "uptime": 3600,
  "providers": [
    { "name": "claude-cli", "available": true }
  ]
}
```

### Diskussion starten

```
POST /api/v1/discuss
Authorization: Bearer <api-key>
Content-Type: application/json
```

**Request Body:**
```json
{
  "topic": "Analysiere dieses Projekt auf Security-Probleme",
  "agents": 3,
  "maxRounds": 5,
  "timeout": 120,
  "async": true,
  "workspace": "C:/Sources/MeinProjekt",
  "include": ["**/*.ts", "**/*.js"],
  "maxContext": 200
}
```

**Parameter:**

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| `topic` | string | *required* | Diskussions-Thema oder Frage |
| `agents` | number | 3 | Anzahl der Agents (1-5) |
| `maxRounds` | number | 5 | Max. Diskussions-Runden |
| `timeout` | number | 120 | Timeout pro Agent in Sekunden |
| `async` | boolean | false | Async-Modus (empfohlen) |
| `workspace` | string | - | Projekt-Pfad für Kontext |
| `include` | string[] | - | Glob-Patterns für Dateien |
| `maxContext` | number | 100 | Max. Kontext-Größe in KB |

**Sync Response (async=false):**
```json
{
  "id": "abc123",
  "status": "complete",
  "consensus": true,
  "result": "# Analyse\n...",
  "actionItems": ["Item 1", "Item 2"],
  "rounds": 2,
  "durationMs": 45000
}
```

**Async Response (async=true):**
```json
{
  "id": "abc123",
  "status": "accepted",
  "message": "Discussion started. Poll /api/v1/jobs/abc123 for results.",
  "jobUrl": "/api/v1/jobs/abc123"
}
```

### Job Status abfragen

```
GET /api/v1/jobs/:jobId
GET /api/v1/jobs/:jobId?verbose=true
Authorization: Bearer <api-key>
```

**Response:**
```json
{
  "id": "abc123",
  "status": "running",
  "progress": "Runde 2/5",
  "topic": "Security-Analyse...",
  "currentRound": 2,
  "maxRounds": 5,
  "currentAgent": "Architect",
  "agents": [
    {
      "name": "Analyst",
      "role": "Analytiker",
      "status": "complete",
      "durationMs": 15000,
      "responsePreview": "Die Analyse zeigt...",
      "fullResponse": "..." // nur mit ?verbose=true
    },
    {
      "name": "Architect",
      "role": "Software-Architekt",
      "status": "thinking"
    },
    {
      "name": "Pragmatist",
      "role": "Pragmatischer Entwickler",
      "status": "waiting"
    }
  ],
  "result": null,
  "durationMs": null,
  "createdAt": "2026-02-06T09:00:00.000Z"
}
```

**Status-Werte:**

| Job Status | Bedeutung |
|------------|-----------|
| `pending` | Job erstellt, noch nicht gestartet |
| `running` | Diskussion läuft |
| `complete` | Erfolgreich abgeschlossen |
| `error` | Fehler aufgetreten |
| `timeout` | Timeout erreicht |

| Agent Status | Bedeutung |
|--------------|-----------|
| `waiting` | Wartet auf seinen Einsatz |
| `thinking` | Agent arbeitet gerade |
| `complete` | Agent ist fertig |
| `error` | Agent hatte Fehler |

### Alle Jobs auflisten

```
GET /api/v1/jobs
Authorization: Bearer <api-key>
```

**Response:**
```json
{
  "jobs": [
    { "id": "abc123", "status": "running", "createdAt": "..." },
    { "id": "def456", "status": "complete", "createdAt": "..." }
  ],
  "count": 2
}
```

## Authentifizierung

Der API Server erwartet einen API Key via:

1. **Authorization Header:** `Authorization: Bearer <key>`
2. **X-API-Key Header:** `X-API-Key: <key>`

Der Key wird beim Server-Start als Environment Variable gesetzt:
```cmd
set OPENBOTMAN_API_KEYS=mein-geheimer-key
```

Mehrere Keys (komma-getrennt):
```cmd
set OPENBOTMAN_API_KEYS=key1,key2,key3
```

## Multi-Runden Konsens

Der API Server implementiert echte Multi-Agent-Diskussionen:

### Ablauf

```
Runde 1:
  Agent 1 (Analyst)     → [PROPOSAL] Erste Analyse
  Agent 2 (Architect)   → [SUPPORT/CONCERN/OBJECTION]
  Agent 3 (Pragmatist)  → [SUPPORT/CONCERN/OBJECTION]
  
  → Konsens-Check

Runde 2 (falls nötig):
  Alle Agents reagieren auf Einwände
  → Konsens-Check
  
... bis Konsens oder maxRounds
```

### Positions-System

| Position | Bedeutung | Blockiert Konsens? |
|----------|-----------|-------------------|
| `PROPOSAL` | Erste Analyse (nur Agent 1, Runde 1) | - |
| `SUPPORT` | Volle Zustimmung | Nein |
| `SUPPORT_WITH_CONDITIONS` | Zustimmung mit Bedingungen | Nein |
| `CONCERN` | Bedenken, aber kein Veto | Nein |
| `OBJECTION` | Einspruch | **Ja** |

### Konsens erreicht wenn:
- Keine `OBJECTION` Stimmen
- Mindestens ein Agent hat abgestimmt
- Alle Stimmen sind `SUPPORT` oder `SUPPORT_WITH_CONDITIONS`

## Konfiguration

### Environment Variables

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `OPENBOTMAN_API_KEYS` | - | API Keys (komma-getrennt) |
| `ANTHROPIC_API_KEY` | - | Für claude-api Provider |
| `PORT` | 8080 | Server Port |
| `HOST` | 0.0.0.0 | Server Host |

### config.yaml (optional)

```yaml
server:
  port: 8080
  provider: claude-cli
  model: claude-sonnet-4-20250514
  defaultTimeout: 120
  maxContext: 200
```

## Fehlerbehandlung

### HTTP Status Codes

| Code | Bedeutung |
|------|-----------|
| 200 | Erfolg |
| 202 | Async Job akzeptiert |
| 400 | Ungültige Anfrage |
| 401 | Fehlender API Key |
| 403 | Ungültiger API Key |
| 404 | Job nicht gefunden |
| 500 | Server-Fehler |

### Error Response Format

```json
{
  "error": "Unauthorized",
  "message": "API key required. Use Authorization: Bearer <key>"
}
```

## Tipps

1. **Async-Modus nutzen** - Sync blockiert und kann timeouten
2. **Polling-Intervall** - 3 Sekunden ist ein guter Wert
3. **Workspace begrenzen** - `maxContext: 200` (KB) verhindert Token-Überlauf
4. **maxRounds** - 3-5 Runden reichen meist für Konsens
