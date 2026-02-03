/**
 * Discussion Engine Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscussionEngine, type DiscussionOptions } from './discussion.js';
import { AgentRunner } from './agent-runner.js';
import { AgentRole } from '@openbotman/protocol';

// Mock the AgentRunner
vi.mock('./agent-runner.js', () => ({
  AgentRunner: vi.fn().mockImplementation(() => ({
    getAgent: vi.fn().mockReturnValue({
      definition: { id: 'mock-agent', role: AgentRole.ARCHITECT },
      status: 'idle',
    }),
    execute: vi.fn().mockResolvedValue({
      success: true,
      response: 'STANCE: support\nCONFIDENCE: 85%\nOPINION: I agree with this approach.',
      duration: 100,
    }),
  })),
}));

describe('DiscussionEngine', () => {
  let engine: DiscussionEngine;
  let mockRunner: AgentRunner;

  beforeEach(() => {
    mockRunner = new AgentRunner();
    engine = new DiscussionEngine(mockRunner);
  });

  describe('startDiscussion', () => {
    it('should create a discussion room', async () => {
      const options: DiscussionOptions = {
        topic: 'Test Discussion Topic',
        participants: ['architect', 'coder'],
      };

      const room = await engine.startDiscussion(options);

      expect(room.id).toBeDefined();
      expect(room.topic).toBe('Test Discussion Topic');
      expect(room.participants).toEqual(['architect', 'coder']);
      expect(room.status).toBe('open');
    });

    it('should use default values', async () => {
      const room = await engine.startDiscussion({
        topic: 'Test',
        participants: ['agent1'],
      });

      expect(room.maxRounds).toBe(5);
      expect(room.consensusThreshold).toBe(0.8);
      expect(room.moderator).toBe('orchestrator');
    });

    it('should respect custom options', async () => {
      const room = await engine.startDiscussion({
        topic: 'Test',
        participants: ['agent1'],
        maxRounds: 3,
        consensusThreshold: 0.6,
        moderator: 'custom-mod',
      });

      expect(room.maxRounds).toBe(3);
      expect(room.consensusThreshold).toBe(0.6);
      expect(room.moderator).toBe('custom-mod');
    });

    it('should emit discussion:started event', async () => {
      const events: unknown[] = [];
      engine.on('discussion:started', (room) => events.push(room));

      await engine.startDiscussion({
        topic: 'Test',
        participants: ['agent1'],
      });

      expect(events.length).toBe(1);
    });
  });

  describe('getRoom', () => {
    it('should return room by ID', async () => {
      const created = await engine.startDiscussion({
        topic: 'Test',
        participants: ['agent1'],
      });

      const retrieved = engine.getRoom(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return undefined for non-existent room', () => {
      const room = engine.getRoom('non-existent');
      expect(room).toBeUndefined();
    });
  });

  describe('listActiveDiscussions', () => {
    it('should return only active discussions', async () => {
      await engine.startDiscussion({
        topic: 'Test 1',
        participants: ['agent1'],
      });
      await engine.startDiscussion({
        topic: 'Test 2',
        participants: ['agent2'],
      });

      const active = engine.listActiveDiscussions();

      expect(active.length).toBe(2);
      expect(active.every(r => r.status === 'open' || r.status === 'voting')).toBe(true);
    });
  });

  describe('addMessage', () => {
    it('should add message to room transcript', async () => {
      const room = await engine.startDiscussion({
        topic: 'Test',
        participants: ['agent1'],
      });

      engine.addMessage(room.id, {
        agentId: 'agent1',
        round: 1,
        type: 'opinion',
        content: 'Test message',
        timestamp: new Date(),
      });

      const updated = engine.getRoom(room.id);
      expect(updated!.transcript.length).toBe(1);
      expect(updated!.transcript[0]!.content).toBe('Test message');
    });

    it('should emit discussion:message event', async () => {
      const room = await engine.startDiscussion({
        topic: 'Test',
        participants: ['agent1'],
      });

      const events: unknown[] = [];
      engine.on('discussion:message', (_r, m) => events.push(m));

      engine.addMessage(room.id, {
        agentId: 'agent1',
        round: 1,
        type: 'opinion',
        content: 'Test',
        timestamp: new Date(),
      });

      expect(events.length).toBe(1);
    });
  });

  describe('closeDiscussion', () => {
    it('should close discussion', async () => {
      const room = await engine.startDiscussion({
        topic: 'Test',
        participants: ['agent1'],
      });

      engine.closeDiscussion(room.id, 'Final decision');

      const closed = engine.getRoom(room.id);
      expect(closed!.status).toBe('closed');
      expect(closed!.decision).toBe('Final decision');
      expect(closed!.closedAt).toBeDefined();
    });
  });

  describe('runDiscussion', () => {
    it('should throw for non-existent room', async () => {
      await expect(engine.runDiscussion('non-existent'))
        .rejects.toThrow('Discussion room not found');
    });

    it('should run discussion rounds', async () => {
      const room = await engine.startDiscussion({
        topic: 'Should we use TypeScript?',
        participants: ['architect', 'coder'],
        maxRounds: 2,
      });

      const result = await engine.runDiscussion(room.id);

      expect(result).toBeDefined();
      expect(result.room.round).toBeGreaterThan(0);
    });
  });
});
