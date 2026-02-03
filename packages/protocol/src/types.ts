/**
 * AICP - Agent Inter-Communication Protocol
 * 
 * A compact, efficient protocol for agent-to-agent communication.
 * Designed for minimal token usage while maintaining full expressiveness.
 */

/**
 * Message types for inter-agent communication
 */
export enum MessageType {
  // Core Protocol (0x00-0x0F)
  PING = 0x01,
  PONG = 0x02,
  ACK = 0x03,
  NACK = 0x04,
  HELLO = 0x05,
  GOODBYE = 0x06,
  ERROR = 0x0F,
  
  // Task Management (0x10-0x1F)
  TASK_ASSIGN = 0x10,
  TASK_ACCEPT = 0x11,
  TASK_REJECT = 0x12,
  TASK_PROGRESS = 0x13,
  TASK_COMPLETE = 0x14,
  TASK_FAILED = 0x15,
  TASK_CANCEL = 0x16,
  TASK_DELEGATE = 0x17,
  
  // Knowledge Base (0x20-0x2F)
  KB_QUERY = 0x20,
  KB_RESULT = 0x21,
  KB_UPDATE = 0x22,
  KB_DELETE = 0x23,
  KB_SUBSCRIBE = 0x24,
  KB_NOTIFY = 0x25,
  
  // Discussion & Consensus (0x30-0x3F)
  DISCUSS_START = 0x30,
  DISCUSS_JOIN = 0x31,
  DISCUSS_LEAVE = 0x32,
  DISCUSS_OPINION = 0x33,
  DISCUSS_QUESTION = 0x34,
  DISCUSS_ANSWER = 0x35,
  DISCUSS_VOTE = 0x36,
  DISCUSS_CONSENSUS = 0x37,
  DISCUSS_DEADLOCK = 0x38,
  
  // Code Operations (0x40-0x4F)
  CODE_SUBMIT = 0x40,
  CODE_REVIEW = 0x41,
  CODE_SUGGESTION = 0x42,
  CODE_APPROVED = 0x43,
  CODE_REJECTED = 0x44,
  CODE_MERGE = 0x45,
  CODE_CONFLICT = 0x46,
  
  // Human Interaction (0x50-0x5F)
  HUMAN_INPUT = 0x50,
  HUMAN_OUTPUT = 0x51,
  HUMAN_ESCALATE = 0x52,
  HUMAN_APPROVE = 0x53,
  HUMAN_REJECT = 0x54,
  HUMAN_CLARIFY = 0x55,
  
  // Security (0x60-0x6F)
  SEC_ALERT = 0x60,
  SEC_AUDIT = 0x61,
  SEC_VIOLATION = 0x62,
  SEC_APPROVE = 0x63,
  
  // System (0xF0-0xFF)
  SYS_STATUS = 0xF0,
  SYS_METRICS = 0xF1,
  SYS_LOG = 0xF2,
  SYS_CONFIG = 0xF3,
  SYS_SHUTDOWN = 0xFE,
  SYS_RESTART = 0xFF,
}

/**
 * Message priority levels
 */
export enum Priority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
  CRITICAL = 4,
}

/**
 * Agent roles in the system
 */
export enum AgentRole {
  ORCHESTRATOR = 'orchestrator',
  ARCHITECT = 'architect',
  CODER = 'coder',
  REVIEWER = 'reviewer',
  TESTER = 'tester',
  SECURITY = 'security',
  DEVOPS = 'devops',
  DOCUMENTATION = 'documentation',
  RESEARCH = 'research',
  CUSTOM = 'custom',
}

/**
 * LLM providers supported
 */
export enum LLMProvider {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  GOOGLE = 'google',
  OLLAMA = 'ollama',
  AZURE = 'azure',
  AWS = 'aws',
  CUSTOM = 'custom',
}

/**
 * Message flags (bitfield)
 */
export enum MessageFlags {
  NONE = 0x0000,
  REQUIRES_ACK = 0x0001,
  ENCRYPTED = 0x0002,
  COMPRESSED = 0x0004,
  SIGNED = 0x0008,
  BROADCAST = 0x0010,
  URGENT = 0x0020,
  RETRANSMIT = 0x0040,
  FINAL = 0x0080,
}

/**
 * Base message header (fixed size: 56 bytes)
 */
export interface MessageHeader {
  /** Protocol version (1 byte) */
  version: number;
  /** Message type (1 byte) */
  type: MessageType;
  /** Message flags (2 bytes) */
  flags: number;
  /** Payload length (4 bytes) */
  length: number;
  /** Sender agent UUID (16 bytes) */
  sender: string;
  /** Recipient agent UUID or broadcast (16 bytes) */
  recipient: string;
  /** Correlation ID for request/response (16 bytes) */
  correlationId: string;
}

/**
 * Base message interface
 */
export interface Message<T = unknown> {
  header: MessageHeader;
  payload: T;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Optional signature for verification */
  signature?: Uint8Array;
}

// ============================================
// Task-related payloads
// ============================================

export interface TaskAssignPayload {
  taskId: string;
  role: AgentRole;
  description: string;
  context?: Record<string, unknown>;
  deadline?: number;
  priority: Priority;
  parentTaskId?: string;
  dependencies?: string[];
}

export interface TaskProgressPayload {
  taskId: string;
  progress: number; // 0-100
  status: string;
  artifacts?: string[];
  estimatedCompletion?: number;
}

export interface TaskCompletePayload {
  taskId: string;
  result: unknown;
  artifacts?: string[];
  metrics?: {
    tokensUsed?: number;
    duration?: number;
    iterations?: number;
  };
  learnings?: string[];
}

