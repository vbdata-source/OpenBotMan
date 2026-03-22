/**
 * OpenBotMan Tool System Types
 *
 * Unified interfaces for plugin tools used by the orchestrator,
 * MCP server, and custom plugins.
 */

/**
 * JSON Schema for tool input parameters.
 * Passed directly to LLM providers (Anthropic, OpenAI, Google).
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

/**
 * Execution context provided to every tool call.
 * Contains information about who is calling and from where.
 */
export interface ToolContext {
  /** Current job ID (if running in async job) */
  jobId?: string;

  /** Agent ID making the tool call */
  agentId: string;

  /** Human-readable agent name */
  agentName: string;

  /** Workspace directory (if workspace context is available) */
  workspaceDir?: string;
}

/**
 * Result returned by a tool execution.
 */
export interface ToolResult {
  /** Whether the execution succeeded */
  success: boolean;

  /** Text output returned to the LLM */
  output: string;

  /** Structured metadata for the UI/orchestrator (not sent to LLM) */
  metadata?: Record<string, unknown>;

  /** Error message (when success is false) */
  error?: string;
}

/**
 * An OpenBotMan tool that can be registered in the ToolRegistry.
 *
 * This interface is for external/plugin tools only.
 * The 6 core meta-tools (delegate_task, create_discussion, etc.)
 * remain hardcoded in the Orchestrator.
 */
export interface OpenBotManTool {
  /** Unique tool name (format: "namespace_toolname", e.g. "jira_create_ticket") */
  name: string;

  /** Description for the LLM (when to use this tool) */
  description: string;

  /** JSON Schema for input parameters, bound to LLM tool use */
  inputSchema: ToolInputSchema;

  /** The actual execution logic */
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}
