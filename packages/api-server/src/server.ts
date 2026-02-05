/**
 * OpenBotMan API Server
 * 
 * HTTP REST interface for multi-agent discussions.
 * Designed for server deployments where CLI access is not available.
 */

import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';

import { createAuthMiddleware } from './middleware/auth.js';
import { DiscussRequestSchema, type DiscussResponse, type HealthResponse, type ApiServerConfig } from './types.js';

// Import from orchestrator (we'll use the discussion logic)
import { createProvider, type LLMProvider } from '@openbotman/orchestrator';

/**
 * Create and configure the Express server
 */
export function createServer(config: ApiServerConfig): Express {
  const app = express();
  const startTime = Date.now();
  
  // Middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: config.corsOrigins }));
  app.use(createAuthMiddleware(config.apiKeys));
  
  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });
  
  // ============================================
  // Routes
  // ============================================
  
  /**
   * GET / - Root endpoint
   */
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'OpenBotMan API',
      version: '2.0.0-alpha.1',
      docs: '/health for status, POST /api/v1/discuss for discussions',
    });
  });
  
  /**
   * GET /health - Health check endpoint
   */
  app.get('/health', async (_req: Request, res: Response) => {
    const providers = await checkProviders(config);
    
    const allHealthy = providers.every(p => p.available);
    const someHealthy = providers.some(p => p.available);
    
    const response: HealthResponse = {
      status: allHealthy ? 'healthy' : (someHealthy ? 'degraded' : 'unhealthy'),
      version: '2.0.0-alpha.1',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      providers,
    };
    
    res.status(response.status === 'unhealthy' ? 503 : 200).json(response);
  });
  
  /**
   * POST /api/v1/discuss - Start a multi-agent discussion
   */
  app.post('/api/v1/discuss', async (req: Request, res: Response) => {
    const requestId = uuid();
    const startTime = Date.now();
    
    try {
      // Validate request
      const parseResult = DiscussRequestSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request body',
          details: parseResult.error.errors,
        });
        return;
      }
      
      const request = parseResult.data;
      
      console.log(`[${requestId}] Starting discussion: "${request.topic.slice(0, 50)}..." (${request.agents} agents, ${request.maxRounds} rounds)`);
      
      // Run the discussion
      const result = await runDiscussion(request, config, requestId);
      
      const response: DiscussResponse = {
        id: requestId,
        status: result.error ? 'error' : 'complete',
        consensus: result.consensus,
        result: result.markdown,
        actionItems: result.actionItems,
        rounds: result.rounds,
        durationMs: Date.now() - startTime,
        error: result.error,
      };
      
      console.log(`[${requestId}] Discussion complete: ${response.status} in ${response.durationMs}ms`);
      
      res.json(response);
      
    } catch (error) {
      console.error(`[${requestId}] Error:`, error);
      
      const response: DiscussResponse = {
        id: requestId,
        status: 'error',
        consensus: false,
        result: '',
        actionItems: [],
        rounds: 0,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      res.status(500).json(response);
    }
  });
  
  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'Endpoint not found',
    });
  });
  
  return app;
}

/**
 * Check provider availability
 */
async function checkProviders(config: ApiServerConfig): Promise<{ name: string; available: boolean }[]> {
  const results: { name: string; available: boolean }[] = [];
  
  // Check claude-api if configured
  if (config.anthropicApiKey) {
    try {
      const provider = createProvider({
        provider: 'claude-api',
        model: config.defaultModel,
        apiKey: config.anthropicApiKey,
      });
      results.push({ name: 'claude-api', available: await provider.isAvailable() });
    } catch {
      results.push({ name: 'claude-api', available: false });
    }
  }
  
  // Check claude-cli
  try {
    const provider = createProvider({
      provider: 'claude-cli',
      model: config.defaultModel,
    });
    results.push({ name: 'claude-cli', available: await provider.isAvailable() });
  } catch {
    results.push({ name: 'claude-cli', available: false });
  }
  
  return results;
}

/**
 * Discussion result
 */
interface DiscussionResult {
  consensus: boolean;
  markdown: string;
  actionItems: string[];
  rounds: number;
  error?: string;
}

/**
 * Run a multi-agent discussion
 * 
 * This is a simplified implementation. In production, this would integrate
 * with the full orchestrator discussion logic from @openbotman/cli.
 */
async function runDiscussion(
  request: { topic: string; agents: number; maxRounds: number; timeout: number; model?: string },
  config: ApiServerConfig,
  _requestId: string
): Promise<DiscussionResult> {
  
  // Create provider based on config
  const provider = createProvider({
    provider: config.defaultProvider,
    model: request.model ?? config.defaultModel,
    apiKey: config.defaultProvider === 'claude-api' ? config.anthropicApiKey : undefined,
  });
  
  // For now, we do a simple single-agent response
  // TODO: Integrate full multi-agent discussion from CLI
  
  const systemPrompt = `Du bist ein erfahrener Software-Experte. 
Analysiere das folgende Thema und gib eine strukturierte Empfehlung.
Antworte auf Deutsch.

Format:
## Analyse
(Deine Analyse)

## Empfehlung
(Konkrete Empfehlung)

## Action Items
- [ ] Item 1
- [ ] Item 2`;

  try {
    const response = await provider.send(request.topic, {
      systemPrompt,
      timeoutMs: request.timeout * 1000,
    });
    
    if (response.isError) {
      return {
        consensus: false,
        markdown: '',
        actionItems: [],
        rounds: 0,
        error: response.text,
      };
    }
    
    // Extract action items from response
    const actionItems = extractActionItems(response.text);
    
    return {
      consensus: true, // Single agent = auto-consensus
      markdown: response.text,
      actionItems,
      rounds: 1,
    };
    
  } catch (error) {
    return {
      consensus: false,
      markdown: '',
      actionItems: [],
      rounds: 0,
      error: error instanceof Error ? error.message : 'Provider error',
    };
  }
}

/**
 * Extract action items from markdown
 */
function extractActionItems(markdown: string): string[] {
  const items: string[] = [];
  const regex = /- \[ \] (.+)/g;
  let match;
  
  while ((match = regex.exec(markdown)) !== null) {
    items.push(match[1]!);
  }
  
  return items;
}

/**
 * Start the server
 */
export function startServer(config: ApiServerConfig): Promise<void> {
  return new Promise((resolve) => {
    const app = createServer(config);
    
    app.listen(config.port, config.host, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🤖 OpenBotMan API Server                           ║
╠══════════════════════════════════════════════════════════════╣
║  URL:      http://${config.host}:${config.port}                              ║
║  Provider: ${config.defaultProvider.padEnd(20)}                       ║
║  Model:    ${config.defaultModel.slice(0, 20).padEnd(20)}                       ║
╠──────────────────────────────────────────────────────────────╣
║  Endpoints:                                                  ║
║    GET  /health          Health check                        ║
║    POST /api/v1/discuss  Start discussion                    ║
╚══════════════════════════════════════════════════════════════╝
      `);
      resolve();
    });
  });
}
