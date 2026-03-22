#!/usr/bin/env node

/**
 * Simple Fetch MCP Server for OpenBotMan
 *
 * Provides a 'fetch' tool that retrieves web page content as text/markdown.
 * Runs as stdio MCP server - no dependencies beyond Node.js built-ins.
 */

import { createInterface } from 'readline';

const SERVER_INFO = {
  name: 'openbotman-fetch',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'fetch',
    description: 'Fetch a web page and return its content as text. Use this to retrieve documentation, articles, or any web content for analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch',
        },
      },
      required: ['url'],
    },
  },
];

/**
 * Fetch a URL and extract text content (strip HTML tags)
 */
async function fetchUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OpenBotMan/2.0 (MCP Fetch Server)',
        'Accept': 'text/html, application/json, text/plain',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // For JSON, return as-is
    if (contentType.includes('application/json')) {
      return { content: text.substring(0, 50000) };
    }

    // For HTML, strip tags and clean up
    if (contentType.includes('text/html')) {
      const cleaned = text
        // Remove script and style blocks
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        // Convert common elements to markdown
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p[^>]*>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
        .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        // Remove remaining tags
        .replace(/<[^>]+>/g, '')
        // Decode HTML entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        // Clean whitespace
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+$/gm, '')
        .trim();

      return { content: cleaned.substring(0, 50000) };
    }

    // Plain text
    return { content: text.substring(0, 50000) };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { error: 'Request timed out after 30 seconds' };
    }
    return { error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Handle JSON-RPC messages
 */
async function handleMessage(message) {
  const { id, method, params } = message;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: SERVER_INFO,
          capabilities: {
            tools: {},
          },
        },
      };

    case 'notifications/initialized':
      return null; // No response for notifications

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      };

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (toolName !== 'fetch') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
            isError: true,
          },
        };
      }

      if (!args.url) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: 'Error: url parameter is required' }],
            isError: true,
          },
        };
      }

      const result = await fetchUrl(args.url);

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: result.error
              ? `Error fetching ${args.url}: ${result.error}`
              : result.content,
          }],
          isError: !!result.error,
        },
      };
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// Start stdio server
const rl = createInterface({ input: process.stdin });
let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk.toString();

  // Process complete JSON-RPC messages (newline-delimited)
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const message = JSON.parse(trimmed);
      const response = await handleMessage(message);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (err) {
      // Ignore parse errors
    }
  }
});

process.stderr.write('OpenBotMan Fetch MCP Server running\n');
