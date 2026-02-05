#!/usr/bin/env node
/**
 * OpenBotMan API Server CLI
 * 
 * Starts the HTTP API server for multi-agent discussions.
 * 
 * Usage:
 *   openbotman-api                    # Start with defaults
 *   openbotman-api --port 3000        # Custom port
 *   openbotman-api --provider claude-api  # Use API instead of CLI
 * 
 * Environment Variables:
 *   OPENBOTMAN_API_KEYS     Comma-separated API keys (required)
 *   ANTHROPIC_API_KEY       For claude-api provider
 *   PORT                    Server port (default: 8080)
 *   HOST                    Server host (default: 0.0.0.0)
 */

import 'dotenv/config';
import { startServer } from './server.js';
import type { ApiServerConfig } from './types.js';

// Parse command line arguments
const args = process.argv.slice(2);

function getArg(name: string, defaultValue?: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

// Help
if (hasFlag('help') || hasFlag('h')) {
  console.log(`
OpenBotMan API Server

Usage:
  openbotman-api [options]

Options:
  --port <number>      Server port (default: 8080, or PORT env)
  --host <string>      Server host (default: 0.0.0.0, or HOST env)
  --provider <name>    LLM provider: claude-cli, claude-api, openai, google
  --model <name>       Model name (default: claude-sonnet-4-20250514)
  --help, -h           Show this help

Environment Variables:
  OPENBOTMAN_API_KEYS  Comma-separated API keys for authentication (required)
  ANTHROPIC_API_KEY    Anthropic API key (required for claude-api provider)
  OPENAI_API_KEY       OpenAI API key (for openai provider)
  GOOGLE_API_KEY       Google API key (for google provider)
  PORT                 Server port
  HOST                 Server host

Examples:
  # Start with defaults (claude-cli)
  OPENBOTMAN_API_KEYS=my-secret-key openbotman-api

  # Start with Claude API
  OPENBOTMAN_API_KEYS=my-key ANTHROPIC_API_KEY=sk-ant-xxx openbotman-api --provider claude-api

  # Custom port
  openbotman-api --port 3000
`);
  process.exit(0);
}

// Build config
const apiKeys = process.env.OPENBOTMAN_API_KEYS?.split(',').map(k => k.trim()).filter(Boolean);

if (!apiKeys || apiKeys.length === 0) {
  console.error('Error: OPENBOTMAN_API_KEYS environment variable is required.');
  console.error('Set it to a comma-separated list of API keys for authentication.');
  console.error('Example: OPENBOTMAN_API_KEYS=key1,key2 openbotman-api');
  process.exit(1);
}

const provider = getArg('provider', 'claude-cli') as ApiServerConfig['defaultProvider'];

// Validate provider
if (!['claude-cli', 'claude-api', 'openai', 'google'].includes(provider)) {
  console.error(`Error: Invalid provider "${provider}".`);
  console.error('Valid providers: claude-cli, claude-api, openai, google');
  process.exit(1);
}

// Check API key for API providers
if (provider === 'claude-api' && !process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is required for claude-api provider.');
  process.exit(1);
}

const config: ApiServerConfig = {
  port: parseInt(getArg('port', process.env.PORT ?? '8080')!, 10),
  host: getArg('host', process.env.HOST ?? '0.0.0.0')!,
  apiKeys,
  corsOrigins: ['*'], // TODO: Make configurable
  defaultModel: getArg('model', 'claude-sonnet-4-20250514')!,
  defaultProvider: provider,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
};

// Start server
console.log('Starting OpenBotMan API Server...');
startServer(config).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
