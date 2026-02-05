/**
 * OpenBotMan API Server
 * 
 * HTTP REST interface for multi-agent discussions.
 * 
 * @example
 * ```typescript
 * import { createServer, startServer } from '@openbotman/api-server';
 * 
 * // Quick start
 * await startServer({
 *   port: 8080,
 *   host: '0.0.0.0',
 *   apiKeys: ['my-secret-key'],
 *   corsOrigins: ['*'],
 *   defaultModel: 'claude-sonnet-4-20250514',
 *   defaultProvider: 'claude-api',
 *   anthropicApiKey: process.env.ANTHROPIC_API_KEY,
 * });
 * 
 * // Or create app for custom setup
 * const app = createServer(config);
 * app.listen(8080);
 * ```
 */

export { createServer, startServer } from './server.js';
export type { ApiServerConfig, DiscussRequest, DiscussResponse, HealthResponse } from './types.js';
export { DiscussRequestSchema } from './types.js';
export { createAuthMiddleware } from './middleware/auth.js';
export { loadWorkspaceContext, formatWorkspaceContext, type WorkspaceContext, type WorkspaceFile } from './workspace.js';
