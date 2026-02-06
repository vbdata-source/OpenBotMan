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
import {
  extractPosition,
  evaluateRound,
  buildProposerPrompt,
  buildResponderPrompt,
  extractActionItems,
  formatConsensusResult,
  type AgentContribution,
  type RoundResult,
  type ConsensusResult,
} from './consensus.js';

// Import from orchestrator (we'll use the discussion logic)
import { createProvider } from '@openbotman/orchestrator';

// Import config loader
import { getConfig, getAgentsForDiscussion } from './config.js';

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
      
      const rawRequest = parseResult.data;
      
      // Apply defaults from config.yaml (not hardcoded!)
      const discussionConfig = getConfig();
      const request = {
        ...rawRequest,
        agents: rawRequest.agents ?? discussionConfig.agents.length,
        maxRounds: rawRequest.maxRounds ?? discussionConfig.maxRounds ?? 10,
        timeout: rawRequest.timeout ?? discussionConfig.timeout ?? 60,
        maxContext: rawRequest.maxContext ?? Math.round(discussionConfig.maxContext / 1024) ?? 100,
      };
      
      console.log(`[${requestId}] Starting discussion: "${request.topic.slice(0, 50)}..." (${request.agents} agents, async=${request.async})`);
      
      // ASYNC MODE: Return job ID immediately
      if (request.async) {
        // Load agents from config (supports per-agent model/provider)
        const discussionConfig = getConfig();
        const agentConfigs = getAgentsForDiscussion(discussionConfig, request.agents);
        
        jobStore.create(requestId, request.topic);
        
        // Initialize job with agent names and their individual models
        const agentNames = agentConfigs.map(a => a.name);
        const defaultModel = agentConfigs[0]?.model ?? config.defaultModel;
        const defaultProvider = agentConfigs[0]?.provider ?? config.defaultProvider;
        jobStore.initAgents(requestId, agentNames, defaultModel, defaultProvider);
        jobStore.setRunning(requestId, 'Diskussion startet...');
        
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
    
    // Check if verbose mode requested
    const verbose = req.query.verbose === 'true' || req.query.verbose === '1';
    
    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      topic: job.topic,
      currentRound: job.currentRound,
      maxRounds: job.maxRounds,
      currentAgent: job.currentAgent,
      agents: job.agents?.map(a => ({
        name: a.name,
        role: a.role,
        status: a.status,
        durationMs: a.durationMs,
        model: a.model,
        provider: a.provider,
        responsePreview: a.responsePreview,
        // Include full response in verbose mode
        ...(verbose && a.fullResponse ? { fullResponse: a.fullResponse } : {}),
      })),
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
  // Note: Individual providers are created per-agent below (supports different models)
  
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
  
  // Build the full context
  const fullContext = workspaceContext || '';

  // Load agent definitions from config.yaml (supports per-agent model/provider)
  const discussionConfig = getConfig();
  const agentConfigs = getAgentsForDiscussion(discussionConfig, request.agents);
  
  console.log(`[${requestId}] Using ${agentConfigs.length} agents from config:`);
  agentConfigs.forEach(a => console.log(`  - ${a.name} (${a.provider}/${a.model})`));
  
  // Create providers for each agent (supports different models per agent)
  type ProviderType = 'claude-cli' | 'claude-api' | 'openai' | 'google' | 'ollama' | 'mock';
  const agentProviders = new Map<string, ReturnType<typeof createProvider>>();
  for (const agent of agentConfigs) {
    console.log(`[${requestId}] Creating provider for ${agent.name}: provider=${agent.provider}, apiKey=${agent.apiKey ? '✓' : '✗ MISSING'}`);
    
    const providerConfig: {
      provider: ProviderType;
      model: string;
      apiKey?: string;
    } = {
      provider: agent.provider as ProviderType,
      model: agent.model,
    };
    
    // Add API key if specified for this agent or from config
    if (agent.apiKey) {
      providerConfig.apiKey = agent.apiKey;
    } else if (agent.provider === 'claude-api' && config.anthropicApiKey) {
      providerConfig.apiKey = config.anthropicApiKey;
    } else if (agent.provider === 'google' && process.env.GOOGLE_API_KEY) {
      // Fallback: use env var directly for google
      providerConfig.apiKey = process.env.GOOGLE_API_KEY;
      console.log(`[${requestId}] Using GOOGLE_API_KEY from env for ${agent.name}`);
    }
    
    agentProviders.set(agent.id, createProvider(providerConfig));
  }

  const startTime = Date.now();
  const rounds: RoundResult[] = [];
  const allContributions: AgentContribution[] = [];
  let consensusReached = false;
  
  try {
    // Run multiple rounds until consensus or max rounds
    for (let round = 1; round <= request.maxRounds && !consensusReached; round++) {
      console.log(`[${requestId}] Starting round ${round}/${request.maxRounds}`);
      jobStore.setRound(requestId, round, request.maxRounds);
      
      // Reset agent statuses for new round (just trigger update once)
      if (round > 1) {
        jobStore.setRound(requestId, round, request.maxRounds);
      }
      
      const roundContributions: AgentContribution[] = [];
      
      // Each agent contributes (with their own model/provider from config)
      for (const agent of agentConfigs) {
        jobStore.setAgentThinking(requestId, agent.name);
        const agentStartTime = Date.now();
        
        // Get agent's specific provider (each agent can have different model)
        const agentProvider = agentProviders.get(agent.id)!;
        
        // Build prompt based on round
        let prompt: string;
        if (round === 1 && roundContributions.length === 0) {
          // First agent, first round: Proposer
          prompt = buildProposerPrompt(topic, fullContext);
        } else {
          // All other cases: Responder
          const previousContribs = round === 1 
            ? roundContributions 
            : [...allContributions.slice(-agentConfigs.length), ...roundContributions];
          prompt = buildResponderPrompt(topic, fullContext, previousContribs, round, agent.role);
        }
        
        const response = await agentProvider.send(prompt, {
          systemPrompt: agent.systemPrompt,
          timeoutMs: request.timeout * 1000,
          maxTokens: agent.maxTokens || 4096,
        });
        
        const { position, reason } = extractPosition(response.text);
        const durationMs = Date.now() - agentStartTime;
        
        const contribution: AgentContribution = {
          agentName: agent.name,
          role: agent.role,
          content: response.text,
          position: round === 1 && roundContributions.length === 0 ? 'PROPOSAL' : position,
          positionReason: reason,
          durationMs,
          model: agent.model,      // Per-agent model!
          provider: agent.provider, // Per-agent provider!
        };
        
        roundContributions.push(contribution);
        allContributions.push(contribution);
        
        jobStore.setAgentComplete(requestId, agent.name, response.text);
        console.log(`[${requestId}] ${agent.name} (${agent.model}): [${contribution.position}] (${Math.round(durationMs/1000)}s)`);
      }
      
      // Evaluate round
      const roundResult = evaluateRound(round, roundContributions);
      rounds.push(roundResult);
      consensusReached = roundResult.consensusReached;
      
      console.log(`[${requestId}] Round ${round} complete. Consensus: ${consensusReached ? 'YES' : 'NO'}`);
      
      if (roundResult.objections.length > 0) {
        console.log(`[${requestId}] Objections: ${roundResult.objections.join(', ')}`);
      }
      
      // If no consensus and not last round, continue
      if (!consensusReached && round < request.maxRounds) {
        console.log(`[${requestId}] Continuing to round ${round + 1}...`);
      }
    }
    
    // Build final result
    const allActionItems = allContributions.flatMap(c => extractActionItems(c.content));
    const uniqueActionItems = [...new Set(allActionItems)];
    
    const result: ConsensusResult = {
      topic,
      rounds,
      consensusReached,
      totalRounds: rounds.length,
      finalSummary: consensusReached ? 'Konsens erreicht' : 'Kein Konsens nach max. Runden',
      actionItems: uniqueActionItems,
      durationMs: Date.now() - startTime,
    };
    
    const markdown = formatConsensusResult(result);
    
    return {
      consensus: consensusReached,
      markdown,
      actionItems: uniqueActionItems,
      rounds: rounds.length,
    };
    
  } catch (error) {
    return {
      consensus: false,
      markdown: '',
      actionItems: [],
      rounds: rounds.length,
      error: error instanceof Error ? error.message : 'Provider error',
    };
  }
}

/**
 * Start the server
 */
export function startServer(config: ApiServerConfig): Promise<void> {
  return new Promise((resolve) => {
    const app = createServer(config);
    
    // Load agent configs for display
    const discussionConfig = getConfig();
    const agentConfigs = getAgentsForDiscussion(discussionConfig, 10); // Get all configured agents
    
    // Build agent display lines
    const agentLines = agentConfigs.map(a => {
      const emoji = a.emoji || '🤖';
      const name = a.name.slice(0, 20).padEnd(20);
      const provider = a.provider.slice(0, 12);
      return `║    ${emoji} ${name} (${provider})`;
    });
    
    app.listen(config.port, config.host, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🤖 OpenBotMan API Server                           ║
╠══════════════════════════════════════════════════════════════╣
║  URL:      http://${config.host}:${config.port}                              ║
╠──────────────────────────────────────────────────────────────╣
║  Discussion Agents (${agentConfigs.length}):                                    ║
${agentLines.map(l => l.padEnd(64) + '║').join('\n')}
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
