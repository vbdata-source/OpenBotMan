/**
 * MCP Client Manager
 *
 * Connects to external MCP servers (e.g. GitHub, Postgres, filesystem)
 * and registers their tools in the internal ToolRegistry.
 *
 * This is the "outbound" MCP integration - giving our agents access
 * to external community tools.
 */

import { resolve } from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { OpenBotManTool, ToolResult } from '@openbotman/protocol';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { AuditLogger } from '../tools/audit-logger.js';

/**
 * Configuration for an external MCP server
 */
export interface MCPServerConfig {
  /** Unique identifier for this server */
  id: string;

  /** Human-readable name */
  name: string;

  /** Command to start the MCP server */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Environment variables for the server process */
  env?: Record<string, string>;

  /** Which agents can use this server's tools (empty = all) */
  allowedAgents?: string[];

  /** Whether this server is enabled */
  enabled?: boolean;
}

/**
 * A connected MCP server with its client and discovered tools
 */
interface ConnectedServer {
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport;
  toolNames: string[];
}

export class MCPClientManager {
  private servers: Map<string, ConnectedServer> = new Map();
  private registry: ToolRegistry;
  private auditLogger: AuditLogger;

  constructor(registry: ToolRegistry, auditLogger: AuditLogger) {
    this.registry = registry;
    this.auditLogger = auditLogger;
  }

  /**
   * Connect to an MCP server, discover its tools, and register them.
   */
  async connect(config: MCPServerConfig): Promise<string[]> {
    if (config.enabled === false) {
      return [];
    }

    if (this.servers.has(config.id)) {
      throw new Error(`MCP server already connected: ${config.id}`);
    }

    // On Windows, commands like 'npx' need '.cmd' extension for spawn
    const isWindows = process.platform === 'win32';
    let command = config.command;
    if (isWindows && !command.includes('.') && !command.includes('/') && !command.includes('\\')) {
      command = `${command}.cmd`;
    }

    // Resolve relative paths in args (e.g. "tools/fetch-mcp/server.mjs")
    // Use forward slashes to avoid Windows backslash escape issues in child processes
    const resolvedArgs = config.args?.map(arg => {
      if (arg.endsWith('.js') || arg.endsWith('.mjs') || arg.endsWith('.ts')) {
        return resolve(arg).replace(/\\/g, '/');
      }
      return arg;
    });

    // Build env: only add custom env vars, let child inherit process.env naturally
    // Passing full process.env explicitly can cause EINVAL on Windows with invalid values
    const transport = new StdioClientTransport({
      command,
      args: resolvedArgs,
      ...(config.env ? { env: { ...process.env as Record<string, string>, ...config.env } } : {}),
    });

    const client = new Client(
      { name: 'openbotman-orchestrator', version: '2.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);

    // Discover tools from the server
    const toolsResult = await client.listTools();
    const toolNames: string[] = [];

    for (const tool of toolsResult.tools) {
      const namespaced = `${config.id}_${tool.name}`;

      // Create an OpenBotManTool wrapper that delegates to the MCP client
      const wrappedTool: OpenBotManTool = {
        name: namespaced,
        description: `[${config.name}] ${tool.description || tool.name}`,
        inputSchema: {
          type: 'object',
          properties: (tool.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {},
          required: (tool.inputSchema as { required?: string[] })?.required,
        },
        execute: async (args, context): Promise<ToolResult> => {
          const startTime = Date.now();
          try {
            const result = await client.callTool({
              name: tool.name, // Use original name for the MCP server
              arguments: args,
            });

            const content = Array.isArray(result.content) ? result.content as Array<{ type: string; text?: string }> : [];
            const output = content
              .filter(c => c.type === 'text' && c.text)
              .map(c => c.text!)
              .join('\n');

            const toolResult: ToolResult = {
              success: !result.isError,
              output: output || '(no output)',
              error: result.isError ? output : undefined,
            };

            this.auditLogger.logToolCall(
              context.agentId, context.agentName, namespaced,
              args, toolResult, Date.now() - startTime, context.jobId
            );

            return toolResult;
          } catch (error) {
            const toolResult: ToolResult = {
              success: false,
              output: '',
              error: error instanceof Error ? error.message : String(error),
            };

            this.auditLogger.logToolCall(
              context.agentId, context.agentName, namespaced,
              args, toolResult, Date.now() - startTime, context.jobId
            );

            return toolResult;
          }
        },
      };

      this.registry.register(wrappedTool);
      toolNames.push(namespaced);

      // Assign to allowed agents (or leave unassigned for manual assignment)
      if (config.allowedAgents && config.allowedAgents.length > 0) {
        for (const agentId of config.allowedAgents) {
          this.registry.assignToAgent(agentId, [namespaced]);
        }
      }
    }

    this.servers.set(config.id, { config, client, transport, toolNames });

    console.log(`[MCP] Connected to "${config.name}": ${toolNames.length} tools registered`);
    return toolNames;
  }

  /**
   * Connect to multiple MCP servers from config.
   */
  async connectAll(configs: MCPServerConfig[]): Promise<Map<string, string[]>> {
    const results = new Map<string, string[]>();

    for (const config of configs) {
      try {
        const tools = await this.connect(config);
        results.set(config.id, tools);
      } catch (error) {
        console.error(`[MCP] Failed to connect to "${config.name}": ${error instanceof Error ? error.message : error}`);
        results.set(config.id, []);
      }
    }

    return results;
  }

  /**
   * Disconnect from an MCP server and unregister its tools.
   */
  async disconnect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    // Unregister all tools from this server
    for (const toolName of server.toolNames) {
      this.registry.unregister(toolName);
    }

    try {
      await server.client.close();
    } catch {
      // Ignore close errors
    }

    this.servers.delete(serverId);
    console.log(`[MCP] Disconnected from "${server.config.name}"`);
  }

  /**
   * Disconnect from all servers.
   */
  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.servers.keys());
    for (const id of ids) {
      await this.disconnect(id);
    }
  }

  /**
   * Get list of connected servers and their tool counts.
   */
  getConnectedServers(): Array<{ id: string; name: string; toolCount: number }> {
    return Array.from(this.servers.values()).map(s => ({
      id: s.config.id,
      name: s.config.name,
      toolCount: s.toolNames.length,
    }));
  }

  /**
   * Check if a server is connected.
   */
  isConnected(serverId: string): boolean {
    return this.servers.has(serverId);
  }
}
