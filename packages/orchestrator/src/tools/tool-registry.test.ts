/**
 * ToolRegistry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from './tool-registry.js';
import type { OpenBotManTool } from '@openbotman/protocol';

function createMockTool(name: string): OpenBotManTool {
  return {
    name,
    description: `Mock tool: ${name}`,
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Test input' },
      },
      required: ['input'],
    },
    execute: async (args) => ({
      success: true,
      output: `Executed ${name} with ${JSON.stringify(args)}`,
    }),
  };
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register / unregister', () => {
    it('should register a tool', () => {
      const tool = createMockTool('test_tool');
      registry.register(tool);

      expect(registry.size).toBe(1);
      expect(registry.has('test_tool')).toBe(true);
      expect(registry.get('test_tool')).toBe(tool);
    });

    it('should throw on duplicate registration', () => {
      registry.register(createMockTool('dup'));
      expect(() => registry.register(createMockTool('dup'))).toThrow('already registered');
    });

    it('should unregister a tool', () => {
      registry.register(createMockTool('to_remove'));
      expect(registry.unregister('to_remove')).toBe(true);
      expect(registry.size).toBe(0);
      expect(registry.has('to_remove')).toBe(false);
    });

    it('should return false when unregistering non-existent tool', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });

    it('should remove agent assignments when unregistering', () => {
      registry.register(createMockTool('assigned_tool'));
      registry.assignToAgent('agent-1', ['assigned_tool']);

      registry.unregister('assigned_tool');
      expect(registry.getToolsForAgent('agent-1')).toHaveLength(0);
    });
  });

  describe('getAllTools / getToolNames', () => {
    it('should return all registered tools', () => {
      registry.register(createMockTool('a'));
      registry.register(createMockTool('b'));
      registry.register(createMockTool('c'));

      expect(registry.getAllTools()).toHaveLength(3);
      expect(registry.getToolNames()).toEqual(['a', 'b', 'c']);
    });

    it('should return empty arrays when no tools registered', () => {
      expect(registry.getAllTools()).toHaveLength(0);
      expect(registry.getToolNames()).toEqual([]);
    });
  });

  describe('agent assignment', () => {
    it('should assign tools to an agent', () => {
      registry.register(createMockTool('tool_a'));
      registry.register(createMockTool('tool_b'));

      registry.assignToAgent('agent-1', ['tool_a', 'tool_b']);
      const tools = registry.getToolsForAgent('agent-1');

      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toContain('tool_a');
      expect(tools.map(t => t.name)).toContain('tool_b');
    });

    it('should throw when assigning unknown tool', () => {
      expect(() => registry.assignToAgent('agent-1', ['nonexistent']))
        .toThrow('unknown tool');
    });

    it('should return empty array for agent with no assignments', () => {
      expect(registry.getToolsForAgent('no-agent')).toHaveLength(0);
    });

    it('should support different tools per agent', () => {
      registry.register(createMockTool('shared'));
      registry.register(createMockTool('only_a'));
      registry.register(createMockTool('only_b'));

      registry.assignToAgent('agent-a', ['shared', 'only_a']);
      registry.assignToAgent('agent-b', ['shared', 'only_b']);

      expect(registry.getToolsForAgent('agent-a').map(t => t.name)).toEqual(['shared', 'only_a']);
      expect(registry.getToolsForAgent('agent-b').map(t => t.name)).toEqual(['shared', 'only_b']);
    });

    it('should remove tools from agent', () => {
      registry.register(createMockTool('removable'));
      registry.assignToAgent('agent-1', ['removable']);

      registry.removeFromAgent('agent-1', ['removable']);
      expect(registry.getToolsForAgent('agent-1')).toHaveLength(0);
    });
  });

  describe('toAnthropicTools', () => {
    it('should convert to Anthropic tool format', () => {
      registry.register(createMockTool('api_tool'));
      registry.assignToAgent('agent-1', ['api_tool']);

      const anthropicTools = registry.toAnthropicTools('agent-1');

      expect(anthropicTools).toHaveLength(1);
      expect(anthropicTools[0]).toEqual({
        name: 'api_tool',
        description: 'Mock tool: api_tool',
        input_schema: {
          type: 'object',
          properties: { input: { type: 'string', description: 'Test input' } },
          required: ['input'],
        },
      });
    });

    it('should return empty array for agent with no tools', () => {
      expect(registry.toAnthropicTools('no-agent')).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should execute a registered tool', async () => {
      registry.register(createMockTool('exec_tool'));

      const result = await registry.execute(
        'exec_tool',
        { input: 'hello' },
        { agentId: 'test', agentName: 'Test Agent' }
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('exec_tool');
      expect(result.output).toContain('hello');
    });

    it('should throw for unknown tool', async () => {
      await expect(
        registry.execute('unknown', {}, { agentId: 'test', agentName: 'Test' })
      ).rejects.toThrow('Tool not found');
    });
  });
});
