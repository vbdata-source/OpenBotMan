/**
 * Knowledge Base Types
 * 
 * Defines the structure for storing and retrieving knowledge
 * across all agents in the system.
 */

/**
 * Types of knowledge that can be stored
 */
export type KnowledgeType = 
  | 'decision'      // Architecture/design decisions
  | 'pattern'       // Code patterns and best practices
  | 'learning'      // Lessons learned from tasks
  | 'code'          // Code snippets and examples
  | 'doc'           // Documentation
  | 'conversation'  // Important conversation excerpts
  | 'error'         // Error patterns and solutions
  | 'metric'        // Performance metrics and benchmarks
  | 'config'        // Configuration patterns
  | 'security';     // Security-related knowledge

/**
 * Knowledge entry
 */
export interface Knowledge {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  
  /** Optional embedding vector */
  embedding?: Float32Array;
  
  /** Metadata */
  metadata: KnowledgeMetadata;
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
  
  /** Soft delete */
  deletedAt?: Date;
}

/**
 * Knowledge metadata
 */
export interface KnowledgeMetadata {
  /** Project this knowledge belongs to */
  project?: string;
  
  /** Agent that created this */
  agent?: string;
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Confidence score (0-1) */
  confidence?: number;
  
  /** References to other knowledge IDs */
  references?: string[];
  
  /** Source (file, URL, conversation) */
  source?: string;
  
  /** Language (for code) */
  language?: string;
  
  /** Version */
  version?: number;
  
  /** Access count */
  accessCount?: number;
  
  /** Last accessed */
  lastAccessed?: Date;
  
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Search query options
 */
export interface SearchOptions {
  /** Query string for semantic search */
  query?: string;
  
  /** Filter by type */
  types?: KnowledgeType[];
  
  /** Filter by project */
  project?: string;
  
  /** Filter by agent */
  agent?: string;
  
  /** Filter by tags */
  tags?: string[];
  
  /** Minimum confidence */
  minConfidence?: number;
  
  /** Date range */
  after?: Date;
  before?: Date;
  
  /** Maximum results */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
  
  /** Include deleted */
  includeDeleted?: boolean;
  
  /** Sort by */
  sortBy?: 'relevance' | 'date' | 'confidence' | 'accessCount';
  
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Search result
 */
export interface SearchResult {
  knowledge: Knowledge;
  score: number;
  highlights?: string[];
}

/**
 * Knowledge statistics
 */
export interface KnowledgeStats {
  totalCount: number;
  byType: Record<KnowledgeType, number>;
  byProject: Record<string, number>;
  byAgent: Record<string, number>;
  recentlyAdded: number;
  recentlyAccessed: number;
  averageConfidence: number;
}

/**
 * Learning entry - automatically extracted from tasks
 */
export interface Learning {
  id: string;
  taskId: string;
  agentId: string;
  
  /** What was learned */
  lesson: string;
  
  /** Context/situation */
  context: string;
  
  /** Outcome (success/failure) */
  outcome: 'success' | 'failure' | 'partial';
  
  /** Improvement suggestions */
  suggestions?: string[];
  
  /** Confidence */
  confidence: number;
  
  /** Applicability (when to apply this learning) */
  applicability?: string[];
  
  createdAt: Date;
}

/**
 * Decision record
 */
export interface Decision {
  id: string;
  title: string;
  
  /** What was decided */
  decision: string;
  
  /** Why it was decided */
  reasoning: string;
  
  /** Alternatives considered */
  alternatives?: Array<{
    option: string;
    prosAndCons: string;
    rejected: boolean;
    rejectionReason?: string;
  }>;
  
  /** Consequences */
  consequences?: string[];
  
  /** Participants */
  participants: string[];
  
  /** Vote results if applicable */
  votes?: Record<string, string>;
  
  /** Status */
  status: 'proposed' | 'accepted' | 'rejected' | 'superseded';
  
  /** Superseded by */
  supersededBy?: string;
  
  /** Project */
  project?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pattern record
 */
export interface Pattern {
  id: string;
  name: string;
  
  /** Problem this pattern solves */
  problem: string;
  
  /** Solution description */
  solution: string;
  
  /** Code example */
  example?: string;
  
  /** When to use */
  whenToUse: string[];
  
  /** When not to use */
  whenNotToUse?: string[];
  
  /** Related patterns */
  relatedPatterns?: string[];
  
  /** Times applied */
  timesApplied: number;
  
  /** Success rate */
  successRate: number;
  
  /** Languages applicable */
  languages?: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Knowledge Base configuration
 */
export interface KnowledgeBaseConfig {
  /** Storage path */
  storagePath: string;
  
  /** Vector database type */
  vectorDb: 'chromadb' | 'qdrant' | 'memory';
  
  /** Embedding model */
  embeddingModel?: string;
  
  /** Max results per query */
  maxResults?: number;
  
  /** Auto-learn from tasks */
  autoLearn?: boolean;
  
  /** Auto-link related knowledge */
  autoLink?: boolean;
  
  /** Retention policy (days) */
  retentionDays?: number;
}

/**
 * Knowledge change event
 */
export interface KnowledgeEvent {
  type: 'created' | 'updated' | 'deleted' | 'accessed';
  knowledgeId: string;
  agentId?: string;
  timestamp: Date;
  changes?: Partial<Knowledge>;
}

/**
 * Knowledge subscription
 */
export interface KnowledgeSubscription {
  id: string;
  agentId: string;
  
  /** Filter for events */
  filter: {
    types?: KnowledgeType[];
    projects?: string[];
    tags?: string[];
  };
  
  /** Callback URL or function */
  callback: string | ((event: KnowledgeEvent) => void);
  
  createdAt: Date;
}
