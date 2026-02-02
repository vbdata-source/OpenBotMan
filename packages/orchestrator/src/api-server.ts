/**
 * OpenBotMan API Server
 * 
 * REST API for external integrations.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Orchestrator } from './orchestrator.js';
import { SecurityManager } from './security.js';
import type { OrchestratorConfig } from './types.js';

/**
 * API Server configuration
 */
export interface APIServerConfig {
  port: number;
  host: string;
  cors: {
    enabled: boolean;
    origins: string[];
  };
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
}

/**
 * API Server
 */
export class APIServer {
  private app: Express;
  private orchestrator: Orchestrator;
  private security: SecurityManager;
  private config: APIServerConfig;
  
  constructor(
    orchestratorConfig: OrchestratorConfig,
    apiConfig: Partial<APIServerConfig> = {}
  ) {
    this.config = {
      port: 8080,
      host: '0.0.0.0',
      cors: { enabled: true, origins: ['*'] },
      rateLimit: { enabled: true, maxRequests: 100, windowMs: 60000 },
      ...apiConfig,
    };
    
    this.app = express();
    this.orchestrator = new Orchestrator(orchestratorConfig);
    this.security = new SecurityManager();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandler();
  }
  
  /**
   * Set up middleware
   */
  private setupMiddleware(): void {
    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    
    // CORS
    if (this.config.cors.enabled) {
      this.app.use(cors({
        origin: this.config.cors.origins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      }));
    }
    
    // Request logging
    this.app.use((req, _res, next) => {
      console.log(`[API] ${req.method} ${req.path}`);
      next();
    });
    
    // Rate limiting
    if (this.config.rateLimit.enabled) {
      const requestCounts = new Map<string, { count: number; resetAt: number }>();
      
      this.app.use((req, res, next) => {
        const key = req.ip ?? 'unknown';
        const now = Date.now();
        const entry = requestCounts.get(key);
        
        if (!entry || entry.resetAt < now) {
          requestCounts.set(key, { count: 1, resetAt: now + this.config.rateLimit.windowMs });
          return next();
        }
        
        if (entry.count >= this.config.rateLimit.maxRequests) {
          return res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil((entry.resetAt - now) / 1000),
          });
        }
        
        entry.count++;
        next();
      });
    }
  }
  
  /**
   * Set up API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', version: '2.0.0' });
    });
    
    // Status
    this.app.get('/status', (_req, res) => {
      res.json(this.orchestrator.getStatus());
    });
    
    // Chat endpoint
    this.app.post('/chat', async (req, res) => {
      try {
        const { message, sessionId } = req.body;
        
        if (!message) {
          return res.status(400).json({ error: 'Message required' });
        }
        
        const response = await this.orchestrator.chat(message);
        
        res.json({
          response,
          sessionId: sessionId ?? 'default',
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
    
    // Orchestrate task
    this.app.post('/orchestrate', async (req, res) => {
      try {
        const { task, agents, workflow, context } = req.body;
        
        if (!task) {
          return res.status(400).json({ error: 'Task required' });
        }
        
        let result: unknown;
        
        if (workflow) {
          result = await this.orchestrator.runWorkflow(workflow, { task, ...context });
        } else {
          result = await this.orchestrator.chat(task);
        }
        
        res.json({ result });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
    
    // Get agents
    this.app.get('/agents', (_req, res) => {
      const status = this.orchestrator.getStatus() as any;
      res.json({ agents: status.agents });
    });
    
    // Get workflows
    this.app.get('/workflows', (_req, res) => {
      // TODO: Get from config
      res.json({
        workflows: [
          { id: 'code_review', name: 'Code Review', description: 'Full code review workflow' },
          { id: 'feature_development', name: 'Feature Development', description: 'Feature development workflow' },
        ],
      });
    });
    
    // Knowledge base query
    this.app.post('/knowledge/query', async (req, res) => {
      try {
        const { query, types, limit } = req.body;
        
        if (!query) {
          return res.status(400).json({ error: 'Query required' });
        }
        
        // TODO: Connect to knowledge base
        res.json({ results: [] });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
    
    // Knowledge base add
    this.app.post('/knowledge/add', async (req, res) => {
      try {
        const { type, title, content, tags } = req.body;
        
        if (!type || !title || !content) {
          return res.status(400).json({ error: 'Type, title, and content required' });
        }
        
        // TODO: Connect to knowledge base
        res.json({ id: 'new-id', message: 'Knowledge added' });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
    
    // Discussion endpoint
    this.app.post('/discuss', async (req, res) => {
      try {
        const { topic, participants, maxRounds } = req.body;
        
        if (!topic) {
          return res.status(400).json({ error: 'Topic required' });
        }
        
        const result = await this.orchestrator.createDiscussion({
          topic,
          participants: participants ?? [],
          maxRounds,
        });
        
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
    
    // Reset conversation
    this.app.post('/reset', (_req, res) => {
      this.orchestrator.reset();
      res.json({ message: 'Conversation reset' });
    });
  }
  
  /**
   * Set up error handler
   */
  private setupErrorHandler(): void {
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[API] Error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
  }
  
  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, this.config.host, () => {
        console.log(`[API] Server listening on ${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }
  
  /**
   * Get Express app (for testing)
   */
  getApp(): Express {
    return this.app;
  }
}
