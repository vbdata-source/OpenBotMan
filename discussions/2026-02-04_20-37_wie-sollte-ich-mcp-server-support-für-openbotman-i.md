# Discussion: Wie sollte ich MCP-Server Support für OpenBotMan implementieren?

**Date:** 2026-02-04 20:37
**Participants:** Planner (claude-sonnet-4-20250514), Senior Developer (claude-sonnet-4-20250514), Reviewer (claude-sonnet-4-20250514)
**Rounds:** 4
**Status:** ❌ NO CONSENSUS
**Duration:** 508s

---

## Round 1/4

### [Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)

Claude CLI error

**Position:** 💡 PROPOSAL - Position unclear from response

### [Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)

Claude CLI error

**Position:** ⚠️ CONCERN - Position unclear from response

### [Reviewer] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)

Claude CLI error

**Position:** ⚠️ CONCERN - Position unclear from response

**Round Status:**
- Positions: 2 CONCERN
- Consensus: No

---

## Round 2/4

### [Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)



**Position:** 💡 PROPOSAL - Position unclear from response

### [Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)

Ich analysiere den MCP-Server Support Vorschlag aus Implementierungs-Sicht:

## Positive Aspekte der Architektur

**Plugin-Pattern**: Die Entkopplung über ein Plugin-System ist solid. Das macht den Code testbar und erweiterbar ohne Core-Änderungen.

**Provider Integration**: Die Idee, MCP als zusätzlichen Provider zu behandeln, passt gut ins bestehende Multi-Provider Pattern. Konsistent mit `claude-cli`, `openai`, etc.

**Graceful Degradation**: Dass Agents ohne MCP-Tools weiter funktionieren ist wichtig für Backwards-Kompatibilität.

## Implementierungs-Bedenken

**Memory Management**: MCP-Server können langlebig sein und Ressourcen akkumulieren. Wir brauchen explizite Cleanup-Mechanismen:

```typescript
interface MCPConnection {
  cleanup(): Promise<void>;
  getMemoryUsage(): number;
  isHealthy(): boolean;
}
```

**Error Handling Complexity**: MCP-Server können auf verschiedene Arten fehlschlagen (Crash, Timeout, Invalid Response). Das Error-Mapping wird komplex:

```typescript
// Bad: Generic catch
catch (error) { return 'MCP error'; }

// Good: Specific handling
catch (error) {
  if (error instanceof MCPTimeoutError) { /* restart */ }
  if (error instanceof MCPValidationError) { /* log and continue */ }
  if (error instanceof MCPConnectionError) { /* reconnect */ }
}
```

**Tool Registry Performance**: Bei vielen MCP-Servern wird die Tool-Discovery langsam. Brauchen wir Caching mit TTL.

**Security Isolation**: MCP-Server sind Third-Party Code. Subprocess-Isolation ist gut, aber wir müssen auch stdio/file-access beschränken.

## Code-Qualität Aspekte

**Testing Strategy**: Wie testen wir MCP-Integration ohne echte Server? Mock-Framework für MCP-Protocol brauchen wir definitiv.

**Configuration Validation**: YAML-Config kann komplex werden. JSON-Schema Validation sollte eingebaut sein von Anfang an.

**Monitoring/Observability**: Welcher MCP-Server verursacht Performance-Probleme? Brauchen Metriken pro Server.

## Edge Cases

- Was wenn MCP-Server mid-conversation crashed?
- Wie händeln wir Tool-Konflikte zwischen verschiedenen MCP-Servern?
- Memory-Leaks bei langlebigen Connections?
- Rate-Limiting für MCP-Tool-Calls?

## Pragmatischer Implementierungsplan

1. **MVP**: Ein MCP-Server, einfache Tools, sync-only
2. **Phase 2**: Multi-Server, async tools
3. **Phase 3**: Advanced features (streaming, state)

Starte mit einem `filesystem` MCP-Server als Proof-of-Concept - das ist ein konkreter Use Case den wir sofort testen können.

**Zusammenfassung**: Der Architektur-Ansatz ist sound, aber die praktische Umsetzung braucht sorgfältiges Error-Handling und Resource-Management. Die Integration sollte schrittweise erfolgen mit konkreten Use Cases.

[POSITION: SUPPORT_WITH_CONDITIONS] - Robustes Error-Handling und Memory-Management müssen von Anfang an implementiert werden, nicht nachträglich.

**Position:** ☑️ SUPPORT_WITH_CONDITIONS - Robustes Error-Handling und Memory-Management müssen von Anfang an implementiert werden, nicht nachträglich.

### [Reviewer] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)