export interface TaskFailedPayload {
  taskId: string;
  error: string;
  errorCode?: string;
  recoverable: boolean;
  suggestion?: string;
}

// ============================================
// Knowledge Base payloads
// ============================================

export interface KBQueryPayload {
  query: string;
  filters?: Record<string, unknown>;
  limit?: number;
  includeEmbeddings?: boolean;
}

export interface KBResultPayload {
  queryId: string;
  results: Array<{
    id: string;
    content: string;
    score: number;
    metadata: Record<string, unknown>;
  }>;
  totalCount: number;
}

export interface KBUpdatePayload {
  id?: string;
  type: 'decision' | 'pattern' | 'learning' | 'code' | 'doc';
  content: string;
  metadata?: Record<string, unknown>;
  references?: string[];
}

// ============================================
// Discussion payloads
// ============================================

export interface DiscussionStartPayload {
  discussionId: string;
  topic: string;
  participants: string[];
  maxRounds: number;
  consensusThreshold: number;
  deadline?: number;
}

export interface DiscussionOpinionPayload {
  discussionId: string;
  round: number;
  opinion: string;
  stance?: 'support' | 'oppose' | 'neutral';
  confidence: number;
  references?: string[];
}

export interface DiscussionVotePayload {
  discussionId: string;
  option: string;
  weight: number;
  reasoning?: string;
}

export interface DiscussionConsensusPayload {
  discussionId: string;
  decision: string;
  votes: Record<string, string>;
  confidence: number;
  transcript: Array<{
    agent: string;
    round: number;
    opinion: string;
  }>;
}

// ============================================
// Code payloads
// ============================================

export interface CodeSubmitPayload {
  reviewId: string;
  files: Array<{
    path: string;
    content: string;
    language?: string;
  }>;
  description: string;
  type: 'feature' | 'bugfix' | 'refactor' | 'test';
}

export interface CodeReviewPayload {
  reviewId: string;
  status: 'approved' | 'changes_requested' | 'rejected';
  comments: Array<{
    file: string;
    line?: number;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    suggestion?: string;
  }>;
  overallScore: number;
}

// ============================================
// Human interaction payloads
// ============================================

export interface HumanInputPayload {
  inputId: string;
  channel: string;
  userId: string;
  message: string;
  attachments?: string[];
  replyTo?: string;
}

export interface HumanOutputPayload {
  inputId: string;
  message: string;
  attachments?: string[];
  format?: 'text' | 'markdown' | 'html';
}

export interface HumanEscalatePayload {
  reason: string;
  context: Record<string, unknown>;
  urgency: Priority;
  suggestedActions?: string[];
  deadline?: number;
}

// ============================================
// Security payloads
// ============================================

export interface SecurityAlertPayload {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  affectedResources?: string[];
  recommendation?: string;
}

export interface AuditLogPayload {
  action: string;
  agent: string;
  resource?: string;
  details?: Record<string, unknown>;
  result: 'success' | 'failure';
  timestamp: number;
}

// ============================================
// System payloads
// ============================================

export interface SystemStatusPayload {
  agents: Array<{
    id: string;
    role: AgentRole;
    status: 'idle' | 'busy' | 'error' | 'offline';
    currentTask?: string;
    metrics?: Record<string, number>;
  }>;
  knowledgeBase: {
    documents: number;
    lastUpdate: number;
  };
  uptime: number;
}

export interface SystemMetricsPayload {
  cpu: number;
  memory: number;
  tokensUsed: number;
  tasksCompleted: number;
  tasksActive: number;
  messagesPerSecond: number;
}

// ============================================
// Shorthand notation types
// ============================================

/**
 * Shorthand message format for human-readable logging
 * Format: @SENDER>RECIPIENT:TYPE:DATA:PARAMS
 * Example: @ARCH>CODER:TASK:impl_oauth:P1:ETA=2h
 */
export interface ShorthandMessage {
  sender: string;
  recipient: string;
  type: string;
  data: string;
  params: Record<string, string>;
}

/**
 * Dictionary for common terms compression
 */
export const COMPRESSION_DICTIONARY: Record<string, string> = {
  // Agents
  'ORCH': 'orchestrator',
  'ARCH': 'architect',
  'CODE': 'coder',
  'REV': 'reviewer',
  'TEST': 'tester',
  'SEC': 'security',
  'DOC': 'documentation',
  'RES': 'research',
  
  // Actions
  'TASK': 'task_assign',
  'DONE': 'task_complete',
  'FAIL': 'task_failed',
  'PROG': 'task_progress',
  'QUERY': 'kb_query',
  'UPD': 'kb_update',
  'DISC': 'discuss_start',
  'VOTE': 'discuss_vote',
  'CONS': 'discuss_consensus',
  
  // Priorities
  'P0': 'critical',
  'P1': 'urgent',
  'P2': 'high',
  'P3': 'normal',
  'P4': 'low',
  
  // Status
  'OK': 'success',
  'ERR': 'error',
  'WAIT': 'waiting',
  'RUN': 'running',
  
  // Common words
  'IMPL': 'implement',
  'REFA': 'refactor',
  'FIX': 'fix',
  'ADD': 'add',
  'DEL': 'delete',
  'MOD': 'modify',
  'REQ': 'request',
  'RESP': 'response',
  'AUTH': 'authentication',
  'API': 'api',
  'DB': 'database',
  'UI': 'user_interface',
  'SVC': 'service',
  'CFG': 'configuration',
};
