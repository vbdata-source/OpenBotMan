/**
 * Message Queue for Agent-to-Agent Communication
 * 
 * Provides asynchronous message passing between agents.
 * Supports direct messaging, broadcasts, and subscriptions.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
  CRITICAL = 4,
}

/**
 * Message status
 */
export enum MessageStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  READ = 'read',
  PROCESSED = 'processed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/**
 * Agent message structure
 */
export interface AgentToAgentMessage {
  id: string;
  senderId: string;
  recipientId: string; // 'broadcast' for broadcasts
  type: string;
  payload: unknown;
  priority: MessagePriority;
  status: MessageStatus;
  correlationId?: string; // For request/response patterns
  replyTo?: string; // Original message ID if this is a reply
  timestamp: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Message filter for subscriptions
 */
export interface MessageFilter {
  senderId?: string;
  types?: string[];
  minPriority?: MessagePriority;
}

/**
 * Message handler function
 */
export type MessageHandler = (message: AgentToAgentMessage) => void | Promise<void>;

/**
 * Subscription info
 */
interface Subscription {
  id: string;
  agentId: string;
  filter: MessageFilter;
  handler: MessageHandler;
}

/**
 * Message Queue Events
 */
export interface MessageQueueEvents {
  'message:queued': (message: AgentToAgentMessage) => void;
  'message:delivered': (message: AgentToAgentMessage) => void;
  'message:read': (message: AgentToAgentMessage) => void;
  'message:processed': (message: AgentToAgentMessage) => void;
  'message:failed': (message: AgentToAgentMessage, error: Error) => void;
  'message:expired': (message: AgentToAgentMessage) => void;
  'broadcast': (message: AgentToAgentMessage) => void;
}

/**
 * Message Queue for inter-agent communication
 */
export class MessageQueue extends EventEmitter<MessageQueueEvents> {
  private queues: Map<string, AgentToAgentMessage[]> = new Map();
  private subscriptions: Map<string, Subscription[]> = new Map();
  private allMessages: Map<string, AgentToAgentMessage> = new Map();
  private expirationTimer?: ReturnType<typeof setInterval>;
  
  constructor() {
    super();
    // Start expiration checker
    this.startExpirationChecker();
  }
  
