/**
 * Knowledge Base Implementation
 * 
 * Central knowledge store for all agents.
 * Combines vector search with traditional document storage.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
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

/**
 * Abstract embedding provider
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
  dimensions: number;
}

/**
 * Abstract vector store
 */
export interface VectorStore {
  add(id: string, embedding: Float32Array, metadata: Record<string, unknown>): Promise<void>;
  search(embedding: Float32Array, limit: number, filter?: Record<string, unknown>): Promise<Array<{ id: string; score: number }>>;
  delete(id: string): Promise<void>;
  update(id: string, embedding: Float32Array, metadata: Record<string, unknown>): Promise<void>;
}

/**
 * Abstract document store
 */
export interface DocumentStore {
  get(id: string): Promise<Knowledge | null>;
  getMany(ids: string[]): Promise<Knowledge[]>;
  save(knowledge: Knowledge): Promise<void>;
  delete(id: string): Promise<void>;
  query(options: SearchOptions): Promise<Knowledge[]>;
  stats(): Promise<KnowledgeStats>;
}

/**
 * In-memory vector store for development
 */
export class InMemoryVectorStore implements VectorStore {
  private vectors: Map<string, { embedding: Float32Array; metadata: Record<string, unknown> }> = new Map();
  
  async add(id: string, embedding: Float32Array, metadata: Record<string, unknown>): Promise<void> {
    this.vectors.set(id, { embedding, metadata });
  }
  
