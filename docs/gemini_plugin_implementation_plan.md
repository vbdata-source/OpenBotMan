# Refactoring des OpenBotMan Plugin-Systems

Dieser überarbeitete Entwurf berücksichtigt das wertvolle Feedback des Coders. Der Fokus liegt nun auf einer klaren Trennung zwischen internen "Meta-Tools" und externen Plugin-Tools, einer sauberen Integration der MCP-Architektur (Client und Server getrennt) und strikter Security von Anfang an.

## Proposed Changes

### Phase 1: Tool Registry & Security Foundation 
Die 6 Kern-Tools (`delegate_task`, `create_discussion`, etc.) bleiben als **Meta-Tools** fest im `Orchestrator` verankert, da sie Zugriff auf den internen State benötigen. Die neue Registry verwaltet *ausschließlich* externe Erweiterungen.

*   **`packages/orchestrator/src/tools/ToolRegistry.ts`:**
    *   Erstellen der Klasse `ToolRegistry` zur dynamischen Verwaltung externer Tool-Instanzen.
    *   **Integration:** Die bestehende Methode `buildTools(agentId)` wird erweitert, um Kern- und externe Tools zu mergen:
        ```typescript
        // Beispielhafte Implementierung im Orchestrator
        public getTools(agentId: string) {
          return [
            ...this.coreTools,
            ...this.toolRegistry.getToolsForAgent(agentId)
          ];
        }
        ```
*   **Security ab Tag 1 (`packages/orchestrator/src/security/AuditLogger.ts`):** 
    *   Zwingendes Logging (Timestamp, Agent, Tool, Parameter, Result) für *jeden* Tool-Aufruf, um die Sicherheit schon in Phase 1 zu gewährleisten.
*   **Config-Verzahnung (`api-server` vs. `orchestrator`):**
    *   Sicherstellen, dass die [config.yaml](file:///c:/Sources/OpenBotMan/config.yaml) Parser in *beiden* Systemen die Tool-Zuweisung via `AgentCapabilities` verstehen (Respektierung des eigenen Konsens-Systems im `api-server`).

### Phase 2a: MCP Server Stubs anbinden (OpenBotMan nach außen öffnen)
Der bestehende MCP-Server ([packages/mcp-server/src/server.ts](file:///c:/Sources/OpenBotMan/packages/mcp-server/src/server.ts)) wird "zum Leben erweckt".
*   Verdrahten der existierenden Tool-Stubs (`orchestrate`, `discuss`, etc.) mit der echten Orchestrator-Instanz (Dependency Injection). So können IDEs (VSCode) reale Aktionen in OpenBotMan auslösen.

### Phase 2b: MCP Client integrieren (Externe Tools für unsere Agenten)
Hier geben wir unseren Agenten die wirkliche Macht.
*   Implementierung von `packages/orchestrator/src/mcp/MCPClientManager.ts` auf Basis des `@modelcontextprotocol/sdk` Client-Moduls.
*   **Konfiguration:** Der Manager liest externe MCP-Server aus der [config.yaml](file:///c:/Sources/OpenBotMan/config.yaml) ab und registriert deren Tools dynamisch:
    ```yaml
    # config.yaml Beispiel für MCP Client Config
    mcp_servers:
      - name: "github"
        command: "npx"
        args: ["-y", "@modelcontextprotocol/server-github"]
        env:
          GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"
    ```

### Phase 3: Custom Plugins Sandbox (Lokale Node.js/npm Plugins)
*   **`packages/orchestrator/src/tools/PluginLoader.ts`:**
    *   Scannen des `skills/`-Ordners nach Node.js Modulen.
    *   **Isolierung:** Ausführung erfolgt über `worker_threads` (anstatt des auf Windows fehleranfälligen `vm`-Moduls) in einem streng limitierten Kontext. Der Worker validiert FileSystem-Zugriffe oder Env-Variablen hart gegen die vom Orchestrator vorgegebene Liste der `AgentCapabilities`.

---

## Verification Plan

### Automated Tests
- **Rückwärtskompatibilität:** Die bestehenden **487 Tests** der Suite müssen ausnahmslos **grün** bleiben! (`pnpm test` via *Vitest*)
- **Build-Prozess:** Erfolgreiche TypeScript-Compilation aller 6 aktiven Pakete sicherstellen (`pnpm build`).
- **Neue Unit-Tests:** Für die `ToolRegistry` und den `AuditLogger` in `packages/orchestrator/`.
- **Integration Tests:** Testen des `MCPClientManager` (Mock-MCP-Server starten, initialisieren und sicherstellen, dass dessen Tools an die interne Registry übergeben werden).

### Manual Verification
- Starten des Orchestrators und `api-server`s im CLI-Modus `pnpm cli discuss "..."` und prüfen, ob die 6 Meta-Tools weiterhin völlig ungestört von den Agenten genutzt werden können.
- Starten eines Community-MCP-Servers (z.B. Google Drive) und Durchführen eines echten Chat-Tasks, in dem der Agent aktiv das Tool des MCP-Servers einsetzt.
