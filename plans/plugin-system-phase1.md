# Plugin-System Phase 1: Tool Registry & Security Foundation

## Kontext

OpenBotMan-Agenten sind aktuell reine "Denker" - sie diskutieren und erreichen Konsens,
koennen aber keine externen Aktionen ausfuehren. Ein Plugin-System macht sie zu "Machern".

Dieser Plan beschreibt Phase 1 von 4 Phasen:
- **Phase 1: Tool Registry + Audit** (dieser Plan)
- Phase 2a: MCP Server Stubs anbinden
- Phase 2b: MCP Client fuer externe Tools
- Phase 3: Custom Plugins mit Sandbox

Basis: Geminis ueberarbeiteter Entwurf (`plans/gemini_plugin_implementation_plan.md`)
mit Claude's Korrekturen (Meta-Tools bleiben im Orchestrator, Security ab Tag 1).

---

## Design-Entscheidungen

### Was NICHT geaendert wird
- Die 6 Meta-Tools (`delegate_task`, `create_discussion`, `run_workflow`,
  `query_knowledge`, `add_knowledge`, `request_human_input`) bleiben fest im
  Orchestrator (`orchestrator.ts:buildTools()`). Sie brauchen vollen Zugriff auf
  `this.agentRunner`, `this.discussionEngine`, `this.knowledgeBase`.

### Was NEU kommt
1. **ToolRegistry** - verwaltet ausschliesslich externe/Plugin-Tools
2. **OpenBotManTool Interface** - einheitliches Interface im Protocol-Paket
3. **AuditLogger** - loggt jeden Tool-Aufruf (Security ab Tag 1)
4. **Config-Integration** - `tools:` Abschnitt pro Agent in config.yaml

---

## Architektur

```
Orchestrator.buildTools()
  │
  ├── 6 Meta-Tools (hardcoded, interner State-Zugriff)
  │   ├── delegate_task
  │   ├── create_discussion
  │   ├── run_workflow
  │   ├── query_knowledge
  │   ├── add_knowledge
  │   └── request_human_input
  │
  └── ToolRegistry.getToolsForAgent(agentId)
      ├── Plugin-Tool A (z.B. jira_create_ticket)
      ├── Plugin-Tool B (z.B. fs_read_file)
      └── ... (dynamisch geladen)

Jeder Tool-Aufruf → AuditLogger.log(timestamp, agent, tool, params, result)
```

---

## Dateien und Aenderungen

### Neue Dateien

#### 1. `packages/protocol/src/tools.ts`
Einheitliches Interface fuer alle Plugin-Tools (wird von allen Paketen importiert).

```typescript
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ToolContext {
  jobId: string;
  agentId: string;
  agentName: string;
  workspaceDir?: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface OpenBotManTool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}
```

#### 2. `packages/orchestrator/src/tools/tool-registry.ts`
Zentrale Registry fuer externe Tools.

```typescript
export class ToolRegistry {
  private tools: Map<string, OpenBotManTool> = new Map();
  private agentToolMap: Map<string, Set<string>> = new Map();

  register(tool: OpenBotManTool): void;
  unregister(toolName: string): void;
  assignToAgent(agentId: string, toolNames: string[]): void;
  getToolsForAgent(agentId: string): OpenBotManTool[];
  getAllTools(): OpenBotManTool[];
  toAnthropicTools(agentId: string): Anthropic.Tool[];
}
```

#### 3. `packages/orchestrator/src/tools/audit-logger.ts`
Audit-Log fuer jeden Tool-Aufruf.

```typescript
export interface AuditEntry {
  timestamp: string;
  agentId: string;
  agentName: string;
  toolName: string;
  params: Record<string, unknown>;
  result: ToolResult;
  durationMs: number;
}

export class AuditLogger {
  constructor(logDir: string);
  log(entry: AuditEntry): void;
  getEntries(filter?: { agentId?: string; toolName?: string }): AuditEntry[];
}
```

#### 4. `packages/orchestrator/src/tools/tool-registry.test.ts`
Unit-Tests fuer ToolRegistry.

#### 5. `packages/orchestrator/src/tools/audit-logger.test.ts`
Unit-Tests fuer AuditLogger.

### Geaenderte Dateien

#### 6. `packages/protocol/src/index.ts`
Export der neuen Tool-Interfaces.

#### 7. `packages/orchestrator/src/orchestrator.ts`
- `buildTools()` kombiniert Meta-Tools + `this.toolRegistry.toAnthropicTools(agentId)`
- `executeTool()` loggt via AuditLogger
- Constructor: initialisiert ToolRegistry + AuditLogger

#### 8. `packages/orchestrator/src/types.ts`
- `OrchestratorConfig` erhaelt optionales `tools?: ToolConfig[]`
- `AgentDefinition` erhaelt optionales `tools?: string[]`

#### 9. `config.yaml`
Neuer Abschnitt fuer Tool-Definitionen und Agent-Zuweisung:

```yaml
# Optional: Plugin-Tools (Phase 1 vorbereitet, aber noch kein Loader)
tools: []

agents:
  - id: planner
    name: "Strategic Planner"
    role: architect
    # NEU: Welche Tools darf dieser Agent nutzen
    tools: []  # leer = keine Plugin-Tools, nur Meta-Tools
```

---

## Tasklist

### Vorbereitung
- [ ] Task 1: OpenBotManTool Interface in protocol erstellen
- [ ] Task 2: Protocol-Paket exportieren und bauen

### Kern-Implementierung
- [ ] Task 3: ToolRegistry implementieren
- [ ] Task 4: AuditLogger implementieren
- [ ] Task 5: ToolRegistry in Orchestrator integrieren (buildTools + executeTool)
- [ ] Task 6: config.yaml um tools-Abschnitt erweitern

### Tests
- [ ] Task 7: Unit-Tests ToolRegistry
- [ ] Task 8: Unit-Tests AuditLogger
- [ ] Task 9: Alle 487+ bestehenden Tests muessen gruen bleiben

### Build & Verifikation
- [ ] Task 10: TypeScript-Build aller 6 aktiven Pakete
- [ ] Task 11: Manueller Smoke-Test (CLI discuss funktioniert weiterhin)

---

## Verifikation

### Automatisiert
```bash
# Alle Tests gruen
pnpm test

# Alle Pakete bauen
cd packages/protocol && npm run build
cd packages/orchestrator && npm run build
cd packages/api-server && npm run build
cd packages/cli && npm run build
cd packages/ide-vscode && npm run build
cd packages/web-ui && npm run build
```

### Manuell
- `pnpm cli discuss "Test-Frage"` - Meta-Tools funktionieren wie bisher
- AuditLogger schreibt Log-Eintraege bei Tool-Aufrufen
- ToolRegistry kann Tools registrieren und pro Agent filtern

---

## Abgrenzung (NICHT in Phase 1)

- Kein Plugin-Loader aus `skills/`-Ordner (Phase 3)
- Kein MCP Client/Server (Phase 2a/2b)
- Keine Sandbox/VM-Isolation (Phase 3)
- Keine tatsaechlichen Plugin-Tools - nur die Infrastruktur