  async search(embedding: Float32Array, limit: number, filter?: Record<string, unknown>): Promise<Array<{ id: string; score: number }>> {
    const results: Array<{ id: string; score: number }> = [];
    
    for (const [id, data] of this.vectors) {
      // Apply filter
      if (filter) {
        let matches = true;
        for (const [key, value] of Object.entries(filter)) {
          if (data.metadata[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }
      
      // Cosine similarity
      const score = this.cosineSimilarity(embedding, data.embedding);
      results.push({ id, score });
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, limit);
  }
  
  async delete(id: string): Promise<void> {
    this.vectors.delete(id);
  }
  
  async update(id: string, embedding: Float32Array, metadata: Record<string, unknown>): Promise<void> {
    this.vectors.set(id, { embedding, metadata });
  }
  
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

/**
 * In-memory document store for development
 */
export class InMemoryDocumentStore implements DocumentStore {
  private documents: Map<string, Knowledge> = new Map();
  
  async get(id: string): Promise<Knowledge | null> {
    return this.documents.get(id) ?? null;
  }
  
  async getMany(ids: string[]): Promise<Knowledge[]> {
    return ids
      .map(id => this.documents.get(id))
      .filter((doc): doc is Knowledge => doc !== undefined);
  }
  
  async save(knowledge: Knowledge): Promise<void> {
    this.documents.set(knowledge.id, knowledge);
  }
  
  async delete(id: string): Promise<void> {
    const doc = this.documents.get(id);
    if (doc) {
      doc.deletedAt = new Date();
    }
  }
  
  async query(options: SearchOptions): Promise<Knowledge[]> {
    let results = Array.from(this.documents.values());
    
    // Filter deleted
    if (!options.includeDeleted) {
      results = results.filter(k => !k.deletedAt);
    }
    
    // Filter by type
    if (options.types?.length) {
      results = results.filter(k => options.types!.includes(k.type));
    }
    
    // Filter by project
    if (options.project) {
      results = results.filter(k => k.metadata.project === options.project);
    }
    
    // Filter by agent
    if (options.agent) {
      results = results.filter(k => k.metadata.agent === options.agent);
    }
    
    // Filter by tags
    if (options.tags?.length) {
      results = results.filter(k => 
        k.metadata.tags?.some(t => options.tags!.includes(t))
      );
    }
    
    // Filter by confidence
    if (options.minConfidence !== undefined) {
      results = results.filter(k => 
        (k.metadata.confidence ?? 1) >= options.minConfidence!
      );
    }
    
    // Filter by date
    if (options.after) {
      results = results.filter(k => k.createdAt >= options.after!);
    }
    if (options.before) {
      results = results.filter(k => k.createdAt <= options.before!);
    }
    
    // Sort
    switch (options.sortBy) {
      case 'date':
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'confidence':
        results.sort((a, b) => 
          (b.metadata.confidence ?? 0) - (a.metadata.confidence ?? 0)
        );
        break;
      case 'accessCount':
        results.sort((a, b) => 
          (b.metadata.accessCount ?? 0) - (a.metadata.accessCount ?? 0)
        );
        break;
      // 'relevance' would need embeddings
    }
    
    if (options.sortDirection === 'asc') {
      results.reverse();
    }
    
    // Pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    
    return results.slice(offset, offset + limit);
  }
  
  async stats(): Promise<KnowledgeStats> {
    const docs = Array.from(this.documents.values()).filter(k => !k.deletedAt);
    
    const byType: Record<string, number> = {};
    const byProject: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    let recentlyAdded = 0;
    let recentlyAccessed = 0;
    
    for (const doc of docs) {
      // By type
      byType[doc.type] = (byType[doc.type] ?? 0) + 1;
      
      // By project
      if (doc.metadata.project) {
        byProject[doc.metadata.project] = (byProject[doc.metadata.project] ?? 0) + 1;
      }
      
      // By agent
      if (doc.metadata.agent) {
        byAgent[doc.metadata.agent] = (byAgent[doc.metadata.agent] ?? 0) + 1;
      }
      
      // Confidence
      if (doc.metadata.confidence !== undefined) {
        totalConfidence += doc.metadata.confidence;
        confidenceCount++;
      }
      
      // Recent
      if (doc.createdAt.getTime() > dayAgo) {
        recentlyAdded++;
      }
      if (doc.metadata.lastAccessed && doc.metadata.lastAccessed.getTime() > dayAgo) {
        recentlyAccessed++;
      }
    }
    
    return {
      totalCount: docs.length,
      byType: byType as Record<KnowledgeType, number>,
      byProject,
      byAgent,
      recentlyAdded,
      recentlyAccessed,
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    };
  }
}

/**
 * Simple embedding provider using random vectors (for testing)
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 384;
  
  async embed(text: string): Promise<Float32Array> {
    // Generate deterministic "embedding" based on text hash
    const hash = this.hashString(text);
    const embedding = new Float32Array(this.dimensions);
    
    for (let i = 0; i < this.dimensions; i++) {
      embedding[i] = Math.sin(hash * (i + 1)) * 0.5;
    }
    
    return this.normalize(embedding);
  }
  
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
  
  private normalize(v: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < v.length; i++) {
      norm += v[i] * v[i];
    }
    norm = Math.sqrt(norm);
    for (let i = 0; i < v.length; i++) {
      v[i] /= norm;
    }
    return v;
  }
}

/**
 * Main Knowledge Base class
 */
export class KnowledgeBase {
  private vectorStore: VectorStore;
  private documentStore: DocumentStore;
  private embeddingProvider: EmbeddingProvider;
  private subscriptions: Map<string, KnowledgeSubscription> = new Map();
  private config: KnowledgeBaseConfig;
  
  constructor(
    config: KnowledgeBaseConfig,
    vectorStore?: VectorStore,
    documentStore?: DocumentStore,
    embeddingProvider?: EmbeddingProvider
  ) {
    this.config = config;
    this.vectorStore = vectorStore ?? new InMemoryVectorStore();
    this.documentStore = documentStore ?? new InMemoryDocumentStore();
    this.embeddingProvider = embeddingProvider ?? new MockEmbeddingProvider();
  }
  
  /**
   * Add new knowledge
   */
  async add(
    type: KnowledgeType,
    title: string,
    content: string,
    metadata?: Partial<KnowledgeMetadata>
  ): Promise<Knowledge> {
    const id = uuidv4();
    const now = new Date();
    
    // Generate embedding
    const embedding = await this.embeddingProvider.embed(`${title}\n\n${content}`);
    
    const knowledge: Knowledge = {
      id,
      type,
      title,
      content,
      embedding,
      metadata: {
        confidence: 1,
        accessCount: 0,
        version: 1,
        ...metadata,
      },
      createdAt: now,
      updatedAt: now,
    };
    
    // Store
    await this.documentStore.save(knowledge);
    await this.vectorStore.add(id, embedding, {
      type,
      project: metadata?.project,
      agent: metadata?.agent,
      tags: metadata?.tags,
    });
    
    // Emit event
    await this.emitEvent({
      type: 'created',
      knowledgeId: id,
      agentId: metadata?.agent,
      timestamp: now,
    });
    
    // Auto-link if enabled
    if (this.config.autoLink) {
      await this.autoLink(knowledge);
    }
    
    return knowledge;
  }
  
  /**
   * Get knowledge by ID
   */
  async get(id: string): Promise<Knowledge | null> {
    const knowledge = await this.documentStore.get(id);
    
    if (knowledge && !knowledge.deletedAt) {
      // Update access stats
      knowledge.metadata.accessCount = (knowledge.metadata.accessCount ?? 0) + 1;
      knowledge.metadata.lastAccessed = new Date();
      await this.documentStore.save(knowledge);
      
      await this.emitEvent({
        type: 'accessed',
        knowledgeId: id,
        timestamp: new Date(),
      });
    }
    
    return knowledge;
  }
  
  /**
   * Update knowledge
   */
  async update(
    id: string,
    updates: Partial<Pick<Knowledge, 'title' | 'content' | 'metadata'>>
  ): Promise<Knowledge | null> {
    const existing = await this.documentStore.get(id);
    if (!existing || existing.deletedAt) return null;
    
    const now = new Date();
    
    // Merge updates
    const updated: Knowledge = {
      ...existing,
      title: updates.title ?? existing.title,
      content: updates.content ?? existing.content,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        version: (existing.metadata.version ?? 0) + 1,
      },
      updatedAt: now,
    };
    
    // Re-generate embedding if content changed
    if (updates.title || updates.content) {
      updated.embedding = await this.embeddingProvider.embed(
        `${updated.title}\n\n${updated.content}`
      );
      
      await this.vectorStore.update(id, updated.embedding, {
        type: updated.type,
        project: updated.metadata.project,
        agent: updated.metadata.agent,
        tags: updated.metadata.tags,
      });
    }
    
    await this.documentStore.save(updated);
    
    await this.emitEvent({
      type: 'updated',
      knowledgeId: id,
      timestamp: now,
      changes: updates,
    });
    
    return updated;
  }
  
  /**
   * Delete knowledge (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.documentStore.get(id);
    if (!existing) return false;
    
    await this.documentStore.delete(id);
    await this.vectorStore.delete(id);
    
    await this.emitEvent({
      type: 'deleted',
      knowledgeId: id,
      timestamp: new Date(),
    });
    
    return true;
  }
  
  /**
   * Search knowledge
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    let results: SearchResult[] = [];
    
    // Semantic search if query provided
    if (options.query) {
      const queryEmbedding = await this.embeddingProvider.embed(options.query);
      
      const vectorFilter: Record<string, unknown> = {};
      if (options.types?.length === 1) {
        vectorFilter['type'] = options.types[0];
      }
      if (options.project) {
        vectorFilter['project'] = options.project;
      }
      
      const vectorResults = await this.vectorStore.search(
        queryEmbedding,
        options.limit ?? 100,
        Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined
      );
      
      // Fetch documents
      const ids = vectorResults.map(r => r.id);
      const docs = await this.documentStore.getMany(ids);
      
      const docMap = new Map(docs.map(d => [d.id, d]));
      
      for (const vr of vectorResults) {
        const doc = docMap.get(vr.id);
        if (doc && !doc.deletedAt) {
          // Apply additional filters
          if (options.types?.length && !options.types.includes(doc.type)) continue;
          if (options.agent && doc.metadata.agent !== options.agent) continue;
          if (options.tags?.length && !doc.metadata.tags?.some(t => options.tags!.includes(t))) continue;
          if (options.minConfidence !== undefined && (doc.metadata.confidence ?? 1) < options.minConfidence) continue;
          
          results.push({
            knowledge: doc,
            score: vr.score,
          });
        }
      }
    } else {
      // Non-semantic query
      const docs = await this.documentStore.query(options);
      results = docs.map(k => ({
        knowledge: k,
        score: 1,
      }));
    }
    
    return results;
  }
  
  /**
   * Record a learning from a task
   */
  async recordLearning(learning: Omit<Learning, 'id' | 'createdAt'>): Promise<Knowledge> {
    const content = `
## Lesson
${learning.lesson}

## Context
${learning.context}

## Outcome
${learning.outcome}

${learning.suggestions?.length ? `## Suggestions\n${learning.suggestions.map(s => `- ${s}`).join('\n')}` : ''}

${learning.applicability?.length ? `## When to Apply\n${learning.applicability.map(a => `- ${a}`).join('\n')}` : ''}
    `.trim();
    
    return this.add('learning', `Learning: ${learning.lesson.slice(0, 50)}...`, content, {
      agent: learning.agentId,
      confidence: learning.confidence,
      custom: {
        taskId: learning.taskId,
        outcome: learning.outcome,
      },
    });
  }
  
  /**
   * Record a decision
   */
  async recordDecision(decision: Omit<Decision, 'id' | 'createdAt' | 'updatedAt'>): Promise<Knowledge> {
    let content = `
## Decision
${decision.decision}

## Reasoning
${decision.reasoning}
    `.trim();
    
    if (decision.alternatives?.length) {
      content += '\n\n## Alternatives Considered\n';
      for (const alt of decision.alternatives) {
        content += `\n### ${alt.option}\n`;
        content += alt.prosAndCons + '\n';
        if (alt.rejected && alt.rejectionReason) {
          content += `*Rejected: ${alt.rejectionReason}*\n`;
        }
      }
    }
    
    if (decision.consequences?.length) {
      content += '\n\n## Consequences\n';
      content += decision.consequences.map(c => `- ${c}`).join('\n');
    }
    
    if (decision.votes) {
      content += '\n\n## Votes\n';
      for (const [agent, vote] of Object.entries(decision.votes)) {
        content += `- ${agent}: ${vote}\n`;
      }
    }
    
    return this.add('decision', decision.title, content, {
      project: decision.project,
      tags: decision.participants,
      custom: {
        status: decision.status,
        participants: decision.participants,
      },
    });
  }
  
  /**
   * Record a code pattern
   */
  async recordPattern(pattern: Omit<Pattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<Knowledge> {
    let content = `
## Problem
${pattern.problem}

## Solution
${pattern.solution}

${pattern.example ? `## Example\n\`\`\`\n${pattern.example}\n\`\`\`` : ''}

## When to Use
${pattern.whenToUse.map(w => `- ${w}`).join('\n')}

${pattern.whenNotToUse?.length ? `## When NOT to Use\n${pattern.whenNotToUse.map(w => `- ${w}`).join('\n')}` : ''}
    `.trim();
    
    return this.add('pattern', pattern.name, content, {
      tags: pattern.languages,
      custom: {
        timesApplied: pattern.timesApplied,
        successRate: pattern.successRate,
        relatedPatterns: pattern.relatedPatterns,
      },
    });
  }
  
  /**
   * Subscribe to knowledge events
   */
  subscribe(subscription: Omit<KnowledgeSubscription, 'id' | 'createdAt'>): string {
    const id = uuidv4();
    this.subscriptions.set(id, {
      ...subscription,
      id,
      createdAt: new Date(),
    });
    return id;
  }
  
  /**
   * Unsubscribe from knowledge events
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }
  
  /**
   * Get statistics
   */
  async stats(): Promise<KnowledgeStats> {
    return this.documentStore.stats();
  }
  
  /**
   * Auto-link related knowledge
   */
  private async autoLink(knowledge: Knowledge): Promise<void> {
    if (!knowledge.embedding) return;
    
    // Find similar knowledge
    const similar = await this.vectorStore.search(knowledge.embedding, 5);
    
    const references: string[] = [];
    for (const s of similar) {
      if (s.id !== knowledge.id && s.score > 0.8) {
        references.push(s.id);
      }
    }
    
    if (references.length > 0) {
      knowledge.metadata.references = [
        ...(knowledge.metadata.references ?? []),
        ...references,
      ];
      await this.documentStore.save(knowledge);
    }
  }
  
  /**
   * Emit event to subscribers
   */
  private async emitEvent(event: KnowledgeEvent): Promise<void> {
    for (const sub of this.subscriptions.values()) {
      // Check filter
      if (sub.filter.types?.length) {
        const knowledge = await this.documentStore.get(event.knowledgeId);
        if (!knowledge || !sub.filter.types.includes(knowledge.type)) continue;
      }
      
      // Emit
      if (typeof sub.callback === 'function') {
        sub.callback(event);
      }
      // URL callbacks would be handled differently (HTTP POST)
    }
  }
}
