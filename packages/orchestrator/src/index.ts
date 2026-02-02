/**
 * @openbotman/orchestrator
 * 
 * Multi-Agent Orchestrator - The brain of OpenBotMan.
 */

export * from './types.js';
export * from './orchestrator.js';
export * from './agent-runner.js';
export * from './discussion.js';

// Re-export main classes
export { Orchestrator } from './orchestrator.js';
export { AgentRunner, type AgentExecutionResult } from './agent-runner.js';
export { DiscussionEngine, type DiscussionOptions, type DiscussionResult } from './discussion.js';
