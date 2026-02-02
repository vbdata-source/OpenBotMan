/**
 * @openbotman/knowledge-base
 * 
 * Shared Knowledge Base for multi-agent collaboration.
 * Combines vector search with document storage.
 */

export * from './types.js';
export * from './knowledge-base.js';

// Re-export commonly used items
export {
  KnowledgeBase,
  InMemoryVectorStore,
  InMemoryDocumentStore,
  MockEmbeddingProvider,
} from './knowledge-base.js';

export type {
  Knowledge,
  KnowledgeType,
  KnowledgeMetadata,
  SearchOptions,
  SearchResult,
  KnowledgeStats,
  Learning,
  Decision,
  Pattern,
  KnowledgeBaseConfig,
  KnowledgeEvent,
  KnowledgeSubscription,
} from './types.js';
