# Discussion: # AJBot ↔ OpenBotMan Integration: Direkte Kommunikation

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

**Date:** 2026-02-05 11:36
**Participants:** Planner (claude-sonnet-4-20250514), Senior Developer (claude-sonnet-4-20250514), Reviewer (claude-sonnet-4-20250514)
**Rounds:** 1
**Status:** ✅ CONSENSUS REACHED
**Duration:** 263s

---

## Round 1/4

### [Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)

# AJBot ↔ OpenBotMan Integration: Direkter Kommunikations-Vorschlag

## Empfohlene Lösung: Hybrid-Ansatz

### Phase 1: HTTP API (Sofortige Umsetzung)
**Grund:** Schnellste Implementierung, universell nutzbar

```typescript
// OpenBotMan API Server (erweitern bestehende CLI)
POST /api/v1/discuss
{
  "topic": "Implementiere User Authentication",
  "workspace": "/absolute/path/to/project", 
  "context": {
    "include": ["src/**/*.ts", "docs/**/*.md"],
    "exclude": ["node_modules/**", "*.test.ts"]
  },
  "options": {
    "agents": 3,
    "maxRounds": 4,
    "streaming": true,
    "timeout": 300
  }
}

// Response: Server-Sent Events
data: {"type": "agent_start", "agent": "claude_code", "role": "architect"}
data: {"type": "agent_response", "agent": "claude_code", "content": "..."}
data: {"type": "consensus", "agreement": 0.8, "result": "## Empfehlung..."}
data: {"type": "complete", "success": true, "duration": 180}
```

### Phase 2: OpenClaw Skill (Parallel)
**Grund:** Native Integration in bestehende Infrastruktur

```yaml
# ~/.claude-global/skills/openbotman/SKILL.md
name: openbotman
description: Multi-Agent Expert Discussions und Code-Analyse
version: 1.0.0

tools:
  - name: expert_discuss
    description: Startet Experten-Diskussion zu technischen Themen
    parameters:
      topic: Diskussions-Thema
      workspace: Projekt-Pfad
      agents: Anzahl Experten (2-5)
      
  - name: code_review
    description: Multi-Agent Code Review
    parameters:
      files: Zu reviewende Dateien
      focus: Review-Schwerpunkt
```

## Architektur-Skizze

```
┌─────────────┐    HTTP API     ┌──────────────┐    CLI Calls    ┌─────────────┐
│   AJBot     │ ──────────────> │ OpenBotMan   │ ─────────────>  │  Agents     │
│ (OpenClaw)  │                 │ API Server   │                 │ (CLI Tools) │
└─────────────┘                 └──────────────┘                 └─────────────┘
                                        │                                │
                                        │ Config                       │ Results  
                                        ▼                                ▼
                                ┌──────────────┐                 ┌─────────────┐
                                │    YAML      │                 │  Knowledge  │
                                │   Config     │                 │    Base     │
                                └──────────────┘                 └─────────────┘
```

## Detaillierte Implementierung

### 1. API Server Extension (src/api-server.ts)
### 2. OpenClaw Skill Implementation

```typescript
// ~/.claude-global/skills/openbotman/implementation.ts
import { fetch } from 'node-fetch';

export class OpenBotManSkill {
  private apiUrl: string;
  private apiKey: string;

  constructor(config: SkillConfig) {
    this.apiUrl = config.OPENBOTMAN_API_URL || 'http://localhost:8080';
    this.apiKey = config.OPENBOTMAN_API_KEY;
  }

  async expertDiscuss(params: {
    topic: string;
    workspace?: string;
    agents?: number;
    streaming?: boolean;
  }) {
    const response = await fetch(`${this.apiUrl}/api/v1/discuss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({
        topic: params.topic,
        options: {
          agents: params.agents || 3,
          maxRounds: 4,
          workspace: params.workspace,
          maxContextKb: 1000
        }
      })
    });

    if (params.streaming) {
      return this.handleStreamingResponse(response);
    }
    
    return await response.json();
  }
}
```

## Security & Authentication

### API Key Management
```env
# .env (OpenBotMan)
OPENBOTMAN_API_KEYS=ajbot-key-001,ajbot-key-002,admin-key-001

