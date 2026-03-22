/**
 * Tool Registry
 *
 * Central registry for external/plugin tools.
 * Core meta-tools (delegate_task, etc.) remain in the Orchestrator.
 * This registry manages only dynamically added tools.
 */

import type { OpenBotManTool, ToolContext, ToolResult } from '@openbotman/protocol';

/**
 * Anthropic Tool definition shape (for type compatibility without importing Anthropic SDK)
 */
export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export class ToolRegistry {
  /** All registered tools by name */
  private tools: Map<string, OpenBotManTool> = new Map();

  /** Which tools are assigned to which agent */
  private agentToolMap: Map<string, Set<string>> = new Map();

  /**
   * Register a new tool.
   * @throws if a tool with the same name already exists
   */
  register(tool: OpenBotManTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool by name.
   * Also removes it from all agent assignments.
   */
  unregister(toolName: string): boolean {
    if (!this.tools.has(toolName)) {
      return false;
    }
    this.tools.delete(toolName);

    // Remove from all agent assignments
    for (const assignments of this.agentToolMap.values()) {
      assignments.delete(toolName);
    }
    return true;
  }

  /**
   * Get a tool by name.
   */
  get(toolName: string): OpenBotManTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Assign specific tools to an agent.
   * Only assigned tools will be available to that agent's LLM calls.
   */
  assignToAgent(agentId: string, toolNames: string[]): void {
    const assignments = this.agentToolMap.get(agentId) ?? new Set();
    for (const name of toolNames) {
      if (!this.tools.has(name)) {
        throw new Error(`Cannot assign unknown tool "${name}" to agent "${agentId}"`);
      }
      assignments.add(name);
    }
    this.agentToolMap.set(agentId, assignments);
  }

  /**
   * Remove tool assignments from an agent.
   */
  removeFromAgent(agentId: string, toolNames: string[]): void {
    const assignments = this.agentToolMap.get(agentId);
    if (!assignments) return;
    for (const name of toolNames) {
      assignments.delete(name);
    }
  }

  /**
   * Get all tools assigned to an agent.
   * If no tools are explicitly assigned, returns an empty array
   * (agent only has meta-tools).
   */
  getToolsForAgent(agentId: string): OpenBotManTool[] {
    const assignments = this.agentToolMap.get(agentId);
    if (!assignments || assignments.size === 0) {
      return [];
    }

    const tools: OpenBotManTool[] = [];
    for (const name of assignments) {
      const tool = this.tools.get(name);
      if (tool) tools.push(tool);
    }
    return tools;
  }

  /**
   * Get all registered tools.
   */
  getAllTools(): OpenBotManTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all registered tool names.
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Convert assigned tools to Anthropic Tool format for a specific agent.
   * These can be spread into the meta-tools array in buildTools().
   */
  toAnthropicTools(agentId: string): AnthropicToolDef[] {
    return this.getToolsForAgent(agentId).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required,
      },
    }));
  }

  /**
   * Execute a tool by name with context and audit support.
   * @returns the tool result, or throws if tool not found
   */
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return tool.execute(args, context);
  }

  /**
   * Check if a tool name belongs to the registry (vs. meta-tools).
   */
  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Number of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }
}