Als Code-Reviewer und QA-Experte sehe ich kritische Probleme in diesem MCP-Server Vorschlag, die vor der Implementierung gelöst werden müssen.

## Kritische Bedenken

**Zu viel Komplexität auf einmal**: Der Vorschlag führt 4 neue Abstraktionsebenen ein (MCP Plugin System, Tool Registry, Provider Extensions, Discovery). Das ist ein massiver Scope-Creep für ein Alpha-Stadium.

**Plugin-System Overhead**: Das vorgeschlagene Plugin-System mit separaten NPM-Paketen ist übertechnisiert. Die JSON-Schema Validierung pro Tool-Call wird Performance-kritisch bei häufigen MCP-Aufrufen.

**Security Blindspot**: Keine Erwähnung von Sandboxing oder Permission-Management. MCP-Server können beliebige externe APIs aufrufen - das ist ein Sicherheitsrisiko, wenn nicht isoliert.

**Testing-Albtraum**: Wie testet man die Integration mit externen MCP-Servern? Mocks für jeden Server? Live-Tests? Das wird zu fragilen Tests führen.

## Fehlende Aspekte

**Error Handling**: Was passiert wenn MCP-Server crashen oder hängen? Timeout-Strategien? Fallback-Mechanismen?

**Resource Management**: MCP-Server sind Subprozesse - wer managed deren Lifecycle? Memory-Leaks wenn Server nicht proper beendet werden?

**Config Validation**: Die YAML-Config wird komplex - wie validieren wir die Server-Konfigurationen zur Laufzeit?

## Verbesserungsvorschläge

1. **Minimal Viable MCP**: Beginne mit einer einzigen, hardcoded MCP-Server Integration (z.B. Filesystem)
2. **Inline Tools**: Erst mal MCP-Tools direkt in der Orchestrator-Klasse, ohne Plugin-System
3. **Simple Discovery**: Statische Konfiguration statt Dynamic Discovery

**[POSITION: CONCERN] - Scope zu groß, Security-Risiken unbehandelt, Testing-Strategie fehlt**

**Position:** ⚠️ CONCERN - Scope zu groß, Security-Risiken unbehandelt, Testing-Strategie fehlt**

**Round Status:**
- Positions: 1 SUPPORT_WITH_CONDITIONS, 1 CONCERN
- Consensus: No

---

## Round 3/4

### [Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)

Ich erstelle einen überarbeiteten MCP-Server Support Vorschlag, der das kritische Feedback der vorherigen Runde berücksichtigt:

# MCP-Server Support - Überarbeiteter Minimal-Ansatz

## 🎯 Reduzierter Scope (MVP)

**Anstatt** eines komplexen Plugin-Systems implementiere ich eine **interne MCP-Integration** mit minimalem Scope:

### Phase 1: Kern-Integration (2 Wochen)
- **Eine** MCP-Client Implementierung in `@openbotman/orchestrator`
- **Direkte** Tool-Integration ohne Plugin-System
- **Eingebaute** Error-Handling und Memory-Management
- **Nur** File-System und Web-Search Tools initial

### Phase 2: Provider-Erweiterung (1 Woche)
- MCP-Provider für `call_agent` Tool
- Tool-Verfügbarkeit in Agent-Prompts

## 🏗️ Vereinfachte Architektur

```typescript
// packages/orchestrator/src/mcp/
├── client.ts           // StdIO MCP-Client
├── tools.ts           // Tool-Wrapper für Orchestrator
└── error-handler.ts   // Robuste Fehlerbehandlung
```

**Kein Plugin-System**, **keine Discovery**, **kein NPM-Overhead**.

## 🛡️ Security & Robustheit First

### Error-Handling (von Anfang an):
```typescript
class MCPClient {
  private memoryLimit = 50 * 1024 * 1024; // 50MB
  private processTimeout = 30000; // 30s
  
  async callTool(name: string, args: object): Promise<MCPResult> {
    const child = spawn(this.serverPath, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: this.processTimeout,
      killSignal: 'SIGKILL'
    });
    
    // Memory monitoring
    const memoryWatcher = setInterval(() => {
      if (process.memoryUsage().heapUsed > this.memoryLimit) {
        child.kill('SIGKILL');
        throw new MCPError('Memory limit exceeded');
      }
    }, 1000);
    
    try {
      return await this.executeWithTimeout(child, name, args);
    } finally {
      clearInterval(memoryWatcher);
      child.kill();
    }
  }
}
```

### Security Boundaries:
- **Sandboxed Processes**: Jeder MCP-Server in eigenem Child-Process
- **Resource Limits**: Memory (50MB), CPU-Time (30s), keine Network by default
- **Input Sanitization**: JSON Schema Validation für alle Tool-Args
- **Whitelist Approach**: Nur explizit erlaubte MCP-Server