# .env (OpenClaw/AJBot)
OPENBOTMAN_API_URL=http://localhost:8080
OPENBOTMAN_API_KEY=ajbot-key-001
```

### Rate Limiting
```yaml
# config.yaml
api:
  rateLimit:
    perKey:
      ajbot-key-001: 100/min
      admin-key-001: 1000/min
    perEndpoint:
      /api/v1/discuss: 10/min
      /api/v1/chat: 50/min
```

## Implementierungs-Roadmap

### Sprint 1: HTTP API Basis (2-3 Tage)
- [ ] Server-Grundstruktur (`src/api/server.ts`)
- [ ] `/api/v1/discuss` Endpoint
- [ ] Basic Authentication
- [ ] Rate Limiting
- [ ] Integration mit bestehender `discussCommand()`

### Sprint 2: Streaming & Sessions (2 Tage)  
- [ ] Server-Sent Events für Live Updates
- [ ] Session Management
- [ ] Error Handling & Logging
- [ ] Health Check Endpoint

### Sprint 3: OpenClaw Integration (1-2 Tage)
- [ ] OpenClaw Skill implementieren
- [ ] AJBot Integration testen
- [ ] End-to-End Tests
- [ ] Performance Optimierung

### Sprint 4: Robustheit & Monitoring (1 Tag)
- [ ] Prometheus Metrics
- [ ] Docker Container
- [ ] Deployment Guide
- [ ] Load Testing

## Fallback-Strategien

### 1. API Server nicht verfügbar
```typescript
// In AJBot
async callOpenBotMan(topic: string) {
  try {
    return await this.httpCall(topic);
  } catch (error) {
    // Fallback: CLI-Aufruf über Skill
    return await this.cliCall(topic);
  }
}
```

### 2. Timeout bei langen Diskussionen
```typescript
const timeout = 5 * 60 * 1000; // 5 Minuten
const controller = new AbortController();
setTimeout(() => controller.abort(), timeout);

const response = await fetch('/api/v1/discuss', {
  signal: controller.signal,
  // ...
});
```

## Kosten-Nutzen Analyse

### Implementierungs-Aufwand
- **Phase 1 (HTTP API):** ~6-8 Stunden
- **Phase 2 (OpenClaw Skill):** ~3-4 Stunden  
- **Testing & Polish:** ~4-6 Stunden
- **Gesamt:** ~13-18 Stunden

### Nutzen
- ✅ **Geschwindigkeit:** 10x schneller als manuelle CLI-Eingabe
- ✅ **Automation:** AJBot kann selbstständig Experten konsultieren
- ✅ **User Experience:** Juergen sieht direkt Experten-Ergebnisse
- ✅ **Skalierung:** API kann von anderen Systemen genutzt werden

### Risiken
- ⚠️ **Single Point of Failure:** API Server Ausfall
- ⚠️ **Security:** API Keys müssen sicher verwaltet werden
- ⚠️ **Performance:** Concurrent Requests können Server überlasten

## Nächste Schritte

1. **Validierung:** Bestätigung des Ansatzes mit AJBot-Integration
2. **Prototyp:** Minimaler HTTP Server für `/api/v1/discuss`
3. **Integration:** AJBot Test-Integration über HTTP
4. **Evaluation:** Performance & Usability Assessment
5. **Ausbau:** Vollständige API-Implementierung

[POSITION: PROPOSAL]

**Position:** 💡 PROPOSAL

### [Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)

**[Coder]** (engineer)

# Code-Review: AJBot ↔ OpenBotMan Integration

## Technische Analyse des Vorschlags

### ✅ Starke Punkte

**1. Pragmatischer Hybrid-Ansatz**
```typescript
// Gut: Klare Priorisierung HTTP API → OpenClaw Skill
Phase 1: HTTP API (sofort nutzbar)
Phase 2: Native Integration (optimiert)
```

**2. Solide API-Design**
```typescript
// Durchdacht: SSE für Streaming, klare Request/Response
POST /api/v1/discuss
Content-Type: application/json
Accept: text/event-stream  // Streaming support
```

**3. Realistische Zeitschätzungen**
```
HTTP API: 6-8h ✓
OpenClaw Skill: 3-4h ✓  
Testing: 4-6h ✓
Gesamt: 13-18h → Realistisch für MVP
```

### ⚠️ Kritische Bedenken

**1. Session Management zu oberflächlich behandelt**
```typescript
// Problem: Wo werden Sessions gespeichert?
// Conflict: Mehrere AJBot-Requests parallel?
const sessionId = generateId(); // Memory? Redis? File?

