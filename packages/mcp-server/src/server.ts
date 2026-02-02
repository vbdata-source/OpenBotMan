#!/usr/bin/env node

/**
 * OpenBotMan MCP Server
 * 
 * Model Context Protocol server for IDE integration.
 * Provides tools for orchestrating multi-agent tasks.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * OpenBotMan MCP Server
 */
class OpenBotManMCPServer {
  private server: Server;
  
  constructor() {
    this.server = new Server(
      {
        name: 'openbotman',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );
    
    this.setupHandlers();
  }
  
  /**
   * Set up request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'orchestrate',
            description: 'Coordinate multiple AI agents to complete a complex task',
            inputSchema: {
              type: 'object',
              properties: {
                task: {
                  type: 'string',
                  description: 'The task to orchestrate',
                },
                agents: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific agents to use (optional)',
                },
                workflow: {
                  type: 'string',
                  description: 'Workflow to execute (optional)',
                },
              },
              required: ['task'],
            },
          },
          {
            name: 'discuss',
            description: 'Start a discussion between agents to reach consensus',
            inputSchema: {
              type: 'object',
              properties: {
                topic: {
                  type: 'string',
                  description: 'The topic to discuss',
                },
                participants: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Agent IDs to participate',
                },
                maxRounds: {
                  type: 'number',
                  description: 'Maximum discussion rounds',
                  default: 3,
                },
              },
              required: ['topic'],
            },
          },
          {
            name: 'knowledge_query',
            description: 'Search the shared knowledge base',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query',
                },
                types: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by knowledge types',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum results',
                  default: 10,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'knowledge_add',
            description: 'Add new knowledge to the shared knowledge base',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['decision', 'pattern', 'learning', 'code', 'doc'],
                  description: 'Type of knowledge',
                },
                title: {
                  type: 'string',
                  description: 'Knowledge title',
                },
                content: {
                  type: 'string',
                  description: 'Knowledge content',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tags for categorization',
                },
              },
              required: ['type', 'title', 'content'],
            },
          },
          {
            name: 'agent_status',
            description: 'Get status of all agents',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'delegate',
            description: 'Delegate a task to a specific agent',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: {
                  type: 'string',
                  description: 'Agent to delegate to',
                },
                task: {
                  type: 'string',
                  description: 'Task description',
                },
                role: {
                  type: 'string',
                  description: 'Role context',
                },
                priority: {
                  type: 'number',
                  description: 'Priority (0-4)',
                  default: 1,
                },
              },
              required: ['agentId', 'task'],
            },
          },
        ],
      };
    });
    
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'orchestrate':
            return await this.handleOrchestrate(args as any);
          case 'discuss':
            return await this.handleDiscuss(args as any);
          case 'knowledge_query':
            return await this.handleKnowledgeQuery(args as any);
          case 'knowledge_add':
            return await this.handleKnowledgeAdd(args as any);
          case 'agent_status':
            return await this.handleAgentStatus();
          case 'delegate':
            return await this.handleDelegate(args as any);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
    
    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'openbotman://agents',
            name: 'Agent List',
            description: 'List of configured agents',
            mimeType: 'application/json',
          },
          {
            uri: 'openbotman://workflows',
            name: 'Workflow List',
            description: 'List of available workflows',
            mimeType: 'application/json',
          },
          {
            uri: 'openbotman://knowledge/stats',
            name: 'Knowledge Stats',
            description: 'Knowledge base statistics',
            mimeType: 'application/json',
          },
        ],
      };
    });
    
    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      switch (uri) {
        case 'openbotman://agents':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  agents: [
                    { id: 'claude_code', role: 'coder', status: 'idle' },
                    { id: 'gemini', role: 'reviewer', status: 'idle' },
                    { id: 'gpt4', role: 'tester', status: 'idle' },
                  ],
                }, null, 2),
              },
            ],
          };
        
        case 'openbotman://workflows':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  workflows: [
                    { id: 'code_review', name: 'Code Review' },
                    { id: 'feature_development', name: 'Feature Development' },
                  ],
                }, null, 2),
              },
            ],
          };
        
        case 'openbotman://knowledge/stats':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  totalDocuments: 0,
                  byType: {},
                  lastUpdated: new Date().toISOString(),
                }, null, 2),
              },
            ],
          };
        
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }
  
  /**
   * Handle orchestrate tool
   */
  private async handleOrchestrate(args: {
    task: string;
    agents?: string[];
    workflow?: string;
  }) {
    // TODO: Connect to actual orchestrator
    return {
      content: [
        {
          type: 'text',
          text: `Orchestrating task: "${args.task}"\n\n` +
                `Agents: ${args.agents?.join(', ') || 'auto-selected'}\n` +
                `Workflow: ${args.workflow || 'dynamic'}\n\n` +
                `[MCP Server - Orchestrator integration pending]`,
        },
      ],
    };
  }
  
  /**
   * Handle discuss tool
   */
  private async handleDiscuss(args: {
    topic: string;
    participants?: string[];
    maxRounds?: number;
  }) {
    return {
      content: [
        {
          type: 'text',
          text: `Starting discussion: "${args.topic}"\n\n` +
                `Participants: ${args.participants?.join(', ') || 'all agents'}\n` +
                `Max rounds: ${args.maxRounds || 3}\n\n` +
                `[MCP Server - Discussion engine integration pending]`,
        },
      ],
    };
  }
  
  /**
   * Handle knowledge query
   */
  private async handleKnowledgeQuery(args: {
    query: string;
    types?: string[];
    limit?: number;
  }) {
    return {
      content: [
        {
          type: 'text',
          text: `Searching knowledge base: "${args.query}"\n\n` +
                `Types: ${args.types?.join(', ') || 'all'}\n` +
                `Limit: ${args.limit || 10}\n\n` +
                `Results: [Knowledge base integration pending]`,
        },
      ],
    };
  }
  
  /**
   * Handle knowledge add
   */
  private async handleKnowledgeAdd(args: {
    type: string;
    title: string;
    content: string;
    tags?: string[];
  }) {
    return {
      content: [
        {
          type: 'text',
          text: `Adding knowledge: "${args.title}"\n\n` +
                `Type: ${args.type}\n` +
                `Tags: ${args.tags?.join(', ') || 'none'}\n` +
                `Content: ${args.content.slice(0, 100)}...\n\n` +
                `[Knowledge base integration pending]`,
        },
      ],
    };
  }
  
  /**
   * Handle agent status
   */
  private async handleAgentStatus() {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            agents: [
              { id: 'claude_code', role: 'coder', status: 'idle', tasks: 0 },
              { id: 'gemini', role: 'reviewer', status: 'idle', tasks: 0 },
              { id: 'gpt4', role: 'tester', status: 'idle', tasks: 0 },
            ],
            totalTasks: 0,
            uptime: '0s',
          }, null, 2),
        },
      ],
    };
  }
  
  /**
   * Handle delegate
   */
  private async handleDelegate(args: {
    agentId: string;
    task: string;
    role?: string;
    priority?: number;
  }) {
    return {
      content: [
        {
          type: 'text',
          text: `Delegating to ${args.agentId}:\n\n` +
                `Task: ${args.task}\n` +
                `Role: ${args.role || 'default'}\n` +
                `Priority: ${args.priority || 1}\n\n` +
                `[Agent runner integration pending]`,
        },
      ],
    };
  }
  
  /**
   * Start the server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('OpenBotMan MCP Server running on stdio');
  }
}

// Start server
const server = new OpenBotManMCPServer();
server.start().catch(console.error);