  /**
   * Send a message to a specific agent
   */
  send(
    senderId: string,
    recipientId: string,
    type: string,
    payload: unknown,
    options: {
      priority?: MessagePriority;
      correlationId?: string;
      replyTo?: string;
      ttlMs?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): AgentToAgentMessage {
    const message: AgentToAgentMessage = {
      id: uuidv4(),
      senderId,
      recipientId,
      type,
      payload,
      priority: options.priority ?? MessagePriority.NORMAL,
      status: MessageStatus.PENDING,
      correlationId: options.correlationId ?? uuidv4(),
      replyTo: options.replyTo,
      timestamp: new Date(),
      expiresAt: options.ttlMs ? new Date(Date.now() + options.ttlMs) : undefined,
      metadata: options.metadata,
    };
    
    // Store message
    this.allMessages.set(message.id, message);
    
    // Add to recipient's queue
    if (!this.queues.has(recipientId)) {
      this.queues.set(recipientId, []);
    }
    
    const queue = this.queues.get(recipientId)!;
    
    // Insert based on priority (higher priority = earlier in queue)
    const insertIndex = queue.findIndex(m => m.priority < message.priority);
    if (insertIndex === -1) {
      queue.push(message);
    } else {
      queue.splice(insertIndex, 0, message);
    }
    
    this.emit('message:queued', message);
    
    // Notify subscribers
    this.notifySubscribers(recipientId, message);
    
    return message;
  }
  
  /**
   * Broadcast a message to all agents
   */
  broadcast(
    senderId: string,
    type: string,
    payload: unknown,
    options: {
      priority?: MessagePriority;
      excludeAgents?: string[];
      ttlMs?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): AgentToAgentMessage {
    const message: AgentToAgentMessage = {
      id: uuidv4(),
      senderId,
      recipientId: 'broadcast',
      type,
      payload,
      priority: options.priority ?? MessagePriority.NORMAL,
      status: MessageStatus.PENDING,
      correlationId: uuidv4(),
      timestamp: new Date(),
      expiresAt: options.ttlMs ? new Date(Date.now() + options.ttlMs) : undefined,
      metadata: options.metadata,
    };
    
    // Store message
    this.allMessages.set(message.id, message);
    
    // Add to all agent queues except sender and excluded
    const excludeSet = new Set([senderId, ...(options.excludeAgents ?? [])]);
    
    for (const agentId of this.queues.keys()) {
      if (!excludeSet.has(agentId)) {
        const queue = this.queues.get(agentId)!;
        const insertIndex = queue.findIndex(m => m.priority < message.priority);
        if (insertIndex === -1) {
          queue.push(message);
        } else {
          queue.splice(insertIndex, 0, message);
        }
      }
    }
    
    this.emit('broadcast', message);
    
    // Notify all subscribers
    for (const agentId of this.subscriptions.keys()) {
      if (!excludeSet.has(agentId)) {
        this.notifySubscribers(agentId, message);
      }
    }
    
    return message;
  }
  
  /**
   * Reply to a message
   */
  reply(
    originalMessageId: string,
    senderId: string,
    type: string,
    payload: unknown,
    options: {
      priority?: MessagePriority;
      metadata?: Record<string, unknown>;
    } = {}
  ): AgentToAgentMessage | null {
    const originalMessage = this.allMessages.get(originalMessageId);
    if (!originalMessage) {
      return null;
    }
    
    return this.send(senderId, originalMessage.senderId, type, payload, {
      ...options,
      correlationId: originalMessage.correlationId,
      replyTo: originalMessageId,
    });
  }
  
  /**
   * Receive messages for an agent (polling)
   */
  receive(
    agentId: string,
    options: {
      maxMessages?: number;
      types?: string[];
      minPriority?: MessagePriority;
      markAsRead?: boolean;
    } = {}
  ): AgentToAgentMessage[] {
    const queue = this.queues.get(agentId) ?? [];
    
    let messages = queue.filter(m => {
      if (m.status === MessageStatus.EXPIRED) return false;
      if (m.expiresAt && new Date() > m.expiresAt) {
        m.status = MessageStatus.EXPIRED;
        this.emit('message:expired', m);
        return false;
      }
      if (options.types && !options.types.includes(m.type)) return false;
      if (options.minPriority !== undefined && m.priority < options.minPriority) return false;
      return true;
    });
    
    if (options.maxMessages) {
      messages = messages.slice(0, options.maxMessages);
    }
    
    // Mark as delivered/read
    for (const message of messages) {
      if (message.status === MessageStatus.PENDING) {
        message.status = MessageStatus.DELIVERED;
        this.emit('message:delivered', message);
      }
      if (options.markAsRead && message.status === MessageStatus.DELIVERED) {
        message.status = MessageStatus.READ;
        this.emit('message:read', message);
      }
    }
    
    return messages;
  }
  
  /**
   * Mark a message as processed
   */
  acknowledge(messageId: string): boolean {
    const message = this.allMessages.get(messageId);
    if (!message) return false;
    
    message.status = MessageStatus.PROCESSED;
    this.emit('message:processed', message);
    
    // Remove from queue
    const queue = this.queues.get(message.recipientId);
    if (queue) {
      const index = queue.findIndex(m => m.id === messageId);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    }
    
    return true;
  }
  
  /**
   * Subscribe to messages for an agent
   */
  subscribe(
    agentId: string,
    handler: MessageHandler,
    filter: MessageFilter = {}
  ): string {
    const subscription: Subscription = {
      id: uuidv4(),
      agentId,
      filter,
      handler,
    };
    
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, []);
    }
    this.subscriptions.get(agentId)!.push(subscription);
    
    // Ensure queue exists
    if (!this.queues.has(agentId)) {
      this.queues.set(agentId, []);
    }
    
    return subscription.id;
  }
  
