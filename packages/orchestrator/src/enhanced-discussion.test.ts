/**
 * Integration Tests for Enhanced Discussion Engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  EnhancedDiscussionEngine, 
  DiscussionPhase,
} from './enhanced-discussion.js';
import { AgentCommunication } from './agent-communication.js';
import { MessageQueue } from './message-queue.js';

describe('EnhancedDiscussionEngine', () => {
  let queue: MessageQueue;
  let comm: AgentCommunication;
  let discussionEngine: EnhancedDiscussionEngine;
  
  beforeEach(() => {
    queue = new MessageQueue();
    comm = new AgentCommunication(queue);
    discussionEngine = new EnhancedDiscussionEngine(comm);
    
    // Register test agents
    comm.registerAgent('orchestrator');
    comm.registerAgent('agent1');
    comm.registerAgent('agent2');
    comm.registerAgent('agent3');
  });
  
  afterEach(() => {
    discussionEngine.destroy();
    comm.destroy();
  });
  
  describe('Discussion Creation', () => {
    it('should create a discussion', () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Feature X Implementation',
        description: 'Should we implement feature X?',
        participants: ['agent1', 'agent2', 'agent3'],
        moderatorId: 'orchestrator',
      });
      
      expect(room.id).toBeDefined();
      expect(room.topic).toBe('Feature X Implementation');
      expect(room.description).toBe('Should we implement feature X?');
      expect(room.participants).toEqual(['agent1', 'agent2', 'agent3']);
      expect(room.moderatorId).toBe('orchestrator');
      expect(room.phase).toBe(DiscussionPhase.PROPOSAL);
    });
    
    it('should create proposal in underlying communication layer', () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      expect(room.proposal).toBeDefined();
      expect(room.proposal.topic).toBe('Test Topic');
      expect(room.proposal.description).toBe('Test description');
    });
    
    it('should set custom options', () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
        options: ['Option A', 'Option B', 'Option C'],
        consensusThreshold: 0.75,
        totalTimeoutMs: 60000,
      });
      
      expect(room.options).toEqual(['Option A', 'Option B', 'Option C']);
      expect(room.consensusThreshold).toBe(0.75);
      expect(room.timeoutMs).toBe(60000);
    });
    
    it('should add proposal to transcript', () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      expect(room.transcript).toHaveLength(1);
      expect(room.transcript[0]?.type).toBe('proposal');
      expect(room.transcript[0]?.content).toContain('Test Topic');
    });
    
    it('should emit discussion:created event', () => {
      const handler = vi.fn();
      discussionEngine.on('discussion:created', handler);
      
      discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      expect(handler).toHaveBeenCalled();
    });
  });
  
  describe('Argument Phase', () => {
    it('should start argument phase', async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1', 'agent2'],
      });
      
      await discussionEngine.startArgumentPhase(room.id);
      
      const updatedRoom = discussionEngine.getRoom(room.id);
      expect(updatedRoom?.phase).toBe(DiscussionPhase.ARGUMENT);
    });
    
    it('should emit phase change event', async () => {
      const handler = vi.fn();
      discussionEngine.on('discussion:phase', handler);
      
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      await discussionEngine.startArgumentPhase(room.id);
      
      expect(handler).toHaveBeenCalledWith(expect.any(Object), DiscussionPhase.ARGUMENT);
    });
    
    it('should add moderator entry to transcript', async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      await discussionEngine.startArgumentPhase(room.id);
      
      const updatedRoom = discussionEngine.getRoom(room.id);
      const entries = updatedRoom?.transcript.filter(e => e.type === 'moderator');
      
      expect(entries?.length).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('Submitting Arguments', () => {
    let roomId: string;
    
    beforeEach(async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1', 'agent2'],
      });
      roomId = room.id;
      await discussionEngine.startArgumentPhase(roomId);
    });
    
    it('should submit an argument', () => {
      const argument = discussionEngine.submitArgument(
        roomId,
        'agent1',
        'support',
        'I think this is a great idea because it improves performance.'
      );
      
      expect(argument).not.toBeNull();
      expect(argument!.stance).toBe('support');
      expect(argument!.reasoning).toContain('improves performance');
    });
    
    it('should add argument to room', () => {
      discussionEngine.submitArgument(
        roomId,
        'agent1',
        'support',
        'Good idea'
      );
      
      const room = discussionEngine.getRoom(roomId);
      expect(room?.arguments).toHaveLength(1);
    });
    
    it('should add argument to transcript', () => {
      discussionEngine.submitArgument(
        roomId,
        'agent1',
        'support',
        'Good idea'
      );
      
      const room = discussionEngine.getRoom(roomId);
      const argEntries = room?.transcript.filter(e => e.type === 'argument');
      
      expect(argEntries?.length).toBeGreaterThanOrEqual(1);
      expect(argEntries?.[0]?.content).toContain('SUPPORT');
    });
    
    it('should emit argument event', () => {
      const handler = vi.fn();
      discussionEngine.on('discussion:argument', handler);
      
      discussionEngine.submitArgument(
        roomId,
        'agent1',
        'support',
        'Good idea'
      );
      
      expect(handler).toHaveBeenCalled();
    });
    
    it('should reject argument from non-participant', () => {
      const argument = discussionEngine.submitArgument(
        roomId,
        'non-participant',
        'support',
        'I want to join!'
      );
      
      expect(argument).toBeNull();
    });
    
    it('should reject argument in wrong phase', async () => {
      await discussionEngine.startVotingPhase(roomId);
      
      const argument = discussionEngine.submitArgument(
        roomId,
        'agent1',
        'support',
        'Too late!'
      );
      
      expect(argument).toBeNull();
    });
    
    it('should set custom confidence', () => {
      const argument = discussionEngine.submitArgument(
        roomId,
        'agent1',
        'support',
        'Good idea',
        0.95
      );
      
      expect(argument?.confidence).toBe(0.95);
    });
  });
  
  describe('Voting Phase', () => {
    let roomId: string;
    
    beforeEach(async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1', 'agent2', 'agent3'],
        options: ['Yes', 'No', 'Maybe'],
      });
      roomId = room.id;
      await discussionEngine.startArgumentPhase(roomId);
      
      // Submit some arguments
      discussionEngine.submitArgument(roomId, 'agent1', 'support', 'Good idea');
      discussionEngine.submitArgument(roomId, 'agent2', 'oppose', 'Bad idea');
    });
    
    it('should start voting phase', async () => {
      await discussionEngine.startVotingPhase(roomId);
      
      const room = discussionEngine.getRoom(roomId);
      expect(room?.phase).toBe(DiscussionPhase.VOTING);
    });
    
    it('should summarize arguments in transcript', async () => {
      await discussionEngine.startVotingPhase(roomId);
      
      const room = discussionEngine.getRoom(roomId);
      const moderatorEntries = room?.transcript.filter(
        e => e.type === 'moderator' && e.phase === DiscussionPhase.VOTING
      );
      
      expect(moderatorEntries?.length).toBeGreaterThanOrEqual(1);
      expect(moderatorEntries?.[0]?.content).toContain('Voting phase started');
    });
    
    it('should emit phase change event', async () => {
      const handler = vi.fn();
      discussionEngine.on('discussion:phase', handler);
      
      await discussionEngine.startVotingPhase(roomId);
      
      expect(handler).toHaveBeenCalledWith(expect.any(Object), DiscussionPhase.VOTING);
    });
  });
  
  describe('Voting', () => {
    let roomId: string;
    
    beforeEach(async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1', 'agent2', 'agent3'],
        options: ['Approve', 'Reject', 'Abstain'],
      });
      roomId = room.id;
      await discussionEngine.startArgumentPhase(roomId);
      await discussionEngine.startVotingPhase(roomId);
    });
    
    it('should submit a vote', () => {
      const vote = discussionEngine.submitVote(roomId, 'agent1', 'Approve', 'I agree');
      
      expect(vote).not.toBeNull();
      expect(vote!.option).toBe('Approve');
      expect(vote!.reasoning).toBe('I agree');
    });
    
    it('should add vote to room', () => {
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      
      const room = discussionEngine.getRoom(roomId);
      expect(room?.votes).toHaveLength(1);
    });
    
    it('should add vote to transcript', () => {
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      
      const room = discussionEngine.getRoom(roomId);
      const voteEntries = room?.transcript.filter(e => e.type === 'vote');
      
      expect(voteEntries?.length).toBeGreaterThanOrEqual(1);
    });
    
    it('should emit vote event', () => {
      const handler = vi.fn();
      discussionEngine.on('discussion:vote', handler);
      
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      
      expect(handler).toHaveBeenCalled();
    });
    
    it('should reject invalid option', () => {
      const vote = discussionEngine.submitVote(roomId, 'agent1', 'InvalidOption');
      
      expect(vote).toBeNull();
    });
    
    it('should reject vote from non-participant', () => {
      const vote = discussionEngine.submitVote(roomId, 'non-participant', 'Approve');
      
      expect(vote).toBeNull();
    });
    
    it('should replace vote from same agent', () => {
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      discussionEngine.submitVote(roomId, 'agent1', 'Reject'); // Change vote
      
      const room = discussionEngine.getRoom(roomId);
      expect(room?.votes).toHaveLength(1);
      expect(room?.votes[0]?.option).toBe('Reject');
    });
  });
  
  describe('Consensus & Finalization', () => {
    let roomId: string;
    
    beforeEach(async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1', 'agent2', 'agent3'],
        options: ['Approve', 'Reject'],
        consensusThreshold: 0.6,
      });
      roomId = room.id;
      await discussionEngine.startArgumentPhase(roomId);
      await discussionEngine.startVotingPhase(roomId);
    });
    
    it('should reach consensus when threshold is met', async () => {
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      discussionEngine.submitVote(roomId, 'agent2', 'Approve');
      discussionEngine.submitVote(roomId, 'agent3', 'Reject');
      
      // Wait for auto-finalization (triggered when all participants vote)
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get the room after auto-finalization
      const room = discussionEngine.getRoom(roomId);
      
      expect(room?.consensus?.reached).toBe(true);
      expect(room?.consensus?.decision).toBe('Approve');
      expect(room?.decision).toBe('Approve');
    });
    
    it('should not reach consensus below threshold', async () => {
      // Only 2 of 3 participants vote (50% split, below 60% threshold)
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      discussionEngine.submitVote(roomId, 'agent2', 'Reject');
      
      // Manually finalize (not all participants voted)
      const room = await discussionEngine.finalizeDiscussion(roomId);
      
      expect(room?.consensus?.reached).toBe(false);
    });
    
    it('should close discussion after finalization', async () => {
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      
      const room = await discussionEngine.finalizeDiscussion(roomId);
      
      expect(room?.phase).toBe(DiscussionPhase.CLOSED);
      expect(room?.closedAt).toBeDefined();
    });
    
    it('should emit consensus event when reached', async () => {
      const handler = vi.fn();
      discussionEngine.on('discussion:consensus', handler);
      
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      discussionEngine.submitVote(roomId, 'agent2', 'Approve');
      discussionEngine.submitVote(roomId, 'agent3', 'Approve');
      
      await discussionEngine.finalizeDiscussion(roomId);
      
      expect(handler).toHaveBeenCalledWith(expect.any(Object), 'Approve');
    });
    
    it('should emit closed event', async () => {
      const handler = vi.fn();
      discussionEngine.on('discussion:closed', handler);
      
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      
      await discussionEngine.finalizeDiscussion(roomId);
      
      expect(handler).toHaveBeenCalled();
    });
    
    it('should add consensus entry to transcript', async () => {
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      discussionEngine.submitVote(roomId, 'agent2', 'Approve');
      discussionEngine.submitVote(roomId, 'agent3', 'Approve');
      
      await discussionEngine.finalizeDiscussion(roomId);
      
      const room = discussionEngine.getRoom(roomId);
      const consensusEntries = room?.transcript.filter(e => e.type === 'consensus');
      
      expect(consensusEntries?.length).toBeGreaterThanOrEqual(1);
    });
    
    it('should auto-finalize when all participants vote', async () => {
      const closedHandler = vi.fn();
      discussionEngine.on('discussion:closed', closedHandler);
      
      discussionEngine.submitVote(roomId, 'agent1', 'Approve');
      discussionEngine.submitVote(roomId, 'agent2', 'Approve');
      discussionEngine.submitVote(roomId, 'agent3', 'Reject');
      
      // Wait for auto-finalization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(closedHandler).toHaveBeenCalled();
    });
  });
  
  describe('CLI Formatting', () => {
    it('should format transcript for CLI with colors', async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1', 'agent2'],
      });
      
      await discussionEngine.startArgumentPhase(room.id);
      discussionEngine.submitArgument(room.id, 'agent1', 'support', 'Good idea');
      discussionEngine.submitArgument(room.id, 'agent2', 'oppose', 'Bad idea');
      
      const formatted = discussionEngine.formatTranscriptForCLI(room.id, true);
      
      expect(formatted).toContain('=== Discussion: Test Topic ===');
      expect(formatted).toContain('AGENT1');
      expect(formatted).toContain('AGENT2');
      // Should contain ANSI color codes
      expect(formatted).toContain('\x1b[');
    });
    
    it('should format transcript without colors', async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      const formatted = discussionEngine.formatTranscriptForCLI(room.id, false);
      
      expect(formatted).toContain('=== Discussion: Test Topic ===');
      // Should NOT contain ANSI color codes
      expect(formatted).not.toContain('\x1b[');
    });
    
    it('should include emojis for entry types', async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      await discussionEngine.startArgumentPhase(room.id);
      discussionEngine.submitArgument(room.id, 'agent1', 'support', 'Good idea');
      
      await discussionEngine.startVotingPhase(room.id);
      discussionEngine.submitVote(room.id, 'agent1', 'Approve');
      
      const formatted = discussionEngine.formatTranscriptForCLI(room.id, false);
      
      expect(formatted).toContain('📋'); // Proposal
      expect(formatted).toContain('💬'); // Argument
      expect(formatted).toContain('🗳️'); // Vote
    });
  });
  
  describe('User Intervention', () => {
    it('should inject user message as argument', async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      await discussionEngine.startArgumentPhase(room.id);
      
      discussionEngine.injectUserMessage(
        room.id,
        'user123',
        'I have some concerns about security',
        { stance: 'oppose' }
      );
      
      const updatedRoom = discussionEngine.getRoom(room.id);
      expect(updatedRoom?.arguments).toHaveLength(1);
      expect(updatedRoom?.arguments[0]?.agentId).toBe('user123');
      expect(updatedRoom?.arguments[0]?.stance).toBe('oppose');
    });
    
    it('should inject user message as moderator comment', async () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      discussionEngine.injectUserMessage(
        room.id,
        'user123',
        'Please focus on the main topic'
      );
      
      const updatedRoom = discussionEngine.getRoom(room.id);
      const userEntry = updatedRoom?.transcript.find(e => 
        e.content.includes('USER INPUT')
      );
      
      expect(userEntry).toBeDefined();
      expect(userEntry?.content).toContain('Please focus on the main topic');
    });
  });
  
  describe('Room Management', () => {
    it('should get room by ID', () => {
      const created = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      const retrieved = discussionEngine.getRoom(created.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.topic).toBe('Test Topic');
    });
    
    it('should list active discussions', async () => {
      discussionEngine.createDiscussion({
        topic: 'Topic 1',
        description: 'Test',
        participants: ['agent1'],
      });
      
      const room2 = discussionEngine.createDiscussion({
        topic: 'Topic 2',
        description: 'Test',
        participants: ['agent1'],
      });
      
      // Close room2
      await discussionEngine.startArgumentPhase(room2.id);
      await discussionEngine.startVotingPhase(room2.id);
      await discussionEngine.finalizeDiscussion(room2.id);
      
      const active = discussionEngine.getActiveDiscussions();
      
      expect(active).toHaveLength(1);
      expect(active[0]?.topic).toBe('Topic 1');
    });
    
    it('should get transcript', () => {
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      const transcript = discussionEngine.getTranscript(room.id);
      
      expect(transcript).toHaveLength(1);
      expect(transcript[0]?.type).toBe('proposal');
    });
  });
  
  describe('Events', () => {
    it('should emit discussion:entry for each transcript entry', async () => {
      const handler = vi.fn();
      discussionEngine.on('discussion:entry', handler);
      
      const room = discussionEngine.createDiscussion({
        topic: 'Test Topic',
        description: 'Test description',
        participants: ['agent1'],
      });
      
      expect(handler).toHaveBeenCalledTimes(1); // Proposal entry
      
      await discussionEngine.startArgumentPhase(room.id);
      
      expect(handler).toHaveBeenCalledTimes(2); // + moderator entry
      
      discussionEngine.submitArgument(room.id, 'agent1', 'support', 'Good idea');
      
      expect(handler).toHaveBeenCalledTimes(3); // + argument entry
    });
  });
});