// Besser: Explicit session store design
interface SessionStore {
  create(workspaceId: string): SessionId;
  get(sessionId: string): Session | null;
  cleanup(olderThan: Date): void;
}
```

**2. OpenClaw Integration unklar**
```typescript
// Vage: Wie genau wird Skill geladen?
// ~/.claude-global/skills/openbotman/
// Was ist die Skill-API? Welche Hooks?
```

**3. Error Handling zu optimistisch**
```typescript
// Zu simpel:
try {
  return await this.httpCall(topic);
} catch (error) {
  return await this.cliCall(topic);
}

// Realität: Partial failures, timeouts, state corruption
```

**4. Resource Management fehlt**
```typescript
// Nicht betrachtet:
// - Memory usage bei concurrent discussions
// - CLI process cleanup
// - Workspace lock management
// - Token cost tracking
```

### 🔧 Code-spezifische Verbesserungen

**1. API Server Structure**
```typescript
// Vorgeschlagen, aber zu monolithisch
// src/api-server.ts

// Besser: Modularer Aufbau
src/api/
  ├── server.ts           // Express setup
  ├── middleware/         // Auth, rate limiting
  ├── routes/            // Discuss, chat, status
  ├── handlers/          // Business logic
  └── streams/           // SSE management
```

**2. Configuration Schema**
```yaml
# Gut, aber fehlt Validation
api:
  rateLimit:
    perKey:
      ajbot-key-001: 100/min

# Braucht JSON Schema/Zod validation
# + Environment overrides
# + Hot reload capability
```

**3. Dependency Injection fehlt**
```typescript
// Problem: Tight coupling
class DiscussHandler {
  constructor() {
    this.orchestrator = new Orchestrator(); // ❌ Hard dependency
  }
}

// Besser: DI für Testability
interface DiscussHandler {
  constructor(
    private orchestrator: IOrchestrator,
    private sessionStore: ISessionStore,
    private auth: IAuthProvider
  ) {}
}
```

### 🏗️ Architektur-Empfehlungen

**1. State Management**
```typescript
// Fehlend: Wo liegt der State?
interface ApiState {
  sessions: Map<SessionId, Discussion>;
  activeWorkspaces: Set<WorkspaceId>;
  metrics: ApiMetrics;
}

// Redis oder In-Memory?
// Restart = lost sessions?
```

**2. Monitoring & Observability**
```typescript
// Gut erwähnt, aber Details fehlen
// Welche Metrics? Welche Logs?
interface ApiMetrics {
  discussionsTotal: Counter;
  discussionDuration: Histogram;
  activeConnections: Gauge;
  errorRate: Counter;
}
```

**3. Security Model**
```env
# Zu simpel:
OPENBOTMAN_API_KEYS=ajbot-key-001,admin-key-001

# Braucht:
# - Key rotation
# - Scoped permissions  
# - Request signing
# - IP whitelisting
```

### 🚀 Implementierungs-Vorschlag

**Phase 1: MVP (4-5h statt 6-8h)**
```typescript
// Minimal aber robust
1. Basic Express server
2. Single /discuss endpoint  
3. In-memory sessions (restart = reset)
4. API key auth only
5. JSON responses only (no streaming)
```

**Phase 1.5: Production Ready (+3-4h)**
```typescript
1. Add streaming (SSE)
2. Add persistence (Redis/File)
3. Add proper error handling
4. Add health checks
5. Add basic metrics
```

**Phase 2: OpenClaw Integration (nach Klärung)**
```typescript
// Erst: Skill API verstehen
// Dann: Integration implementieren
```

### 💡 Alternative: CLI Wrapper zuerst?

```typescript
// Einfacherer Start: Wrapper um bestehende CLI
class OpenBotManWrapper {
  async discuss(topic: string, options: DiscussOptions): Promise<string> {
    const cmd = `openbotman discuss "${topic}" --agents ${options.agents}`;
    return await execAsync(cmd, { cwd: options.workspace });
  }
}