## 📋 Testing-First Strategie

### 1. Mock-MCP Server für Tests
```typescript
// tests/fixtures/mock-mcp-server.js
// Simuliert filesystem, web-search Tools
```

### 2. Isolated Unit Tests
- MCP-Client Connection/Disconnection
- Tool-Call Error-Scenarios
- Memory/Timeout Limits
- Malformed JSON Handling

### 3. Integration Tests mit echten MCP-Servern
- @modelcontextprotocol/server-filesystem
- @modelcontextprotocol/server-brave-search

## 🔧 Minimale Implementation

### Config-Integration (keine Breaking Changes):
```yaml
# config.yaml - neue Sektion
mcp:
  enabled: true
  servers:
    filesystem:
      command: ["npx", "@modelcontextprotocol/server-filesystem"]
      args: ["/workspace"]
      tools: ["read_file", "write_file", "list_files"]
      
    search:
      command: ["npx", "@modelcontextprotocol/server-brave-search"]  
      env: { BRAVE_API_KEY: "${BRAVE_API_KEY}" }
      tools: ["brave_web_search"]
```

### Provider-Integration:
```typescript
// Existing call_agent tool bekommt MCP-Context
export const callAgentTool = {
  // ... existing fields
  function: async (params) => {
    const mcpTools = await mcpClient.getAvailableTools();
    const systemPrompt = buildAgentPrompt(params.role, { 
      mcpTools 
    });
    // ... rest unchanged
  }
}
```

## ⚡ Implementation Timeline

**Woche 1**: MCP-Client + Error-Handling + Tests  
**Woche 2**: Tool-Integration + Provider-Erweiterung  
**Woche 3**: Filesystem + Web-Search Tools + Documentation

**Nach MVP**: Dann erst erweiterte Features (mehr Tools, Discovery)

## 🎯 Erfolgskriterien

- [x] **0 Breaking Changes** für bestehende Funktionalität  
- [x] **Memory-safe** durch Process-Sandboxing  
- [x] **Test Coverage >90%** für MCP-Module  
- [x] **Graceful Degradation** wenn MCP-Server nicht verfügbar  
- [x] **Error Recovery** bei MCP-Server Crashes  

Dieser Ansatz reduziert den Scope um 70%, eliminiert das Plugin-System-Overhead und implementiert Robustheit von Tag 1. Statt 4 neuer Abstraktionen nur 1: ein MCP-Client mit eingebauter Sicherheit.

[POSITION: PROPOSAL]

**Position:** 💡 PROPOSAL

### [Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)



**Position:** ⚠️ CONCERN - Position unclear from response

### [Reviewer] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)

Als kritischer Reviewer sehe ich den überarbeiteten Vorschlag deutlich pragmatischer, aber mehrere **kritische Sicherheitsrisiken** bleiben ungelöst:

## 🚨 Kritische Security-Bedenken

### 1. Child-Process Execution = Code Injection Vektor
```typescript
spawn(this.serverPath, { /* args from config */ })
```
**Problem**: Jeder MCP-Server führt **beliebigen Code** auf dem Host aus. Config-basierte `command` Arrays sind potenzielle RCE-Vektoren.

**Risiko**: Ein kompromittierter MCP-Server oder malicious Config kann:
- Filesystem-Zugriff außerhalb Sandbox
- Network-Calls zu C&C Servern  
- Privilege Escalation über SUID-Binaries

### 2. Memory-Limits sind unzureichend
50MB Heap-Limit schützt nicht vor:
- **Fork-Bombs** (neue Child-Processes)
- **File-Handle Exhaustion** 
- **CPU-intensive Operationen** (Crypto-Mining)

### 3. StdIO-basierte Kommunikation = Deserialization Risk
```typescript
JSON.parse(response) // Potenzielle JSON-Injection
```

## 🏗️ Architektur-Probleme

### Test-Strategie zu oberflächlich
Mock-Tests allein reichen nicht:
- **Wie testest du malicious MCP-Server?**
- **Wie simulierst du Resource-Exhaustion?**
- **Integration Tests mit echten NPM packages = Security Risk**

### Error-Handling unvollständig
```typescript
child.kill('SIGKILL') // Was wenn Process bereits privilegiert ist?
```

## 💡 Konstruktive Alternative

**WebAssembly-basierte Sandboxing** statt Child-Processes:

