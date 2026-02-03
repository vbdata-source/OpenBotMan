/**
 * @openbotman/orchestrator
 * 
 * Multi-Agent Orchestrator - The brain of OpenBotMan.
 */

export * from './types.js';
export * from './orchestrator.js';
export * from './agent-runner.js';
export * from './discussion.js';
export * from './message-queue.js';
export * from './agent-communication.js';
export * from './enhanced-discussion.js';
export * from './auth/index.js';
export * from './providers/index.js';

// Re-export main classes
export { Orchestrator } from './orchestrator.js';
export { AgentRunner, type AgentExecutionResult } from './agent-runner.js';
export { DiscussionEngine, type DiscussionOptions, type DiscussionResult } from './discussion.js';
export { 
  MessageQueue, 
  MessagePriority, 
  MessageStatus,
  type AgentToAgentMessage,
  type MessageHandler,
  type MessageFilter,
} from './message-queue.js';
export { 
  AgentCommunication, 
  AgentMessageType,
  type Proposal,
  type Argument,
  type Vote,
  type RequestOptions,
} from './agent-communication.js';
export {
  EnhancedDiscussionEngine,
  DiscussionPhase,
  type EnhancedDiscussionRoom,
  type EnhancedDiscussionOptions,
  type DiscussionEntry,
} from './enhanced-discussion.js';
export {
  ClaudeAuthProvider,
  createAuthProvider,
  validateSetupToken,
  isSetupToken,
  normalizeProfileName,
  AuthError,
  SETUP_TOKEN_PREFIX,
  SETUP_TOKEN_MIN_LENGTH,
  type AuthMethod,
  type AuthCredential,
  type AuthProfileStore,
  type ClaudeAuthConfig,
  type AuthStatus,
  type AuthProfile,
} from './auth/index.js';

// Claude CLI Provider
export {
  ClaudeCliProvider,
  createClaudeCliProvider,
  claudeCliRequest,
  type ClaudeCliProviderOptions,
  type ClaudeCliResponse,
  type ClaudeCliMessage,
  type ClaudeCliContent,
  type ClaudeCliContentBlock,
  type ClaudeCliResult,
  type ClaudeCliProviderEvents,
} from './providers/index.js';
