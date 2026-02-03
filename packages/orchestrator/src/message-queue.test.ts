/**
 * Unit Tests for Message Queue
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  MessageQueue, 
  MessagePriority, 
  MessageStatus,
} from './message-queue.js';

describe('MessageQueue', () => {
  let queue: MessageQueue;
  
  beforeEach(() => {
    queue = new MessageQueue();
  });
  
  afterEach(() => {
    queue.destroy();
  });
  
  describe('Agent Registration', () => {
    it('should register an agent', () => {
      queue.registerAgent('agent1');
      expect(queue.getRegisteredAgents()).toContain('agent1');
    });
    
    it('should unregister an agent', () => {
      queue.registerAgent('agent1');
      queue.unregisterAgent('agent1');
      expect(queue.getRegisteredAgents()).not.toContain('agent1');
    });
    
    it('should handle multiple agents', () => {
      queue.registerAgent('agent1');
      queue.registerAgent('agent2');
      queue.registerAgent('agent3');
      expect(queue.getRegisteredAgents()).toHaveLength(3);
    });
  });
  
  describe('Sending Messages', () => {
    beforeEach(() => {
      queue.registerAgent('sender');
      queue.registerAgent('recipient');
    });
    
    it('should send a message to an agent', () => {
      const message = queue.send('sender', 'recipient', 'test', { data: 'hello' });
      
      expect(message.id).toBeDefined();
      expect(message.senderId).toBe('sender');
      expect(message.recipientId).toBe('recipient');
      expect(message.type).toBe('test');
      expect(message.payload).toEqual({ data: 'hello' });
      expect(message.status).toBe(MessageStatus.PENDING);
    });
    
    it('should set correct priority', () => {
      const lowPriority = queue.send('sender', 'recipient', 'test', {}, { 
        priority: MessagePriority.LOW 
      });
      const highPriority = queue.send('sender', 'recipient', 'test', {}, { 
        priority: MessagePriority.HIGH 
      });
      
      expect(lowPriority.priority).toBe(MessagePriority.LOW);
      expect(highPriority.priority).toBe(MessagePriority.HIGH);
    });
    
    it('should generate correlation ID if not provided', () => {
      const message = queue.send('sender', 'recipient', 'test', {});
      expect(message.correlationId).toBeDefined();
    });
    
    it('should use provided correlation ID', () => {
      const message = queue.send('sender', 'recipient', 'test', {}, {
        correlationId: 'custom-correlation-id',
      });
      expect(message.correlationId).toBe('custom-correlation-id');
    });
    
    it('should set expiration time when TTL is provided', () => {
      const message = queue.send('sender', 'recipient', 'test', {}, {
        ttlMs: 5000,
      });
      expect(message.expiresAt).toBeDefined();
      expect(message.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });
  
  describe('Receiving Messages', () => {
    beforeEach(() => {
      queue.registerAgent('sender');
      queue.registerAgent('recipient');
    });
    
    it('should receive messages for an agent', () => {
      queue.send('sender', 'recipient', 'test', { data: 1 });
      queue.send('sender', 'recipient', 'test', { data: 2 });
      
      const messages = queue.receive('recipient');
      
      expect(messages).toHaveLength(2);
    });
    
    it('should receive messages in priority order', () => {
      queue.send('sender', 'recipient', 'test', { data: 'low' }, { 
        priority: MessagePriority.LOW 
      });
      queue.send('sender', 'recipient', 'test', { data: 'urgent' }, { 
        priority: MessagePriority.URGENT 
      });
      queue.send('sender', 'recipient', 'test', { data: 'normal' }, { 
        priority: MessagePriority.NORMAL 
      });
      
      const messages = queue.receive('recipient');
      
      expect(messages[0]?.payload).toEqual({ data: 'urgent' });
      expect(messages[1]?.payload).toEqual({ data: 'normal' });
      expect(messages[2]?.payload).toEqual({ data: 'low' });
    });
    
    it('should filter by message type', () => {
      queue.send('sender', 'recipient', 'type-a', { data: 1 });
      queue.send('sender', 'recipient', 'type-b', { data: 2 });
      queue.send('sender', 'recipient', 'type-a', { data: 3 });
      
      const messages = queue.receive('recipient', { types: ['type-a'] });
      
      expect(messages).toHaveLength(2);
      expect(messages.every(m => m.type === 'type-a')).toBe(true);
    });
    
    it('should filter by minimum priority', () => {
      queue.send('sender', 'recipient', 'test', { data: 'low' }, { 
        priority: MessagePriority.LOW 
      });
      queue.send('sender', 'recipient', 'test', { data: 'high' }, { 
        priority: MessagePriority.HIGH 
      });
      
      const messages = queue.receive('recipient', { 
        minPriority: MessagePriority.HIGH 
      });
      
      expect(messages).toHaveLength(1);
      expect(messages[0]?.payload).toEqual({ data: 'high' });
    });
    
    it('should limit number of messages returned', () => {
      for (let i = 0; i < 10; i++) {
        queue.send('sender', 'recipient', 'test', { data: i });
      }
      
      const messages = queue.receive('recipient', { maxMessages: 3 });
      
      expect(messages).toHaveLength(3);
    });
    
    it('should mark messages as delivered when received', () => {
      const sent = queue.send('sender', 'recipient', 'test', {});
      queue.receive('recipient');
      
      expect(sent.status).toBe(MessageStatus.DELIVERED);
    });
    
    it('should mark messages as read when option is set', () => {
      const sent = queue.send('sender', 'recipient', 'test', {});
      queue.receive('recipient', { markAsRead: true });
      
      expect(sent.status).toBe(MessageStatus.READ);
    });
  });
  
  describe('Broadcasting', () => {
    beforeEach(() => {
      queue.registerAgent('sender');
      queue.registerAgent('agent1');
      queue.registerAgent('agent2');
      queue.registerAgent('agent3');
    });
    
    it('should broadcast to all agents except sender', () => {
      queue.broadcast('sender', 'announcement', { data: 'hello everyone' });
      
      const msg1 = queue.receive('agent1');
      const msg2 = queue.receive('agent2');
      const msg3 = queue.receive('agent3');
      const msgSender = queue.receive('sender');
      
      expect(msg1).toHaveLength(1);
      expect(msg2).toHaveLength(1);
      expect(msg3).toHaveLength(1);
      expect(msgSender).toHaveLength(0);
    });
    
    it('should exclude specified agents from broadcast', () => {
      queue.broadcast('sender', 'announcement', { data: 'hello' }, {
        excludeAgents: ['agent2'],
      });
      
      const msg1 = queue.receive('agent1');
      const msg2 = queue.receive('agent2');
      const msg3 = queue.receive('agent3');
      
      expect(msg1).toHaveLength(1);
      expect(msg2).toHaveLength(0);
      expect(msg3).toHaveLength(1);
    });
    
    it('should set broadcast recipient to "broadcast"', () => {
      const message = queue.broadcast('sender', 'announcement', {});
      expect(message.recipientId).toBe('broadcast');
    });
  });
  
  describe('Reply', () => {
    beforeEach(() => {
      queue.registerAgent('agent1');
      queue.registerAgent('agent2');
    });
    
    it('should reply to a message', () => {
      const original = queue.send('agent1', 'agent2', 'question', { q: 'hello?' });
      const reply = queue.reply(original.id, 'agent2', 'answer', { a: 'hi!' });
      
      expect(reply).not.toBeNull();
      expect(reply!.recipientId).toBe('agent1');
      expect(reply!.senderId).toBe('agent2');
      expect(reply!.replyTo).toBe(original.id);
      expect(reply!.correlationId).toBe(original.correlationId);
    });
    
    it('should return null for invalid message ID', () => {
      const reply = queue.reply('invalid-id', 'agent2', 'answer', {});
      expect(reply).toBeNull();
    });
  });
  
  describe('Acknowledgment', () => {
    beforeEach(() => {
      queue.registerAgent('sender');
      queue.registerAgent('recipient');
    });
    
    it('should acknowledge a message', () => {
      const message = queue.send('sender', 'recipient', 'test', {});
      queue.receive('recipient');
      
      const acked = queue.acknowledge(message.id);
      
      expect(acked).toBe(true);
      expect(message.status).toBe(MessageStatus.PROCESSED);
    });
    
    it('should remove acknowledged message from queue', () => {
      queue.send('sender', 'recipient', 'test', {});
      const message = queue.receive('recipient')[0]!;
      
      queue.acknowledge(message.id);
      
      const remaining = queue.receive('recipient');
      expect(remaining).toHaveLength(0);
    });
    
    it('should return false for invalid message ID', () => {
      const acked = queue.acknowledge('invalid-id');
      expect(acked).toBe(false);
    });
  });
  
  describe('Subscriptions', () => {
    beforeEach(() => {
      queue.registerAgent('sender');
      queue.registerAgent('subscriber');
    });
    
    it('should call handler when message is received', async () => {
      const handler = vi.fn();
      
      queue.subscribe('subscriber', handler);
      queue.send('sender', 'subscriber', 'test', { data: 'hello' });
      
      // Allow async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0].payload).toEqual({ data: 'hello' });
    });
    
    it('should filter by sender ID', async () => {
      const handler = vi.fn();
      
      queue.registerAgent('other-sender');
      queue.subscribe('subscriber', handler, { senderId: 'sender' });
      
      queue.send('sender', 'subscriber', 'test', {});
      queue.send('other-sender', 'subscriber', 'test', {});
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should filter by message types', async () => {
      const handler = vi.fn();
      
      queue.subscribe('subscriber', handler, { types: ['important'] });
      
      queue.send('sender', 'subscriber', 'important', {});
      queue.send('sender', 'subscriber', 'spam', {});
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should unsubscribe', async () => {
      const handler = vi.fn();
      
      const subId = queue.subscribe('subscriber', handler);
      queue.send('sender', 'subscriber', 'test', {});
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1);
      
      queue.unsubscribe(subId);
      queue.send('sender', 'subscriber', 'test', {});
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });
  
  describe('Message Threading', () => {
    beforeEach(() => {
      queue.registerAgent('agent1');
      queue.registerAgent('agent2');
    });
    
    it('should get all messages in a thread by correlation ID', () => {
      const correlationId = 'conversation-1';
      
      queue.send('agent1', 'agent2', 'question', { q: 1 }, { correlationId });
      queue.send('agent2', 'agent1', 'answer', { a: 1 }, { correlationId });
      queue.send('agent1', 'agent2', 'followup', { q: 2 }, { correlationId });
      queue.send('agent1', 'agent2', 'other', {}, { correlationId: 'other-thread' });
      
      const thread = queue.getThread(correlationId);
      
      expect(thread).toHaveLength(3);
      expect(thread.every(m => m.correlationId === correlationId)).toBe(true);
    });
    
    it('should return thread in chronological order', async () => {
      const correlationId = 'conversation-1';
      
      queue.send('agent1', 'agent2', 'first', {}, { correlationId });
      await new Promise(resolve => setTimeout(resolve, 10));
      queue.send('agent2', 'agent1', 'second', {}, { correlationId });
      await new Promise(resolve => setTimeout(resolve, 10));
      queue.send('agent1', 'agent2', 'third', {}, { correlationId });
      
      const thread = queue.getThread(correlationId);
      
      expect(thread[0]?.type).toBe('first');
      expect(thread[1]?.type).toBe('second');
      expect(thread[2]?.type).toBe('third');
    });
  });
  
  describe('Statistics', () => {
    beforeEach(() => {
      queue.registerAgent('agent1');
      queue.registerAgent('agent2');
    });
    
    it('should track pending messages', () => {
      queue.send('agent1', 'agent2', 'test', {});
      queue.send('agent1', 'agent2', 'test', {});
      
      const stats = queue.getStats();
      
      expect(stats.pendingMessages).toBe(2);
    });
    
    it('should track delivered messages', () => {
      queue.send('agent1', 'agent2', 'test', {});
      queue.send('agent1', 'agent2', 'test', {});
      queue.receive('agent2');
      
      const stats = queue.getStats();
      
      expect(stats.deliveredMessages).toBe(2);
    });
    
    it('should track processed messages', () => {
      const msg = queue.send('agent1', 'agent2', 'test', {});
      queue.receive('agent2');
      queue.acknowledge(msg.id);
      
      const stats = queue.getStats();
      
      expect(stats.processedMessages).toBe(1);
    });
    
    it('should count registered agents', () => {
      const stats = queue.getStats();
      expect(stats.agentCount).toBe(2);
    });
    
    it('should get pending count per agent', () => {
      queue.send('agent1', 'agent2', 'test', {});
      queue.send('agent1', 'agent2', 'test', {});
      queue.send('agent2', 'agent1', 'test', {});
      
      expect(queue.getPendingCount('agent1')).toBe(1);
      expect(queue.getPendingCount('agent2')).toBe(2);
    });
  });
  
  describe('Queue Management', () => {
    beforeEach(() => {
      queue.registerAgent('agent1');
      queue.registerAgent('agent2');
    });
    
    it('should clear queue for an agent', () => {
      queue.send('agent1', 'agent2', 'test', {});
      queue.send('agent1', 'agent2', 'test', {});
      
      queue.clearQueue('agent2');
      
      expect(queue.receive('agent2')).toHaveLength(0);
    });
    
    it('should clear all queues', () => {
      queue.send('agent1', 'agent2', 'test', {});
      queue.send('agent2', 'agent1', 'test', {});
      
      queue.clearAll();
      
      expect(queue.receive('agent1')).toHaveLength(0);
      expect(queue.receive('agent2')).toHaveLength(0);
    });
    
    it('should get a specific message', () => {
      const sent = queue.send('agent1', 'agent2', 'test', { data: 'specific' });
      
      const retrieved = queue.getMessage(sent.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.payload).toEqual({ data: 'specific' });
    });
  });
  
  describe('Events', () => {
    beforeEach(() => {
      queue.registerAgent('sender');
      queue.registerAgent('recipient');
    });
    
    it('should emit message:queued event', async () => {
      const handler = vi.fn();
      queue.on('message:queued', handler);
      
      queue.send('sender', 'recipient', 'test', {});
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should emit message:delivered event', async () => {
      const handler = vi.fn();
      queue.on('message:delivered', handler);
      
      queue.send('sender', 'recipient', 'test', {});
      queue.receive('recipient');
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should emit message:processed event', async () => {
      const handler = vi.fn();
      queue.on('message:processed', handler);
      
      const msg = queue.send('sender', 'recipient', 'test', {});
      queue.receive('recipient');
      queue.acknowledge(msg.id);
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should emit broadcast event', async () => {
      const handler = vi.fn();
      queue.on('broadcast', handler);
      
      queue.broadcast('sender', 'announcement', {});
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
