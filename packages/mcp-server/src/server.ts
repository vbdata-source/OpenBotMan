#!/usr/bin/env node

/**
 * OpenBotMan MCP Server
 *
 * Model Context Protocol server for IDE integration.
 * Connects to the OpenBotMan API server via HTTP to execute real actions.
 *
 * Usage:
 *   OPENBOTMAN_API_URL=http://localhost:8080 OPENBOTMAN_API_KEY=your-key node dist/server.js
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_URL = process.env['OPENBOTMAN_API_URL'] || 'http://localhost:8080';
const API_KEY = process.env['OPENBOTMAN_API_KEY'] || '';

/**
 * Helper: Make authenticated API call to the OpenBotMan API server
 */
async function apiCall(path: string, options: {
  method?: string;
  body?: unknown;
} = {}): Promise<unknown> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Poll a job until completion
 */
async function pollJob(jobId: string, timeoutMs = 300000): Promise<{ status: string; result?: string; error?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await apiCall(`/api/v1/jobs/${jobId}`) as {
      status: string;
      result?: string;
      error?: string;
      progress?: string;
    };

    if (job.status === 'complete' || job.status === 'error') {
      return job;
    }

    // Wait 3 seconds between polls
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error(`Job ${jobId} timed out after ${timeoutMs / 1000}s`);
}

/**
 * OpenBotMan MCP Server - connected to live API server
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

  private setupHandlers(): void {
    // ========== TOOLS ==========
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'discuss',
            description: 'Start a multi-agent expert discussion to reach consensus on a topic. ' +
              'Agents discuss autonomously and return a structured result with positions and action items.',
            inputSchema: {
              type: 'object',
              properties: {
                topic: {
                  type: 'string',
                  description: 'The topic or question for the experts to discuss',
                },
                team: {
                  type: 'string',
                  description: 'Team ID (e.g. "full", "quick", "code-review", "security"). Optional.',
                },
                workspace: {
                  type: 'string',
                  description: 'Workspace path for code context. Optional.',
                },
                maxRounds: {
                  type: 'number',
                  description: 'Maximum discussion rounds (default: from config)',
                },
              },
              required: ['topic'],
            },
          },
          {
            name: 'status',
            description: 'Get OpenBotMan system status including available providers and server health.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list_teams',
            description: 'List available expert teams with their agents.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_job',
            description: 'Get the status and result of a running or completed discussion job.',
            inputSchema: {
              type: 'object',
              properties: {
                jobId: {
                  type: 'string',
                  description: 'The job ID to check',
                },
              },
              required: ['jobId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'discuss':
            return await this.handleDiscuss(args as {
              topic: string;
              team?: string;
              workspace?: string;
              maxRounds?: number;
            });

          case 'status':
            return await this.handleStatus();

          case 'list_teams':
            return await this.handleListTeams();

          case 'get_job':
            return await this.handleGetJob(args as { jobId: string });

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    });

    // ========== RESOURCES ==========
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'openbotman://teams',
            name: 'Expert Teams',
            description: 'Available expert teams and their agents',
            mimeType: 'application/json',
          },
          {
            uri: 'openbotman://health',
            name: 'System Health',
            description: 'API server health and provider status',
            mimeType: 'application/json',
          },
        ],
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'openbotman://teams': {
          const data = await apiCall('/api/v1/teams');
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            }],
          };
        }

        case 'openbotman://health': {
          const data = await apiCall('/health');
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            }],
          };
        }

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  // ========== Tool Handlers ==========

  /**
   * Start a real discussion via the API server.
   * Sends async request, polls for completion, returns result.
   */
  private async handleDiscuss(args: {
    topic: string;
    team?: string;
    workspace?: string;
    maxRounds?: number;
  }) {
    // Start async discussion
    const body: Record<string, unknown> = {
      topic: args.topic,
      async: true,
    };
    if (args.team) body.team = args.team;
    if (args.workspace) {
      body.workspace = args.workspace;
      body.include = ['**/*.ts', '**/*.js', '**/*.json', '**/*.py', '**/*.md'];
    }
    if (args.maxRounds) body.maxRounds = args.maxRounds;

    const startResult = await apiCall('/api/v1/discuss', {
      method: 'POST',
      body,
    }) as { id: string };

    // Poll for completion
    const job = await pollJob(startResult.id);

    if (job.status === 'error') {
      return {
        content: [{
          type: 'text',
          text: `Discussion failed: ${job.error || 'Unknown error'}`,
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: job.result || 'Discussion completed but no result was returned.',
      }],
    };
  }

  /**
   * Get system health status from the API server.
   */
  private async handleStatus() {
    const health = await apiCall('/health') as {
      status: string;
      version: string;
      uptime: number;
      providers: Array<{ name: string; available: boolean }>;
    };

    const lines = [
      `Status: ${health.status}`,
      `Version: ${health.version}`,
      `Uptime: ${health.uptime}s`,
      '',
      'Providers:',
      ...health.providers.map(p =>
        `  ${p.available ? '[OK]' : '[--]'} ${p.name}`
      ),
    ];

    return {
      content: [{
        type: 'text',
        text: lines.join('\n'),
      }],
    };
  }

  /**
   * List available teams from the API server.
   */
  private async handleListTeams() {
    const data = await apiCall('/api/v1/teams') as {
      teams: Array<{
        id: string;
        name: string;
        description: string;
        agentCount: number;
        default: boolean;
      }>;
    };

    const lines = data.teams.map(t =>
      `${t.default ? '* ' : '  '}${t.id} - ${t.name} (${t.agentCount} agents)${t.default ? ' [default]' : ''}`
    );

    return {
      content: [{
        type: 'text',
        text: `Available Teams:\n${lines.join('\n')}`,
      }],
    };
  }

  /**
   * Get job status/result.
   */
  private async handleGetJob(args: { jobId: string }) {
    const job = await apiCall(`/api/v1/jobs/${args.jobId}`) as {
      status: string;
      progress?: string;
      result?: string;
      error?: string;
      durationMs?: number;
    };

    if (job.status === 'complete') {
      return {
        content: [{
          type: 'text',
          text: job.result || 'Job completed.',
        }],
      };
    }

    if (job.status === 'error') {
      return {
        content: [{
          type: 'text',
          text: `Job failed: ${job.error}`,
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: `Job ${args.jobId}: ${job.status} - ${job.progress || 'processing...'}`,
      }],
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`OpenBotMan MCP Server running (API: ${API_URL})`);
  }
}

const server = new OpenBotManMCPServer();
server.start().catch(console.error);