// Pro: 2h Implementierung, nutzt bestehende CLI
// Contra: Kein Streaming, weniger Features
```

## Fazit

Der Vorschlag ist **grundsätzlich solide** und geht in die richtige Richtung. Die Hybrid-Strategie ist klug und die Prioritäten stimmen.

**Aber:** Wichtige technische Details sind unterspezifiziert, besonders:
- Session/State Management  
- Error Handling & Recovery
- OpenClaw Integration Mechanism
- Resource Management

**Empfehlung:** Starte mit **sehr schlankem MVP** (4-5h), dann iterativ ausbauen basierend auf realen AJBot-Tests.

[POSITION: SUPPORT_WITH_CONDITIONS]

**Bedingungen:**
1. MVP zuerst (JSON-only, in-memory)
2. OpenClaw Skill-API klären vor Implementation  
3. Explicit Session Management Design
4. Monitoring/Logging von Anfang an

**Position:** ☑️ SUPPORT_WITH_CONDITIONS

### [Reviewer] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)

**[Reviewer]** (security-expert)

# Security & Architecture Review: AJBot ↔ OpenBotMan Integration

## Security-Analyse

### 🔴 Kritische Security-Bedenken

**1. API Key Management unzureichend**
```typescript
// PROBLEM: Plaintext API Keys in .env
OPENBOTMAN_API_KEY=ajbot-key-001  // ← Risiko!

// BESSER: Verschlüsselte Token mit Rotation
{
  "keyId": "ajbot-001", 
  "token": "encrypted_jwt_token",
  "expires": "2026-02-12T00:00:00Z",
  "scopes": ["discuss", "review"]
}
```

**2. Fehlende Input Validation**
```typescript
// RISIKO: Unvalidierte Workspace-Pfade
workspace: "/absolute/path/to/project" // ← Path Traversal!

// LÖSUNG: Strenge Validation
const allowedWorkspaces = ['/safe/projects/', '/home/user/code/'];
if (!allowedWorkspaces.some(allowed => workspace.startsWith(allowed))) {
  throw new Error('Workspace not allowed');
}
```

**3. Ungeschützter File Access**
```typescript
// PROBLEM: AJBot kann beliebige Dateien lesen
include: ["src/**/*.ts", "../../etc/passwd"] // ← Gefahr!

// LÖSUNG: Sandbox mit Whitelist
const SAFE_PATTERNS = [
  /^src\/.*\.(ts|js|tsx|jsx)$/,
  /^docs\/.*\.md$/,
  /^tests\/.*\.test\.(ts|js)$/
];
```

### 🟡 Architektur-Bedenken

**1. Single Point of Failure verschärft**
```
AJBot → HTTP API → OpenBotMan CLI → Multiple Agent CLIs
  ↑        ↑           ↑              ↑
SPOF    SPOF        SPOF          SPOF (4 Failure Points!)
```

**2. Resource Exhaustion**
```typescript
// PROBLEM: Keine Concurrent Request Limits
POST /api/v1/discuss (Agent 1: 5min)
POST /api/v1/discuss (Agent 2: 5min) // ← Server Overload
POST /api/v1/discuss (Agent 3: 5min)

