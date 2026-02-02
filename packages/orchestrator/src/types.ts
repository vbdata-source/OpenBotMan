/**
 * Orchestrator Types
 */

import type { AgentRole, LLMProvider } from '@openbotman/protocol';

/**
 * Agent definition
 */
export interface AgentDefinition {
  id: string;
  name: string;
  role: AgentRole;
  provider: LLMProvider;
  model: string;
  
  /** CLI command to invoke (for CLI-based agents) */
  cli?: string;
  
  /** CLI arguments */
  cliArgs?: string[];
  
  /** API configuration (for API-based agents) */
  api?: {
    baseUrl?: string;
    apiKey?: string;
  };
  
  /** System prompt for this agent */
  systemPrompt: string;
  
  /** Capabilities */
  capabilities: AgentCapabilities;
  
  /** Maximum tokens per response */
  maxTokens?: number;
  
  /** Temperature */
  temperature?: number;
  
  /** Whether this agent is enabled */
  enabled: boolean;
}

/**
 * Agent capabilities
 */
export interface AgentCapabilities {
  /** Can write code */
  code: boolean;
  
  /** Can review code */
  review: boolean;
  
  /** Can access filesystem */
  filesystem: boolean;
  
  /** Can execute shell commands */
  shell: boolean;
  
  /** Can access web */
  web: boolean;
  
  /** Can use MCP tools */
  mcp: boolean;
  
  /** Can participate in discussions */
  discussion: boolean;
  
  /** Can make decisions */
  decisions: boolean;
  
  /** Custom capabilities */
  custom?: string[];
}

/**
 * Agent instance (runtime state)
 */
export interface AgentInstance {
  definition: AgentDefinition;
  
  /** Current status */
  status: 'idle' | 'busy' | 'error' | 'offline';
  
  /** Current task */
  currentTask?: string;
  
  /** Session ID for persistent conversations */
  sessionId?: string;
  
  /** Last activity */
  lastActivity?: Date;
  
  /** Metrics */
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    tokensUsed: number;
    averageResponseTime: number;
  };
}

/**
 * Task definition
 */
export interface Task {
  id: string;
  
  /** Parent task (for subtasks) */
  parentId?: string;
  
  /** Task description */
  description: string;
  
  /** Assigned agent */
  assignedTo?: string;
  
  /** Required role */
  role?: AgentRole;
  
  /** Priority (0-4) */
  priority: number;
  
  /** Status */
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  
  /** Progress (0-100) */
  progress: number;
  
  /** Result */
  result?: unknown;
  
  /** Error if failed */
  error?: string;
  
  /** Dependencies */
  dependencies?: string[];
  
  /** Context from previous tasks */
  context?: Record<string, unknown>;
  
  /** Deadline */
  deadline?: Date;
  
  /** Timestamps */
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  /** Learnings extracted */
  learnings?: string[];
}

/**
 * Discussion room
 */
export interface DiscussionRoom {
  id: string;
  topic: string;
  participants: string[];
  moderator: string;
  
  /** Current round */
  round: number;
  
  /** Maximum rounds */
  maxRounds: number;
  
  /** Consensus threshold (0-1) */
  consensusThreshold: number;
  
  /** Transcript */
  transcript: DiscussionMessage[];
  
  /** Current votes */
  votes: Record<string, string>;
  
  /** Status */
  status: 'open' | 'voting' | 'consensus' | 'deadlock' | 'closed';
  
  /** Final decision */
  decision?: string;
  
  /** Timestamps */
  createdAt: Date;
  closedAt?: Date;
}

/**
 * Discussion message
 */
export interface DiscussionMessage {
  agentId: string;
  round: number;
  type: 'opinion' | 'question' | 'answer' | 'vote' | 'summary';
  content: string;
  stance?: 'support' | 'oppose' | 'neutral';
  confidence?: number;
  timestamp: Date;
}

/**
 * Workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  
  /** Workflow steps */
  steps: WorkflowStep[];
  
  /** Global context */
  context?: Record<string, unknown>;
  
  /** Quality gates */
  qualityGates?: QualityGate[];
}

/**
 * Workflow step
 */
export interface WorkflowStep {
  id: string;
  name: string;
  
  /** Agent to execute */
  agent?: string;
  
  /** Role required */
  role?: AgentRole;
  
  /** Task description */
  task: string;
  
  /** Input from previous steps */
  inputs?: string[];
  
  /** Output name */
  output?: string;
  
  /** Maximum iterations */
  maxIterations?: number;
  
  /** Condition to proceed */
  condition?: string;
  
  /** Parallel steps */
  parallel?: WorkflowStep[];
  
  /** On failure */
  onFailure?: 'abort' | 'skip' | 'retry';
}

/**
 * Quality gate
 */
export interface QualityGate {
  name: string;
  type: 'coverage' | 'complexity' | 'security' | 'performance' | 'custom';
  threshold: number;
  required: boolean;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Orchestrator model */
  model: string;
  
  /** Maximum iterations per task */
  maxIterations: number;
  
  /** Timeout per agent call (ms) */
  agentTimeout: number;
  
  /** Enable autonomous mode */
  autonomous: boolean;
  
  /** Require human approval for external actions */
  humanApproval: boolean;
  
  /** Knowledge base config */
  knowledgeBase: {
    enabled: boolean;
    storagePath: string;
    autoLearn: boolean;
  };
  
  /** Agent definitions */
  agents: AgentDefinition[];
  
  /** Workflows */
  workflows: Workflow[];
  
  /** Quality gates */
  qualityGates: QualityGate[];
}

/**
 * Human interaction request
 */
export interface HumanRequest {
  id: string;
  type: 'approval' | 'input' | 'clarification' | 'review';
  message: string;
  context?: Record<string, unknown>;
  options?: string[];
  deadline?: Date;
  priority: number;
}

/**
 * Human response
 */
export interface HumanResponse {
  requestId: string;
  response: string;
  approved?: boolean;
  timestamp: Date;
}

/**
 * Orchestrator events
 */
export interface OrchestratorEvents {
  'agent:started': (agentId: string, taskId: string) => void;
  'agent:completed': (agentId: string, taskId: string, result: unknown) => void;
  'agent:failed': (agentId: string, taskId: string, error: Error) => void;
  'task:created': (task: Task) => void;
  'task:assigned': (task: Task) => void;
  'task:completed': (task: Task) => void;
  'task:failed': (task: Task) => void;
  'discussion:started': (room: DiscussionRoom) => void;
  'discussion:message': (room: DiscussionRoom, message: DiscussionMessage) => void;
  'discussion:consensus': (room: DiscussionRoom, decision: string) => void;
  'human:request': (request: HumanRequest) => void;
  'human:response': (response: HumanResponse) => void;
  'knowledge:added': (id: string, type: string) => void;
  'error': (error: Error) => void;
}

/**
 * Message for agent communication
 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Tool definition for agents
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}
