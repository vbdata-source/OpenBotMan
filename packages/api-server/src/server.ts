/**
 * OpenBotMan API Server
 * 
 * HTTP REST interface for multi-agent discussions.
 * Designed for server deployments where CLI access is not available.
 */

import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';

import { readFileSync, existsSync } from 'fs';
import { createAuthMiddleware } from './middleware/auth.js';
import { DiscussRequestSchema, type DiscussResponse, type HealthResponse, type ApiServerConfig } from './types.js';
import { loadWorkspaceContext, formatWorkspaceContext } from './workspace.js';
import { jobStore } from './jobs.js';

// Import from orchestrator (we'll use the discussion logic)
import { createProvider } from '@openbotman/orchestrator';

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
   * 
   * With async=true: Returns job ID immediately, poll /api/v1/jobs/:id for results
   * Without async: Waits for completion (may timeout for long discussions)
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
      
      console.log(`[${requestId}] Starting discussion: "${request.topic.slice(0, 50)}..." (${request.agents} agents, async=${request.async})`);
      
      // ASYNC MODE: Return job ID immediately
      if (request.async) {
        jobStore.create(requestId);
        jobStore.setRunning(requestId, 'Starting discussion...');
        
        // Run discussion in background
        runDiscussion(request, config, requestId)
          .then(result => {
            if (result.error) {
              jobStore.setError(requestId, result.error, Date.now() - startTime);
            } else {
              jobStore.setComplete(requestId, result.markdown, result.actionItems, Date.now() - startTime);
            }
            console.log(`[${requestId}] Async discussion complete`);
          })
          .catch(error => {
            jobStore.setError(requestId, error instanceof Error ? error.message : 'Unknown error', Date.now() - startTime);
            console.error(`[${requestId}] Async discussion error:`, error);
          });
        
        // Return immediately with job ID
        res.status(202).json({
          id: requestId,
          status: 'accepted',
          message: 'Discussion started. Poll /api/v1/jobs/' + requestId + ' for results.',
          jobUrl: '/api/v1/jobs/' + requestId,
        });
        return;
      }
      
      // SYNC MODE: Wait for completion
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
  
  /**
   * GET /api/v1/jobs/:jobId - Get job status and results
   */
  app.get('/api/v1/jobs/:jobId', (req: Request, res: Response) => {
    const jobId = req.params.jobId;
    if (!jobId) {
      res.status(400).json({ error: 'Job ID required' });
      return;
    }
    const job = jobStore.get(jobId);
    
    if (!job) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job not found. It may have expired or never existed.',
      });
      return;
    }
    
    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      actionItems: job.actionItems,
      error: job.error,
      durationMs: job.durationMs,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    });
  });
  
  /**
   * GET /api/v1/jobs - List all jobs (for debugging)
   */
  app.get('/api/v1/jobs', (_req: Request, res: Response) => {
    const jobs = jobStore.list().map(job => ({
      id: job.id,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    }));
    
    res.json({ jobs, count: jobs.length });
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
  request: { 
    topic: string; 
    agents: number; 
    maxRounds: number; 
    timeout: number; 
    model?: string;
    workspace?: string;
    include?: string[];
    maxContext?: number;
    promptFile?: string;
  },
  config: ApiServerConfig,
  requestId: string
): Promise<DiscussionResult> {
  
  // Create provider based on config
  const provider = createProvider({
    provider: config.defaultProvider,
    model: request.model ?? config.defaultModel,
    apiKey: config.defaultProvider === 'claude-api' ? config.anthropicApiKey : undefined,
  });
  
  // Load topic from prompt file if specified
  let topic = request.topic;
  if (request.promptFile && existsSync(request.promptFile)) {
    try {
      topic = readFileSync(request.promptFile, 'utf-8');
      console.log(`[${requestId}] Loaded prompt from: ${request.promptFile}`);
    } catch (error) {
      console.warn(`[${requestId}] Could not read prompt file: ${request.promptFile}`);
    }
  }
  
  // Load workspace context if specified
  let workspaceContext = '';
  if (request.workspace && request.include && request.include.length > 0) {
    try {
      const maxBytes = (request.maxContext ?? 100) * 1024;
      const context = await loadWorkspaceContext(request.workspace, request.include, maxBytes);
      workspaceContext = formatWorkspaceContext(context);
      console.log(`[${requestId}] Loaded workspace: ${context.fileCount} files, ${Math.round(context.totalSize / 1024)}KB`);
    } catch (error) {
      console.warn(`[${requestId}] Could not load workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Build the full prompt with context
  const fullPrompt = workspaceContext 
    ? `${workspaceContext}\n\n---\n\n## Aufgabe\n\n${topic}`
    : topic;
  
  const systemPrompt = `Du bist ein erfahrener Software-Experte. 
Analysiere das folgende Thema und gib eine strukturierte Empfehlung.
Wenn Workspace-Context vorhanden ist, analysiere die Dateien sorgfältig.
Antworte auf Deutsch.

Format:
## Analyse
(Deine Analyse der Dateien und des Problems)

## Empfehlung
(Konkrete Empfehlung basierend auf den Dateien)

## Action Items
- [ ] Item 1
- [ ] Item 2`;

  try {
    const response = await provider.send(fullPrompt, {
      systemPrompt,
      timeoutMs: request.timeout * 1000,
      maxTokens: 4096,
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