// LÖSUNG: Queue System
maxConcurrentDiscussions: 2,
queueTimeout: 300000, // 5min
```

## Verbesserte Architektur-Empfehlung

### 1. Security-First API Design
```typescript
// Secure Token-Based Auth
interface SecureRequest {
  headers: {
    'Authorization': 'Bearer jwt_token_with_scopes',
    'X-Request-ID': 'unique_request_id',
    'X-Workspace-Hash': 'sha256_of_allowed_workspace'
  },
  body: {
    topic: string;
    workspaceId: string; // ← Nicht raw path!
    scope: 'analyze' | 'review' | 'discuss';
    constraints: {
      maxAgents: 3,
      maxRounds: 4,
      maxFiles: 100,
      timeoutMs: 300000
    }
  }
}
```

### 2. Robuste Fallback-Kette
```typescript
class OpenBotManClient {
  async expertDiscuss(topic: string): Promise<Result> {
    // 1. HTTP API (preferred)
    try {
      return await this.httpApi.discuss(topic);
    } catch (apiError) {
      
    // 2. Direct CLI (fallback)
    try {
      return await this.cliCall(topic);
    } catch (cliError) {
      
    // 3. Simple LLM (emergency)
    return await this.simpleLLM(topic);
    }
  }
}
```

### 3. Production-Ready Monitoring
```yaml
# Prometheus Metrics
openbotman_api_requests_total{status="200|500|timeout"}
openbotman_discussion_duration_seconds{agents="3"}
openbotman_concurrent_discussions{status="active|queued"}
openbotman_token_usage_total{agent="claude|gemini"}
```

## Empfohlene Änderungen

### MUST-HAVE (Blocker ohne diese):
1. **Secure Workspace Validation** - Keine raw paths
2. **JWT Token Auth** - Nicht plaintext API keys  
3. **Rate Limiting per Client** - Nicht nur global
4. **Input Sanitization** - Alle User-Inputs validieren
5. **Audit Logging** - Wer ruft was auf, wann

### SHOULD-HAVE (Kritisch für Production):
1. **Request Queue System** - Prevent resource exhaustion
2. **Health Checks** - `/health`, `/metrics` endpoints
3. **Circuit Breaker** - Auto-disable bei Agent failures
4. **Request Timeout Management** - Granular timeouts
5. **Structured Error Responses** - Nicht nur 500

### NICE-TO-HAVE (Performance):
1. **Response Caching** - Gleiche Topics cachen
2. **Agent Pool Management** - Warmup/cooldown
3. **Streaming Backpressure** - Client kann nicht folgen
4. **Metrics Dashboard** - Grafana/similar

## Alternativ-Vorschlag: MCP mit Security Layer

```typescript
// MCP Server mit Security Wrapper
{
  name: "secure_openbotman",
  description: "Secured Multi-Agent Discussions",
  inputSchema: {
    topic: "string",
    workspaceId: "enum[allowed_workspaces]", // ← Controlled
    authToken: "jwt_token",
    requestId: "uuid"
  },
  security: {
    authentication: "required",
    authorization: "scoped",
    audit: "full"
  }
}
```

**Vorteil:** Standard-Protokoll + integrierte Security
**Nachteil:** MCP Adoption noch niedrig

## Implementierungs-Roadmap mit Security

### Sprint 1: Secure Foundation (4-5 Tage statt 2-3)
- [ ] JWT Token System
- [ ] Workspace Validation & Whitelisting  
- [ ] Input Sanitization
- [ ] Rate Limiting
- [ ] Audit Logging
- [ ] Basic `/api/v1/discuss` mit Security

### Sprint 2: Robustheit (3 Tage statt 2)
- [ ] Request Queue System
- [ ] Circuit Breaker Pattern
- [ ] Health Checks & Metrics
- [ ] Error Recovery
- [ ] Streaming mit Backpressure

### Sprint 3: Production Ready (2-3 Tage)
- [ ] Docker Security (non-root, secrets)
- [ ] Load Testing mit realistic workloads
- [ ] Security Penetration Testing
- [ ] Documentation & Runbooks

## Fazit

Der Grundansatz ist **technisch solide**, aber die **Security-Aspekte sind unterentwickelt**. Für eine Production-Umgebung wo AJBot potentiell auf sensitive Codebases zugreift, sind die vorgeschlagenen Security-Maßnahmen **unzureichend**.

**Empfehlung:** Implementierung mit **erweiterten Security-Anforderungen** oder **MCP mit Security Layer** als Alternative evaluieren.

**Geschätzter Aufwand mit Security:** ~20-25 Stunden (statt 13-18)
**Aber:** Produktions-tauglich und auditierbar

[POSITION: SUPPORT_WITH_CONDITIONS]

**Bedingungen für Support:**
1. JWT Auth statt API Keys implementieren
2. Workspace Security (Whitelist, Validation)  
3. Input Sanitization für alle Parameter
4. Request Queue System gegen Resource Exhaustion
5. Audit Logging für Compliance

Ohne diese Bedingungen: **Security-Risiko zu hoch** für Production-Einsatz mit sensiblen Daten.

**Position:** ☑️ SUPPORT_WITH_CONDITIONS

**Round Status:**
- Positions: 2 SUPPORT_WITH_CONDITIONS
- Consensus: Yes

---

## Final Consensus

# AJBot ↔ OpenBotMan Integration: Direkter Kommunikations-Vorschlag

## Empfohlene Lösung: Hybrid-Ansatz

### Phase 1: HTTP API (Sofortige Umsetzung)
**Grund:** Schnellste Implementierung, universell nutzbar

```typescript
// OpenBotMan API Server (erweitern bestehende CLI)
POST /api/v1/discuss
{
  "topic": "Implementiere User Authentication",
  "workspace": "/absolute/path/to/project", 
  "context": {
    "include": ["src/**/*.ts", "docs/**/*.md"],
    "exclude": ["node_modules/**", "*.test.ts"]
  },
  "options": {
    "agents": 3,
    "maxRounds": 4,
    "streaming": true,
    "timeout": 300
  }
}

// Response: Server-Sent Events
data: {"type": "agent_start", "agent": "claude_code", "role": "architect"}
data: {"type": "agent_response", "agent": "claude_code", "content": "..."}
data: {"type": "consensus", "agreement": 0.8, "result": "## Empfehlung..."}
data: {"type": "complete", "success": true, "duration": 180}
```

### Phase 2: OpenClaw Skill (Parallel)
**Grund:** Native Integration in bestehende Infrastruktur

```yaml
# ~/.claude-global/skills/openbotman/SKILL.md
name: openbotman
description: Multi-Agent Expert Discussions und Code-Analyse
version: 1.0.0

tools:
  - name: expert_discuss
    description: Startet Experten-Diskussion zu technischen Themen
    parameters:
      topic: Diskussions-Thema
      workspace: Projekt-Pfad
      agents: Anzahl Experten (2-5)
      