  /**
   * Unsubscribe from messages
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [_agentId, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        return true;
      }
    }
    return false;
  }
  
  /**
   * Register an agent (create their queue)
   */
  registerAgent(agentId: string): void {
    if (!this.queues.has(agentId)) {
      this.queues.set(agentId, []);
    }
  }
  
  /**
   * Unregister an agent (remove their queue)
   */
  unregisterAgent(agentId: string): void {
    this.queues.delete(agentId);
    this.subscriptions.delete(agentId);
  }
  
  /**
   * Get pending message count for an agent
   */
  getPendingCount(agentId: string): number {
    const queue = this.queues.get(agentId) ?? [];
    return queue.filter(m => 
      m.status === MessageStatus.PENDING || 
      m.status === MessageStatus.DELIVERED
    ).length;
  }
  
  /**
   * Get all messages for a correlation ID (conversation thread)
   */
  getThread(correlationId: string): AgentToAgentMessage[] {
    const messages: AgentToAgentMessage[] = [];
    for (const message of this.allMessages.values()) {
      if (message.correlationId === correlationId) {
        messages.push(message);
      }
    }
    return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  /**
   * Get a specific message
   */
  getMessage(messageId: string): AgentToAgentMessage | undefined {
    return this.allMessages.get(messageId);
  }
  
  /**
   * Get all registered agents
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.queues.keys());
  }
  
  /**
   * Clear all messages for an agent
   */
  clearQueue(agentId: string): void {
    this.queues.set(agentId, []);
  }
  
  /**
   * Clear all messages
   */
  clearAll(): void {
    this.queues.clear();
    this.allMessages.clear();
  }
  
  /**
   * Get queue stats
   */
  getStats(): {
    totalMessages: number;
    pendingMessages: number;
    deliveredMessages: number;
    processedMessages: number;
    agentCount: number;
  } {
    let pending = 0;
    let delivered = 0;
    let processed = 0;
    
    for (const message of this.allMessages.values()) {
      switch (message.status) {
        case MessageStatus.PENDING:
          pending++;
          break;
        case MessageStatus.DELIVERED:
        case MessageStatus.READ:
          delivered++;
          break;
        case MessageStatus.PROCESSED:
          processed++;
          break;
      }
    }
    
    return {
      totalMessages: this.allMessages.size,
      pendingMessages: pending,
      deliveredMessages: delivered,
      processedMessages: processed,
      agentCount: this.queues.size,
    };
  }
  
  /**
   * Notify subscribers of a new message
   */
  private notifySubscribers(recipientAgentId: string, message: AgentToAgentMessage): void {
    const subs = this.subscriptions.get(recipientAgentId) ?? [];
    
    for (const sub of subs) {
      // Check filter
      if (sub.filter.senderId && message.senderId !== sub.filter.senderId) continue;
      if (sub.filter.types && !sub.filter.types.includes(message.type)) continue;
      if (sub.filter.minPriority !== undefined && message.priority < sub.filter.minPriority) continue;
      
      // Call handler (async-safe)
      try {
        const result = sub.handler(message);
        if (result instanceof Promise) {
          result.catch(err => {
            console.error(`[MessageQueue] Handler error for ${recipientAgentId}:`, err);
            this.emit('message:failed', message, err instanceof Error ? err : new Error(String(err)));
          });
        }
      } catch (err) {
        console.error(`[MessageQueue] Handler error for ${recipientAgentId}:`, err);
        this.emit('message:failed', message, err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
  
  /**
   * Start expiration checker interval
   */
  private startExpirationChecker(): void {
    this.expirationTimer = setInterval(() => {
      const now = new Date();
      for (const message of this.allMessages.values()) {
        if (
          message.expiresAt && 
          now > message.expiresAt && 
          message.status !== MessageStatus.EXPIRED &&
          message.status !== MessageStatus.PROCESSED
        ) {
          message.status = MessageStatus.EXPIRED;
          this.emit('message:expired', message);
        }
      }
    }, 1000); // Check every second
  }
  
  /**
   * Stop the queue and clean up
   */
  destroy(): void {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer);
    }
    this.removeAllListeners();
    this.clearAll();
  }
}
