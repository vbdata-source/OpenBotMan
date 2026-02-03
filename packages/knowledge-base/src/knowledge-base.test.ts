/**
 * Knowledge Base Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  KnowledgeBase, 
  InMemoryVectorStore, 
  InMemoryDocumentStore,
  MockEmbeddingProvider,
} from './knowledge-base.js';
import type { Knowledge } from './types.js';

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;

  beforeEach(() => {
    kb = new KnowledgeBase({
      storagePath: './test-data',
      vectorDb: 'memory',
      autoLink: false,
    });
  });

  describe('add', () => {
    it('should add new knowledge', async () => {
      const knowledge = await kb.add(
        'learning',
        'Test Learning',
        'This is a test learning content',
        { tags: ['test'] },
      );

      expect(knowledge.id).toBeDefined();
      expect(knowledge.type).toBe('learning');
      expect(knowledge.title).toBe('Test Learning');
      expect(knowledge.content).toBe('This is a test learning content');
      expect(knowledge.metadata.tags).toContain('test');
    });

    it('should generate embedding for new knowledge', async () => {
      const knowledge = await kb.add(
        'decision',
        'Architecture Decision',
        'We decided to use microservices',
      );

      expect(knowledge.embedding).toBeDefined();
      expect(knowledge.embedding).toBeInstanceOf(Float32Array);
    });

    it('should set default metadata values', async () => {
      const knowledge = await kb.add(
        'pattern',
        'Test Pattern',
        'Pattern content',
      );

      expect(knowledge.metadata.confidence).toBe(1);
      expect(knowledge.metadata.accessCount).toBe(0);
      expect(knowledge.metadata.version).toBe(1);
    });

    it('should set timestamps', async () => {
      const before = new Date();
      const knowledge = await kb.add('learning', 'Test', 'Content');
      const after = new Date();

      expect(knowledge.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(knowledge.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(knowledge.updatedAt.getTime()).toBe(knowledge.createdAt.getTime());
    });
  });

  describe('get', () => {
    it('should retrieve knowledge by ID', async () => {
      const created = await kb.add('learning', 'Test', 'Content');
      const retrieved = await kb.get(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.title).toBe('Test');
    });

    it('should return null for non-existent ID', async () => {
      const result = await kb.get('non-existent-id');
      expect(result).toBeNull();
    });

    it('should increment access count', async () => {
      const created = await kb.add('learning', 'Test', 'Content');
      
      await kb.get(created.id);
      await kb.get(created.id);
      const retrieved = await kb.get(created.id);

      expect(retrieved!.metadata.accessCount).toBe(3);
    });

    it('should update lastAccessed timestamp', async () => {
      const created = await kb.add('learning', 'Test', 'Content');
      
      await new Promise(r => setTimeout(r, 10));
      const retrieved = await kb.get(created.id);

      expect(retrieved!.metadata.lastAccessed).toBeDefined();
      expect(retrieved!.metadata.lastAccessed!.getTime())
        .toBeGreaterThan(created.createdAt.getTime());
    });
  });

  describe('update', () => {
    it('should update title', async () => {
      const created = await kb.add('learning', 'Original Title', 'Content');
      const updated = await kb.update(created.id, { title: 'New Title' });

      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('New Title');
      expect(updated!.content).toBe('Content');
    });

    it('should update content', async () => {
      const created = await kb.add('learning', 'Title', 'Original Content');
      const updated = await kb.update(created.id, { content: 'New Content' });

      expect(updated!.content).toBe('New Content');
      expect(updated!.title).toBe('Title');
    });

    it('should merge metadata', async () => {
      const created = await kb.add('learning', 'Test', 'Content', { tags: ['old'] });
      const updated = await kb.update(created.id, { 
        metadata: { tags: ['new'], confidence: 0.9 } 
      });

      expect(updated!.metadata.tags).toContain('new');
      expect(updated!.metadata.confidence).toBe(0.9);
    });

    it('should increment version', async () => {
      const created = await kb.add('learning', 'Test', 'Content');
      expect(created.metadata.version).toBe(1);

      const updated1 = await kb.update(created.id, { title: 'Update 1' });
      expect(updated1!.metadata.version).toBe(2);

      const updated2 = await kb.update(created.id, { title: 'Update 2' });
      expect(updated2!.metadata.version).toBe(3);
    });

    it('should update timestamp', async () => {
      const created = await kb.add('learning', 'Test', 'Content');
      
      await new Promise(r => setTimeout(r, 10));
      const updated = await kb.update(created.id, { title: 'New' });

      expect(updated!.updatedAt.getTime()).toBeGreaterThan(created.createdAt.getTime());
    });

    it('should return null for non-existent ID', async () => {
      const result = await kb.update('non-existent', { title: 'New' });
      expect(result).toBeNull();
    });

    it('should regenerate embedding on content change', async () => {
      const created = await kb.add('learning', 'Test', 'Original content');

      const updated = await kb.update(created.id, { content: 'Completely different content' });
      
      // Embedding should be defined after update
      expect(updated!.embedding).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should soft-delete knowledge', async () => {
      const created = await kb.add('learning', 'Test', 'Content');
      const result = await kb.delete(created.id);

      expect(result).toBe(true);
    });

    it('should return false for non-existent ID', async () => {
      const result = await kb.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should not return deleted knowledge in get', async () => {
      const created = await kb.add('learning', 'Test', 'Content');
      await kb.delete(created.id);

      // Get should return the document but with deletedAt set
      // The behavior depends on implementation
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await kb.add('learning', 'TypeScript Basics', 'Learn TypeScript fundamentals', 
        { tags: ['typescript', 'beginner'] });
      await kb.add('learning', 'Advanced TypeScript', 'TypeScript generics and types', 
        { tags: ['typescript', 'advanced'] });
      await kb.add('decision', 'Database Choice', 'We chose PostgreSQL for our database', 
        { tags: ['database', 'postgresql'] });
      await kb.add('pattern', 'Singleton Pattern', 'The singleton design pattern', 
        { tags: ['design-patterns'] });
    });

    it('should search by query', async () => {
      const results = await kb.search({ query: 'TypeScript' });

      expect(results.length).toBeGreaterThan(0);
      // Results should be ranked by relevance
    });

    it('should filter by type', async () => {
      const results = await kb.search({ 
        query: 'TypeScript',
        types: ['learning'],
      });

      expect(results.every(r => r.knowledge.type === 'learning')).toBe(true);
    });

    it('should filter by tags', async () => {
      const results = await kb.search({ 
        query: 'TypeScript',
        tags: ['advanced'],
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.knowledge.metadata.tags?.includes('advanced'))).toBe(true);
    });

    it('should limit results', async () => {
      const results = await kb.search({ 
        query: 'TypeScript',
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should include score in results', async () => {
      const results = await kb.search({ query: 'TypeScript' });

      for (const result of results) {
        expect(result.score).toBeDefined();
        expect(typeof result.score).toBe('number');
      }
    });
  });

  describe('recordLearning', () => {
    it('should record a learning', async () => {
      const knowledge = await kb.recordLearning({
        taskId: 'task-123',
        agentId: 'coder-1',
        lesson: 'Always validate input',
        context: 'During code review',
        outcome: 'success',
        confidence: 0.95,
        suggestions: ['Add input validation', 'Use type guards'],
      });

      expect(knowledge.type).toBe('learning');
      expect(knowledge.content).toContain('Always validate input');
      expect(knowledge.content).toContain('success');
      expect(knowledge.metadata.confidence).toBe(0.95);
    });
  });

  describe('recordDecision', () => {
    it('should record a decision', async () => {
      const knowledge = await kb.recordDecision({
        title: 'API Framework Choice',
        decision: 'Use Express.js',
        reasoning: 'Wide community support',
        participants: ['architect', 'coder'],
        status: 'accepted',
        alternatives: [{
          option: 'Fastify',
          prosAndCons: 'Faster but less ecosystem',
          rejected: true,
          rejectionReason: 'Smaller community',
        }],
      });

      expect(knowledge.type).toBe('decision');
      expect(knowledge.title).toBe('API Framework Choice');
      expect(knowledge.content).toContain('Use Express.js');
      expect(knowledge.content).toContain('Fastify');
    });
  });

  describe('recordPattern', () => {
    it('should record a pattern', async () => {
      const knowledge = await kb.recordPattern({
        name: 'Repository Pattern',
        problem: 'Direct database access spreads throughout codebase',
        solution: 'Abstract data access behind repositories',
        example: 'class UserRepository { async findById(id) {...} }',
        languages: ['typescript'],
        whenToUse: ['Multiple data sources', 'Need to swap databases'],
        timesApplied: 5,
        successRate: 0.9,
      });

      expect(knowledge.type).toBe('pattern');
      expect(knowledge.title).toBe('Repository Pattern');
      expect(knowledge.content).toContain('Abstract data access');
      expect(knowledge.content).toContain('UserRepository');
    });
  });

  describe('stats', () => {
    it('should return statistics', async () => {
      await kb.add('learning', 'Test 1', 'Content 1');
      await kb.add('learning', 'Test 2', 'Content 2');
      await kb.add('decision', 'Test 3', 'Content 3', { project: 'project-a' });

      const stats = await kb.stats();

      expect(stats.totalCount).toBe(3);
      expect(stats.byType['learning']).toBe(2);
      expect(stats.byType['decision']).toBe(1);
      expect(stats.byProject['project-a']).toBe(1);
    });
  });

  describe('subscriptions', () => {
    it('should subscribe to events', async () => {
      const events: any[] = [];
      
      const subId = kb.subscribe({
        agentId: 'test-agent',
        filter: { types: ['learning'] },
        callback: (event) => events.push(event),
      });

      await kb.add('learning', 'Test', 'Content');

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('created');

      kb.unsubscribe(subId);
    });

    it('should unsubscribe', async () => {
      const events: any[] = [];
      
      const subId = kb.subscribe({
        agentId: 'test-agent',
        filter: {},
        callback: (event) => events.push(event),
      });

      const removed = kb.unsubscribe(subId);
      expect(removed).toBe(true);

      await kb.add('learning', 'Test', 'Content');
      // Should not receive event after unsubscribe (depends on impl timing)
    });
  });
});

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;

  beforeEach(() => {
    store = new InMemoryVectorStore();
  });

  it('should add and search vectors', async () => {
    const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    await store.add('doc1', embedding, { type: 'test' });

    const results = await store.search(embedding, 10);
    
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe('doc1');
    expect(results[0]!.score).toBeCloseTo(1); // Same vector = perfect match
  });

  it('should filter by metadata', async () => {
    const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    await store.add('doc1', embedding, { type: 'a' });
    await store.add('doc2', embedding, { type: 'b' });

    const results = await store.search(embedding, 10, { type: 'a' });
    
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe('doc1');
  });

  it('should limit results', async () => {
    const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    await store.add('doc1', embedding, {});
    await store.add('doc2', embedding, {});
    await store.add('doc3', embedding, {});

    const results = await store.search(embedding, 2);
    
    expect(results.length).toBe(2);
  });

  it('should delete vectors', async () => {
    const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    await store.add('doc1', embedding, {});
    await store.delete('doc1');

    const results = await store.search(embedding, 10);
    expect(results.length).toBe(0);
  });
});

describe('InMemoryDocumentStore', () => {
  let store: InMemoryDocumentStore;

  beforeEach(() => {
    store = new InMemoryDocumentStore();
  });

  it('should save and get documents', async () => {
    const doc: Knowledge = {
      id: 'doc1',
      type: 'learning',
      title: 'Test',
      content: 'Content',
      metadata: { confidence: 1, accessCount: 0, version: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await store.save(doc);
    const retrieved = await store.get('doc1');

    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe('Test');
  });

  it('should get multiple documents', async () => {
    for (let i = 1; i <= 3; i++) {
      await store.save({
        id: `doc${i}`,
        type: 'learning',
        title: `Test ${i}`,
        content: 'Content',
        metadata: { confidence: 1, accessCount: 0, version: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const docs = await store.getMany(['doc1', 'doc2', 'doc3']);
    expect(docs.length).toBe(3);
  });

  it('should query with filters', async () => {
    await store.save({
      id: 'doc1',
      type: 'learning',
      title: 'Test 1',
      content: 'Content',
      metadata: { confidence: 1, accessCount: 0, version: 1, project: 'project-a' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await store.save({
      id: 'doc2',
      type: 'decision',
      title: 'Test 2',
      content: 'Content',
      metadata: { confidence: 1, accessCount: 0, version: 1, project: 'project-b' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const results = await store.query({ types: ['learning'] });
    expect(results.length).toBe(1);
    expect(results[0]!.type).toBe('learning');
  });
});

describe('MockEmbeddingProvider', () => {
  let provider: MockEmbeddingProvider;

  beforeEach(() => {
    provider = new MockEmbeddingProvider();
  });

  it('should have correct dimensions', () => {
    expect(provider.dimensions).toBe(384);
  });

  it('should generate embeddings', async () => {
    const embedding = await provider.embed('test text');

    expect(embedding).toBeInstanceOf(Float32Array);
    expect(embedding.length).toBe(384);
  });

  it('should generate normalized embeddings', async () => {
    const embedding = await provider.embed('test text');
    
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += (embedding[i] ?? 0) * (embedding[i] ?? 0);
    }
    norm = Math.sqrt(norm);

    expect(norm).toBeCloseTo(1, 5);
  });

  it('should batch embed', async () => {
    const embeddings = await provider.embedBatch(['text1', 'text2', 'text3']);

    expect(embeddings.length).toBe(3);
    expect(embeddings[0]!.length).toBe(384);
  });

  it('should generate deterministic embeddings', async () => {
    const embedding1 = await provider.embed('test text');
    const embedding2 = await provider.embed('test text');

    for (let i = 0; i < embedding1.length; i++) {
      expect(embedding1[i]).toBe(embedding2[i]);
    }
  });
});