  - name: code_review
    description: Multi-Agent Code Review
    parameters:
      files: Zu reviewende Dateien
      focus: Review-Schwerpunkt
```

## Architektur-Skizze

```
┌─────────────┐    HTTP API     ┌──────────────┐    CLI Calls    ┌─────────────┐
│   AJBot     │ ──────────────> │ OpenBotMan   │ ─────────────>  │  Agents     │
│ (OpenClaw)  │                 │ API Server   │                 │ (CLI Tools) │
└─────────────┘                 └──────────────┘                 └─────────────┘
                                        │                                │
                                        │ Config                       │ Results  
                                        ▼                                ▼
                                ┌──────────────┐                 ┌─────────────┐
                                │    YAML      │                 │  Knowledge  │
                                │   Config     │                 │    Base     │
                                └──────────────┘                 └─────────────┘
```

## Detaillierte Implementierung

### 1. API Server Extension (src/api-server.ts)
### 2. OpenClaw Skill Implementation

```typescript
// ~/.claude-global/skills/openbotman/implementation.ts
import { fetch } from 'node-fetch';

export class OpenBotManSkill {
  private apiUrl: string;
  private apiKey: string;

  constructor(config: SkillConfig) {
    this.apiUrl = config.OPENBOTMAN_API_URL || 'http://localhost:8080';
    this.apiKey = config.OPENBOTMAN_API_KEY;
  }

