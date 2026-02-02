/**
 * @openbotman/protocol
 * 
 * AICP - Agent Inter-Communication Protocol
 * A compact, efficient protocol for multi-agent communication.
 */

export * from './types.js';
export * from './encoder.js';

// Re-export commonly used items at top level
export {
  MessageType,
  Priority,
  AgentRole,
  LLMProvider,
  MessageFlags,
  COMPRESSION_DICTIONARY,
} from './types.js';

export {
  AICPEncoder,
  ShorthandParser,
  MessageCompressor,
  PROTOCOL_VERSION,
  HEADER_SIZE,
  BROADCAST_RECIPIENT,
} from './encoder.js';
