/**
 * API Server Types
 */

import { z } from 'zod';

/**
 * Discussion request schema
 */
export const DiscussRequestSchema = z.object({
  /** Discussion topic/question */
  topic: z.string().min(1).max(50000),
  
  /** Number of agents (1-5) */
  agents: z.number().int().min(1).max(5).default(3),
  
  /** Maximum consensus rounds */
  maxRounds: z.number().int().min(1).max(20).default(5),
  
  /** Timeout per agent in seconds */
  timeout: z.number().int().min(10).max(300).default(60),
  
  /** Model to use */
  model: z.string().optional(),
  
  /** Workspace path - directory to load files from */
  workspace: z.string().optional(),
  
  /** Include patterns - glob patterns for files to load from workspace */
  include: z.array(z.string()).optional(),
  
  /** Max context size in KB (files loaded from workspace) */
  maxContext: z.number().int().min(1).max(500).default(100),
  
  /** Prompt file path - load topic from a markdown file */
  promptFile: z.string().optional(),
});

export type DiscussRequest = z.infer<typeof DiscussRequestSchema>;

/**
 * Discussion response
 */
export interface DiscussResponse {
  /** Request ID */
  id: string;
  
  /** Status */
  status: 'complete' | 'error' | 'timeout';
  
  /** Whether consensus was reached */
  consensus: boolean;
  
  /** Discussion result (markdown) */
  result: string;
  
  /** Action items extracted */
  actionItems: string[];
  
  /** Number of rounds completed */
  rounds: number;
  
  /** Duration in milliseconds */
  durationMs: number;
  
  /** Error message (if status is error) */
  error?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  providers: {
    name: string;
    available: boolean;
  }[];
}

/**
 * API Server configuration
 */
export interface ApiServerConfig {
  /** Server port */
  port: number;
  
  /** Server host */
  host: string;
  
  /** API keys (comma-separated or array) */
  apiKeys: string[];
  
  /** CORS origins */
  corsOrigins: string[];
  
  /** Default model */
  defaultModel: string;
  
  /** Default provider */
  defaultProvider: 'claude-cli' | 'claude-api' | 'openai' | 'google';
  
  /** Anthropic API key (for claude-api provider) */
  anthropicApiKey?: string;
}