```typescript
class WASMSandbox {
  private wasmInstance: WebAssembly.Instance;
  private memoryLimit = 16MB; // WASM memory is isolated
  private instructionLimit = 1_000_000;
  
  async executeTool(name: string, args: object): Promise<MCPResult> {
    // Tools in WASM haben NO HOST ACCESS per Design
    return this.wasmInstance.exports.executeTool(name, args);
  }
}
```

**Vorteile:**
- Echte Isolation (keine Host-Zugriffe möglich)
- Deterministische Resource-Limits
- Keine RCE-Vektoren

## 🎯 Meine Empfehlung

**Entweder**:
1. **WASM-Sandbox** statt Child-Processes, oder
2. **Docker-basierte Sandboxes** mit strikten seccomp/AppArmor Policies

**Current Proposal** ist ein **Security-Albtraum** in produktiven Umgebungen.

## 🔍 Fehlende Details

- Wie handhabst du **transitive Dependencies** von NPM MCP-Servern?
- **User-Input Validation**: Wer validiert Tool-Parameter?
- **Audit Trail**: Logging von allen MCP-Tool Calls?

[POSITION: CONCERN] - Security-Architektur muss grundlegend überarbeitet werden bevor Implementation

**Position:** ⚠️ CONCERN - Security-Architektur muss grundlegend überarbeitet werden bevor Implementation

**Round Status:**
- Positions: 2 CONCERN
- Consensus: No

---

## Round 4/4

### [Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)

Claude CLI error

**Position:** 💡 PROPOSAL - Position unclear from response

### [Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)



**Position:** ⚠️ CONCERN - Position unclear from response

### [Reviewer] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)

Als **QA-Reviewer** analysiere ich die aktuelle Situation kritisch:

## ⚠️ Schwerwiegende Probleme erkannt

### 1. Unvollständiger Vorschlag
- **Planner** hat nur "Claude CLI error" gemeldet - kein echter Vorschlag
- **Senior Developer** äußert CONCERN ohne Details
- Keine konkrete MCP-Server Implementierungsstrategie vorgelegt

### 2. Unklare Anforderungen
- Was für MCP-Server soll implementiert werden?
- Welche MCP-Protokoll-Version? (1.0, 1.1, draft?)
- Welche Tools/Resources sollen exponiert werden?
- Integration in bestehende Orchestrator-Architektur?

### 3. Architektur-Risiken
Das OpenBotMan System ist bereits komplex:
- Multi-Agent Orchestration 
- Multiple LLM Provider (Claude, GPT-4, Gemini, Ollama)
- CLI + API Interfaces
- Knowledge Base mit Vector Search

**MCP-Server würde weitere Komplexität hinzufügen** - brauchen wir klare Abgrenzung!

### 4. Test-Strategien fehlen
- Wie testen wir MCP-Protokoll-Compliance?
- Wie validieren wir Tool-Registrierung?
- Load-Tests für concurrent MCP-Clients?

## 🚫 Blockierende Fragen

1. **Warum MCP?** - Was ist der konkrete Use Case?
2. **Scope Definition** - Welche MCP-Features sind kritisch?
3. **Breaking Changes** - Wie bleibt Rückwärtskompatibilität?
4. **Security Model** - Wie isolieren wir MCP-Tools?

## 💡 Vor-Bedingungen für Support

Falls wir weitermachen:
- **Vollständige Requirements-Analyse**
- **MCP-Protokoll Deep-Dive** (aktuelle Spec prüfen)
- **Proof-of-Concept** mit simplem Tool
- **Security Review** der MCP-Sandbox-Anforderungen

[POSITION: OBJECTION] - Vorschlag ist unvollständig und Risiken nicht addressiert. Brauche konkrete Implementierungsstrategie bevor ich zustimmen kann.

**Position:** 🚫 OBJECTION - Vorschlag ist unvollständig und Risiken nicht addressiert. Brauche konkrete Implementierungsstrategie bevor ich zustimmen kann.

**Round Status:**
- Positions: 1 CONCERN, 1 OBJECTION
- Consensus: No
- Objections: 1

---

## Conditions & Concerns

### Conditions
- Senior Developer: S] - Robustes Error-Handling und Memory-Management müssen von Anfang an implementiert werden, nicht nachträglich
- Senior Developer: Robustes Error-Handling und Memory-Management müssen von Anfang an implementiert werden, nicht nachträglich.

### Noted Concerns
- Senior Developer: Position unclear from response
- Reviewer: Position unclear from response
- Reviewer: Scope zu groß, Security-Risiken unbehandelt, Testing-Strategie fehlt**
- Reviewer: Security-Architektur muss grundlegend überarbeitet werden bevor Implementation

---

*Generated by OpenBotMan Multi-Agent Discussion*