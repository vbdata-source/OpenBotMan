/**
 * Unit Tests for Agent Communication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  AgentCommunication, 
  AgentMessageType,
} from './agent-communication.js';
import { MessageQueue } from './message-queue.js';

describe('AgentCommunication', () => {
  let queue: MessageQueue;
  let comm: AgentCommunication;
  
  beforeEach(() => {
    queue = new MessageQueue();
    comm = new AgentCommunication(queue);
  });
  
  afterEach(() => {
    comm.destroy();
  });
  
  describe('Agent Registration', () => {
    it('should register an agent', () => {
      comm.registerAgent('agent1');
      expect(queue.getRegisteredAgents()).toContain('agent1');
    });
    
    it('should unregister an agent', () => {
      comm.registerAgent('agent1');
      comm.unregisterAgent('agent1');
      expect(queue.getRegisteredAgents()).not.toContain('agent1');
    });
  });
  
  describe('Direct Messaging', () => {
    beforeEach(() => {
      comm.registerAgent('agent1');
      comm.registerAgent('agent2');
    });
    
    it('should send a direct message', () => {
      const message = comm.sendMessage('agent1', 'agent2', { text: 'Hello!' });
      
      expect(message.senderId).toBe('agent1');
      expect(message.recipientId).toBe('agent2');
      expect(message.type).toBe(AgentMessageType.DIRECT);
      expect(message.payload).toEqual({ text: 'Hello!' });
    });
    
    it('should send with custom type', () => {
      const message = comm.sendMessage('agent1', 'agent2', {}, {
        type: 'custom-type',
      });
      
      expect(message.type).toBe('custom-type');
    });
    
    it('should receive messages', () => {
      comm.sendMessage('agent1', 'agent2', { text: 'Hello!' });
      
      const messages = comm.getMessages('agent2');
      
      expect(messages).toHaveLength(1);
      expect(messages[0]?.payload).toEqual({ text: 'Hello!' });
    });
    
    it('should acknowledge messages', () => {
      const msg = comm.sendMessage('agent1', 'agent2', { text: 'Hello!' });
      comm.getMessages('agent2');
      
      const acked = comm.acknowledge(msg.id);
      
      expect(acked).toBe(true);
    });
  });
  
  describe('Request/Response', () => {
    beforeEach(() => {
      comm.registerAgent('agent1');
      comm.registerAgent('agent2');
    });
    
    it('should send request and receive response', async () => {
      // Set up response handler
      comm.on('request', (senderId, _type, _payload, correlationId) => {
        if (senderId === 'agent1') {
          comm.respond('agent2', correlationId, 'agent1', { answer: 42 });
        }
      });
      
      const response = await comm.request('agent1', 'agent2', { question: 'What is the answer?' }, {
        timeoutMs: 1000,
      });
      
      expect(response).toEqual({ answer: 42 });
    });
    
    it('should timeout if no response', async () => {
      await expect(
        comm.request('agent1', 'agent2', { question: 'Hello?' }, { timeoutMs: 50 })
      ).rejects.toThrow('Request timeout');
    });
    
    it('should emit response event', async () => {
      const responseHandler = vi.fn();
      comm.on('response', responseHandler);
      
      comm.on('request', (_senderId, _type, _payload, correlationId) => {
        comm.respond('agent2', correlationId, 'agent1', { data: 'response' });
      });
      
      await comm.request('agent1', 'agent2', {}, { timeoutMs: 1000 });
      
      expect(responseHandler).toHaveBeenCalled();
    });
  });
  
  describe('Broadcasting', () => {
    beforeEach(() => {
      comm.registerAgent('agent1');
      comm.registerAgent('agent2');
      comm.registerAgent('agent3');
    });
    
    it('should broadcast to all agents', () => {
      const message = comm.broadcast('agent1', { announcement: 'Hello all!' });
      
      expect(message.recipientId).toBe('broadcast');
      
      // Others should receive
      const msg2 = comm.getMessages('agent2');
      const msg3 = comm.getMessages('agent3');
      const msg1 = comm.getMessages('agent1');
      
      expect(msg2).toHaveLength(1);
      expect(msg3).toHaveLength(1);
      expect(msg1).toHaveLength(0); // Sender doesn't receive own broadcast
    });
    
    it('should exclude specified agents', () => {
      comm.broadcast('agent1', { announcement: 'Not for agent2' }, {
        excludeAgents: ['agent2'],
      });
      
      const msg2 = comm.getMessages('agent2');
      const msg3 = comm.getMessages('agent3');
      
      expect(msg2).toHaveLength(0);
      expect(msg3).toHaveLength(1);
    });
  });
  
  describe('Proposals', () => {
    beforeEach(() => {
      comm.registerAgent('proposer');
      comm.registerAgent('participant1');
      comm.registerAgent('participant2');
    });
    
    it('should create a proposal', () => {
      const proposal = comm.createProposal(
        'proposer',
        'Feature X',
        'Should we implement feature X?',
        { proposalOptions: ['Yes', 'No', 'Maybe'] }
      );
      
      expect(proposal.id).toBeDefined();
      expect(proposal.topic).toBe('Feature X');
      expect(proposal.description).toBe('Should we implement feature X?');
      expect(proposal.proposerId).toBe('proposer');
      expect(proposal.options).toEqual(['Yes', 'No', 'Maybe']);
    });
    
    it('should emit proposal event', () => {
      const handler = vi.fn();
      comm.on('proposal', handler);
      
      comm.createProposal('proposer', 'Test', 'Test proposal');
      
      expect(handler).toHaveBeenCalled();
    });
    
    it('should notify specified agents', () => {
      comm.createProposal('proposer', 'Test', 'Test proposal', {
        notifyAgents: ['participant1'],
      });
      
      const msg1 = comm.getMessages('participant1');
      const msg2 = comm.getMessages('participant2');
      
      expect(msg1).toHaveLength(1);
      expect(msg1[0]?.type).toBe(AgentMessageType.PROPOSAL);
      expect(msg2).toHaveLength(0);
    });
    
    it('should retrieve proposal', () => {
      const created = comm.createProposal('proposer', 'Test', 'Test proposal');
      
      const retrieved = comm.getProposal(created.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.topic).toBe('Test');
    });
  });
  
  describe('Arguments', () => {
    beforeEach(() => {
      comm.registerAgent('proposer');
      comm.registerAgent('participant1');
      comm.registerAgent('participant2');
    });
    
    it('should submit an argument', () => {
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal');
      
      const argument = comm.submitArgument(
        'participant1',
        proposal.id,
        'support',
        'I think this is a good idea because...',
        { confidence: 0.8 }
      );
      
      expect(argument).not.toBeNull();
      expect(argument!.proposalId).toBe(proposal.id);
      expect(argument!.agentId).toBe('participant1');
      expect(argument!.stance).toBe('support');
      expect(argument!.confidence).toBe(0.8);
    });
    
    it('should return null for invalid proposal', () => {
      const argument = comm.submitArgument(
        'participant1',
        'invalid-proposal',
        'support',
        'Test argument'
      );
      
      expect(argument).toBeNull();
    });
    
    it('should emit argument event', () => {
      const handler = vi.fn();
      comm.on('argument', handler);
      
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal');
      comm.submitArgument('participant1', proposal.id, 'support', 'Good idea');
      
      expect(handler).toHaveBeenCalled();
    });
    
    it('should retrieve arguments for a proposal', () => {
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal');
      
      comm.submitArgument('participant1', proposal.id, 'support', 'Argument 1');
      comm.submitArgument('participant2', proposal.id, 'oppose', 'Argument 2');
      
      const args = comm.getArguments(proposal.id);
      
      expect(args).toHaveLength(2);
    });
    
    it('should submit counter-argument', () => {
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal');
      comm.submitArgument('participant1', proposal.id, 'support', 'Good idea');
      
      const counter = comm.submitCounterArgument(
        'participant2',
        proposal.id,
        0,
        'Actually, I disagree because...'
      );
      
      expect(counter).not.toBeNull();
      expect(counter!.stance).toBe('oppose'); // Opposite of 'support'
      expect(counter!.reasoning).toContain('Counter to');
    });
  });
  
  describe('Voting', () => {
    beforeEach(() => {
      comm.registerAgent('proposer');
      comm.registerAgent('voter1');
      comm.registerAgent('voter2');
      comm.registerAgent('voter3');
    });
    
    it('should cast a vote', () => {
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal', {
        proposalOptions: ['Yes', 'No'],
      });
      
      const vote = comm.castVote('voter1', proposal.id, 'Yes', {
        reasoning: 'I agree',
      });
      
      expect(vote).not.toBeNull();
      expect(vote!.proposalId).toBe(proposal.id);
      expect(vote!.agentId).toBe('voter1');
      expect(vote!.option).toBe('Yes');
      expect(vote!.reasoning).toBe('I agree');
    });
    
    it('should return null for invalid option', () => {
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal', {
        proposalOptions: ['Yes', 'No'],
      });
      
      const vote = comm.castVote('voter1', proposal.id, 'Maybe');
      
      expect(vote).toBeNull();
    });
    
    it('should replace existing vote from same agent', () => {
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal', {
        proposalOptions: ['Yes', 'No'],
      });
      
      comm.castVote('voter1', proposal.id, 'Yes');
      comm.castVote('voter1', proposal.id, 'No'); // Change vote
      
      const votes = comm.getVotes(proposal.id);
      
      expect(votes).toHaveLength(1);
      expect(votes[0]?.option).toBe('No');
    });
    
    it('should emit vote event', () => {
      const handler = vi.fn();
      comm.on('vote', handler);
      
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal', {
        proposalOptions: ['Yes', 'No'],
      });
      comm.castVote('voter1', proposal.id, 'Yes');
      
      expect(handler).toHaveBeenCalled();
    });
    
    it('should retrieve votes for a proposal', () => {
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal', {
        proposalOptions: ['Yes', 'No'],
      });
      
      comm.castVote('voter1', proposal.id, 'Yes');
      comm.castVote('voter2', proposal.id, 'No');
      comm.castVote('voter3', proposal.id, 'Yes');
      
      const votes = comm.getVotes(proposal.id);
      
      expect(votes).toHaveLength(3);
    });
  });
  
  describe('Consensus', () => {
    beforeEach(() => {
      comm.registerAgent('proposer');
      comm.registerAgent('voter1');
      comm.registerAgent('voter2');
      comm.registerAgent('voter3');
      comm.registerAgent('voter4');
    });
    
    it('should calculate consensus when threshold is met', () => {
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal', {
        proposalOptions: ['Yes', 'No'],
      });
      
      comm.castVote('voter1', proposal.id, 'Yes');
      comm.castVote('voter2', proposal.id, 'Yes');
      comm.castVote('voter3', proposal.id, 'Yes');
      comm.castVote('voter4', proposal.id, 'No');
      
      const result = comm.calculateConsensus(proposal.id, 0.6); // 60% threshold
      
      expect(result).not.toBeNull();
      expect(result!.reached).toBe(true);
      expect(result!.decision).toBe('Yes');
      expect(result!.breakdown).toEqual({ Yes: 3, No: 1 });
    });
    
    it('should not reach consensus below threshold', () => {
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal', {
        proposalOptions: ['Yes', 'No'],
      });
      
      comm.castVote('voter1', proposal.id, 'Yes');
      comm.castVote('voter2', proposal.id, 'Yes');
      comm.castVote('voter3', proposal.id, 'No');
      comm.castVote('voter4', proposal.id, 'No');
      
      const result = comm.calculateConsensus(proposal.id, 0.6); // 60% threshold, but 50/50 split
      
      expect(result).not.toBeNull();
      expect(result!.reached).toBe(false);
    });
    
    it('should emit consensus event when reached', () => {
      const handler = vi.fn();
      comm.on('consensus', handler);
      
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal', {
        proposalOptions: ['Yes', 'No'],
      });
      
      comm.castVote('voter1', proposal.id, 'Yes');
      comm.castVote('voter2', proposal.id, 'Yes');
      comm.castVote('voter3', proposal.id, 'Yes');
      
      comm.calculateConsensus(proposal.id, 0.5);
      
      expect(handler).toHaveBeenCalledWith(proposal.id, 'Yes', expect.any(Array));
    });
    
    it('should return null for invalid proposal', () => {
      const result = comm.calculateConsensus('invalid-proposal');
      expect(result).toBeNull();
    });
    
    it('should return null for proposal with no votes', () => {
      const proposal = comm.createProposal('proposer', 'Test', 'Test proposal');
      
      const result = comm.calculateConsensus(proposal.id);
      
      expect(result).toBeNull();
    });
  });
  
  describe('Message Handlers', () => {
    beforeEach(() => {
      comm.registerAgent('agent1');
      comm.registerAgent('agent2');
    });
    
    it('should register and call message handler', async () => {
      const handler = vi.fn();
      
      comm.onMessage('agent2', 'custom-type', handler);
      comm.sendMessage('agent1', 'agent2', { data: 'test' }, { type: 'custom-type' });
      
      // Allow async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).toHaveBeenCalled();
    });
    
    it('should not call handler for other types', async () => {
      const handler = vi.fn();
      
      comm.onMessage('agent2', 'custom-type', handler);
      comm.sendMessage('agent1', 'agent2', { data: 'test' }, { type: 'other-type' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('should remove handler with offMessage', async () => {
      const handler = vi.fn();
      
      comm.onMessage('agent2', 'custom-type', handler);
      comm.offMessage('agent2', 'custom-type');
      comm.sendMessage('agent1', 'agent2', { data: 'test' }, { type: 'custom-type' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('Statistics', () => {
    beforeEach(() => {
      comm.registerAgent('agent1');
      comm.registerAgent('agent2');
    });
    
    it('should return queue statistics', () => {
      comm.sendMessage('agent1', 'agent2', { text: 'Hello!' });
      
      const stats = comm.getStats();
      
      expect(stats.totalMessages).toBe(1);
      expect(stats.pendingMessages).toBe(1);
      expect(stats.agentCount).toBe(2);
    });
    
    it('should expose underlying message queue', () => {
      const mq = comm.getMessageQueue();
      expect(mq).toBeInstanceOf(MessageQueue);
    });
  });
});
