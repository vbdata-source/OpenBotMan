/**
 * Built-in Tools for OpenBotMan
 *
 * These tools run directly in the API server process - no MCP server needed.
 * Activated via config.yaml builtinTools section.
 */

export { webSearchTool } from './web-search.js';
export { webFetchTool } from './web-fetch.js';