  async expertDiscuss(params: {
    topic: string;
    workspace?: string;
    agents?: number;
    streaming?: boolean;
  }) {
    const response = await fetch(`${this.apiUrl}/api/v1/discuss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({
        topic: params.topic,
        options: {
          agents: params.agents || 3,
          maxRounds: 4,
          workspace: params.workspace,
          maxContextKb: 1000
        }
      })
    });

    if (params.streaming) {
      return this.handleStreamingResponse(response);
    }
    
    return await response.json();
  }
}
```

## Security & Authentication

### API Key Management
```env
# .env (OpenBotMan)
OPENBOTMAN_API_KEYS=ajbot-key-001,ajbot-key-002,admin-key-001

# .env (OpenClaw/AJBot)
OPENBOTMAN_API_URL=http://localhost:8080
OPENBOTMAN_API_KEY=ajbot-key-001
```

### Rate Limiting
```yaml
# config.yaml
api:
  rateLimit:
    perKey:
      ajbot-key-001: 100/min
      admin-key-001: 1000/min
    perEndpoint:
      /api/v1/discuss: 10/min
      /api/v1/chat: 50/min
```

## Implementierungs-Roadmap

### Sprint 1: HTTP API Basis (2-3 Tage)
- [ ] Server-Grundstruktur (`src/api/server.ts`)
- [ ] `/api/v1/discuss` Endpoint
- [ ] Basic Authentication
- [ ] Rate Limiting
- [ ] Integration mit bestehender `discussCommand()`

### Sprint 2: Streaming & Sessions (2 Tage)  
- [ ] Server-Sent Events für Live Updates
- [ ] Session Management
- [ ] Error Handling & Logging
- [ ] Health Check Endpoint

### Sprint 3: OpenClaw Integration (1-2 Tage)
- [ ] OpenClaw Skill implementieren
- [ ] AJBot Integration testen
- [ ] End-to-End Tests
- [ ] Performance Optimierung

### Sprint 4: Robustheit & Monitoring (1 Tag)
- [ ] Prometheus Metrics
- [ ] Docker Container
- [ ] Deployment Guide
- [ ] Load Testing

## Fallback-Strategien

### 1. API Server nicht verfügbar
```typescript
// In AJBot
async callOpenBotMan(topic: string) {
  try {
    return await this.httpCall(topic);
  } catch (error) {
    // Fallback: CLI-Aufruf über Skill
    return await this.cliCall(topic);
  }
}
```

### 2. Timeout bei langen Diskussionen
```typescript
const timeout = 5 * 60 * 1000; // 5 Minuten
const controller = new AbortController();
setTimeout(() => controller.abort(), timeout);

const response = await fetch('/api/v1/discuss', {
  signal: controller.signal,
  // ...
});
```

## Kosten-Nutzen Analyse

### Implementierungs-Aufwand
- **Phase 1 (HTTP API):** ~6-8 Stunden
- **Phase 2 (OpenClaw Skill):** ~3-4 Stunden  
- **Testing & Polish:** ~4-6 Stunden
- **Gesamt:** ~13-18 Stunden

### Nutzen
- ✅ **Geschwindigkeit:** 10x schneller als manuelle CLI-Eingabe
- ✅ **Automation:** AJBot kann selbstständig Experten konsultieren
- ✅ **User Experience:** Juergen sieht direkt Experten-Ergebnisse
- ✅ **Skalierung:** API kann von anderen Systemen genutzt werden

### Risiken
- ⚠️ **Single Point of Failure:** API Server Ausfall
- ⚠️ **Security:** API Keys müssen sicher verwaltet werden
- ⚠️ **Performance:** Concurrent Requests können Server überlasten

## Nächste Schritte

1. **Validierung:** Bestätigung des Ansatzes mit AJBot-Integration
2. **Prototyp:** Minimaler HTTP Server für `/api/v1/discuss`
3. **Integration:** AJBot Test-Integration über HTTP
4. **Evaluation:** Performance & Usability Assessment
5. **Ausbau:** Vollständige API-Implementierung

[POSITION: PROPOSAL]

## Action Items

- [ ] Server-Grundstruktur (`src/api/server.ts`)
- [ ] `/api/v1/discuss` Endpoint
- [ ] Basic Authentication
- [ ] Rate Limiting
- [ ] Integration mit bestehender `discussCommand()`
- [ ] Server-Sent Events für Live Updates
- [ ] Session Management
- [ ] Error Handling & Logging
- [ ] Health Check Endpoint
- [ ] OpenClaw Skill implementieren
- [ ] AJBot Integration testen
- [ ] End-to-End Tests
- [ ] Performance Optimierung
- [ ] Prometheus Metrics
- [ ] Docker Container
- [ ] Deployment Guide
- [ ] Load Testing
- [ ] JWT Token System
- [ ] Workspace Validation & Whitelisting
- [ ] Input Sanitization
- [ ] Rate Limiting
- [ ] Audit Logging
- [ ] Basic `/api/v1/discuss` mit Security
- [ ] Request Queue System
- [ ] Circuit Breaker Pattern
- [ ] Health Checks & Metrics
- [ ] Error Recovery
- [ ] Streaming mit Backpressure
- [ ] Docker Security (non-root, secrets)
- [ ] Load Testing mit realistic workloads
- [ ] Security Penetration Testing
- [ ] Documentation & Runbooks

---

*Generated by OpenBotMan Multi-Agent Discussion*