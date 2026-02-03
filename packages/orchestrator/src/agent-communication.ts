/**
 * Agent Communication Layer
 * 
 * High-level API for agent-to-agent communication.
 * Builds on MessageQueue to provide request/response patterns,
 * conversation channels, and typed message protocols.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { 
  MessageQueue, 
  MessagePriority,
  type AgentToAgentMessage,
  type MessageHandler,
} from './message-queue.js';

/**
 * Standard message types for agent communication
 */
export enum AgentMessageType {
  // Direct communication
  DIRECT = 'direct',
  REQUEST = 'request',
  RESPONSE = 'response',
  
  // Discussion-related
  PROPOSAL = 'proposal',
  ARGUMENT = 'argument',
  COUNTER_ARGUMENT = 'counter_argument',
  VOTE = 'vote',
  CONSENSUS = 'consensus',
  
  // Task-related
  TASK_REQUEST = 'task_request',
  TASK_ACCEPT = 'task_accept',
  TASK_DECLINE = 'task_decline',
  TASK_UPDATE = 'task_update',
  TASK_COMPLETE = 'task_complete',
  
  // Knowledge sharing
  KNOWLEDGE_SHARE = 'knowledge_share',
  KNOWLEDGE_REQUEST = 'knowledge_request',
  KNOWLEDGE_RESPONSE = 'knowledge_response',
  
  // System
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
  ACK = 'ack',
}

/**
 * Request with expected response
 */
export interface RequestOptions {
  timeoutMs?: number;
  priority?: MessagePriority;
  metadata?: Record<string, unknown>;
}

/**
 * Proposal for discussion
 */
export interface Proposal {
  id: string;
  topic: string;
  proposerId: string;
  description: string;
  options?: string[];
  context?: Record<string, unknown>;
  deadline?: Date;
}

/**
 * Argument in a discussion
 */
export interface Argument {
  proposalId: string;
  agentId: string;
  stance: 'support' | 'oppose' | 'neutral';
  reasoning: string;
  confidence: number; // 0-1
  references?: string[];
}

/**
 * Vote on a proposal
 */
export interface Vote {
  proposalId: string;
  agentId: string;
  option: string;
  weight: number; // 0-1, for weighted voting
  reasoning?: string;
}

/**
 * Agent Communication Events
 */
export interface AgentCommunicationEvents {
  'message': (message: AgentToAgentMessage) => void;
  'request': (senderId: string, type: string, payload: unknown, correlationId: string) => void;
  'response': (correlationId: string, payload: unknown) => void;
  'proposal': (proposal: Proposal) => void;
  'argument': (argument: Argument) => void;
  'vote': (vote: Vote) => void;
  'consensus': (proposalId: string, decision: string, votes: Vote[]) => void;
  'error': (error: Error, context?: unknown) => void;
}

/**
 * Pending request tracker
 */
interface PendingRequest {
  correlationId: string;
  senderId: string;
  recipientId: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Agent Communication Layer
 */
export class AgentCommunication extends EventEmitter<AgentCommunicationEvents> {
  private messageQueue: MessageQueue;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private agentHandlers: Map<string, Map<string, MessageHandler>> = new Map();
  private proposals: Map<string, Proposal> = new Map();
  private proposalArguments: Map<string, Argument[]> = new Map();
  private proposalVotes: Map<string, Vote[]> = new Map();
  
  constructor(messageQueue?: MessageQueue) {
    super();
    this.messageQueue = messageQueue ?? new MessageQueue();
    
    // Listen for messages
    this.messageQueue.on('message:queued', (message) => {
      this.handleIncomingMessage(message);
    });
    
    this.messageQueue.on('broadcast', (message) => {
      this.handleIncomingMessage(message);
    });
  }
  
  /**
   * Register an agent for communication
   */
  registerAgent(agentId: string): void {
    this.messageQueue.registerAgent(agentId);
    if (!this.agentHandlers.has(agentId)) {
      this.agentHandlers.set(agentId, new Map());
    }
  }
  
  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.messageQueue.unregisterAgent(agentId);
    this.agentHandlers.delete(agentId);
  }
  
  /**
   * Send a direct message to another agent
   */
  sendMessage(
    senderId: string,
    recipientId: string,
    content: unknown,
    options: {
      type?: AgentMessageType | string;
      priority?: MessagePriority;
      metadata?: Record<string, unknown>;
    } = {}
  ): AgentToAgentMessage {
    return this.messageQueue.send(
      senderId,
      recipientId,
      options.type ?? AgentMessageType.DIRECT,
      content,
      {
        priority: options.priority,
        metadata: options.metadata,
      }
    );
  }
  
  /**
   * Send a request and wait for response
   */
  async request(
    senderId: string,
    recipientId: string,
    payload: unknown,
    options: RequestOptions = {}
  ): Promise<unknown> {
    const correlationId = uuidv4();
    const timeoutMs = options.timeoutMs ?? 30000;
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Track pending request
      this.pendingRequests.set(correlationId, {
        correlationId,
        senderId,
        recipientId,
        resolve,
        reject,
        timer,
      });
      
      // Send request
      this.messageQueue.send(
        senderId,
        recipientId,
        AgentMessageType.REQUEST,
        payload,
        {
          priority: options.priority,
          correlationId,
          metadata: options.metadata,
        }
      );
    });
  }
  
  /**
   * Respond to a request
   */
  respond(
    responderId: string,
    correlationId: string,
    originalSenderId: string,
    payload: unknown
  ): void {
    this.messageQueue.send(
      responderId,
      originalSenderId,
      AgentMessageType.RESPONSE,
      payload,
      { correlationId }
    );
  }
  
  /**
   * Broadcast a message to all agents
   */
  broadcast(
    senderId: string,
    content: unknown,
    options: {
      type?: AgentMessageType | string;
      priority?: MessagePriority;
      excludeAgents?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): AgentToAgentMessage {
    return this.messageQueue.broadcast(
      senderId,
      options.type ?? AgentMessageType.DIRECT,
      content,
      {
        priority: options.priority,
        excludeAgents: options.excludeAgents,
        metadata: options.metadata,
      }
    );
  }
  
  /**
   * Create a proposal for discussion
   */
  createProposal(
    proposerId: string,
    topic: string,
    description: string,
    options?: {
      proposalOptions?: string[];
      context?: Record<string, unknown>;
      deadlineMs?: number;
      notifyAgents?: string[];
    }
  ): Proposal {
    const proposal: Proposal = {
      id: uuidv4(),
      topic,
      proposerId,
      description,
      options: options?.proposalOptions ?? ['Yes', 'No', 'Abstain'],
      context: options?.context,
      deadline: options?.deadlineMs ? new Date(Date.now() + options.deadlineMs) : undefined,
    };
    
    this.proposals.set(proposal.id, proposal);
    this.proposalArguments.set(proposal.id, []);
    this.proposalVotes.set(proposal.id, []);
    
    this.emit('proposal', proposal);
    
    // Broadcast proposal to agents
    if (options?.notifyAgents) {
      for (const agentId of options.notifyAgents) {
        this.sendMessage(proposerId, agentId, proposal, {
          type: AgentMessageType.PROPOSAL,
          priority: MessagePriority.HIGH,
        });
      }
    } else {
      this.broadcast(proposerId, proposal, {
        type: AgentMessageType.PROPOSAL,
        priority: MessagePriority.HIGH,
      });
    }
    
    return proposal;
  }
  
  /**
   * Submit an argument for a proposal
   */
  submitArgument(
    agentId: string,
    proposalId: string,
    stance: 'support' | 'oppose' | 'neutral',
    reasoning: string,
    options?: {
      confidence?: number;
      references?: string[];
      notifyAgents?: string[];
    }
  ): Argument | null {
    if (!this.proposals.has(proposalId)) {
      return null;
    }
    
    const argument: Argument = {
      proposalId,
      agentId,
      stance,
      reasoning,
      confidence: options?.confidence ?? 0.5,
      references: options?.references,
    };
    
    const args = this.proposalArguments.get(proposalId) ?? [];
    args.push(argument);
    this.proposalArguments.set(proposalId, args);
    
    this.emit('argument', argument);
    
    // Notify other agents
    if (options?.notifyAgents) {
      for (const notifyId of options.notifyAgents) {
        if (notifyId !== agentId) {
          this.sendMessage(agentId, notifyId, argument, {
            type: AgentMessageType.ARGUMENT,
          });
        }
      }
    } else {
      this.broadcast(agentId, argument, {
        type: AgentMessageType.ARGUMENT,
        excludeAgents: [agentId],
      });
    }
    
    return argument;
  }
  
  /**
   * Submit a counter-argument
   */
  submitCounterArgument(
    agentId: string,
    proposalId: string,
    targetArgumentIndex: number,
    reasoning: string,
    options?: {
      confidence?: number;
      references?: string[];
    }
  ): Argument | null {
    const args = this.proposalArguments.get(proposalId);
    if (!args || targetArgumentIndex >= args.length) {
      return null;
    }
    
    const targetArg = args[targetArgumentIndex];
    if (!targetArg) {
      return null;
    }
    
    // Counter-argument takes opposite stance
    const stance = targetArg.stance === 'support' ? 'oppose' : 
                   targetArg.stance === 'oppose' ? 'support' : 'neutral';
    
    const argument: Argument = {
      proposalId,
      agentId,
      stance,
      reasoning: `Counter to ${targetArg.agentId}'s argument: ${reasoning}`,
      confidence: options?.confidence ?? 0.5,
      references: options?.references,
    };
    
    args.push(argument);
    
    this.emit('argument', argument);
    
    // Notify the original arguer
    this.sendMessage(agentId, targetArg.agentId, argument, {
      type: AgentMessageType.COUNTER_ARGUMENT,
    });
    
    return argument;
  }
  
  /**
   * Cast a vote on a proposal
   */
  castVote(
    agentId: string,
    proposalId: string,
    option: string,
    options?: {
      weight?: number;
      reasoning?: string;
    }
  ): Vote | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return null;
    }
    
    // Check if valid option
    if (proposal.options && !proposal.options.includes(option)) {
      return null;
    }
    
    const vote: Vote = {
      proposalId,
      agentId,
      option,
      weight: options?.weight ?? 1,
      reasoning: options?.reasoning,
    };
    
    const votes = this.proposalVotes.get(proposalId) ?? [];
    
    // Replace existing vote from same agent
    const existingIndex = votes.findIndex(v => v.agentId === agentId);
    if (existingIndex !== -1) {
      votes[existingIndex] = vote;
    } else {
      votes.push(vote);
    }
    
    this.proposalVotes.set(proposalId, votes);
    
    this.emit('vote', vote);
    
    // Notify proposer
    if (proposal.proposerId !== agentId) {
      this.sendMessage(agentId, proposal.proposerId, vote, {
        type: AgentMessageType.VOTE,
      });
    }
    
    return vote;
  }
  
  /**
   * Calculate consensus on a proposal
   */
  calculateConsensus(
    proposalId: string,
    threshold: number = 0.5
  ): { reached: boolean; decision: string; votes: Vote[]; breakdown: Record<string, number> } | null {
    const proposal = this.proposals.get(proposalId);
    const votes = this.proposalVotes.get(proposalId);
    
    if (!proposal || !votes || votes.length === 0) {
      return null;
    }
    
    // Count weighted votes
    const breakdown: Record<string, number> = {};
    let totalWeight = 0;
    
    for (const vote of votes) {
      breakdown[vote.option] = (breakdown[vote.option] ?? 0) + vote.weight;
      totalWeight += vote.weight;
    }
    
    // Find winning option
    let winner = '';
    let maxWeight = 0;
    
    for (const [option, weight] of Object.entries(breakdown)) {
      if (weight > maxWeight) {
        maxWeight = weight;
        winner = option;
      }
    }
    
    const reached = totalWeight > 0 && (maxWeight / totalWeight) >= threshold;
    
    if (reached) {
      this.emit('consensus', proposalId, winner, votes);
      
      // Broadcast consensus
      const proposalForBroadcast = this.proposals.get(proposalId);
      if (proposalForBroadcast) {
        this.broadcast(proposalForBroadcast.proposerId, {
          proposalId,
          decision: winner,
          breakdown,
          votes,
        }, {
          type: AgentMessageType.CONSENSUS,
          priority: MessagePriority.HIGH,
        });
      }
    }
    
    return {
      reached,
      decision: winner,
      votes,
      breakdown,
    };
  }
  
  /**
   * Get proposal details
   */
  getProposal(proposalId: string): Proposal | undefined {
    return this.proposals.get(proposalId);
  }
  
  /**
   * Get arguments for a proposal
   */
  getArguments(proposalId: string): Argument[] {
    return this.proposalArguments.get(proposalId) ?? [];
  }
  
  /**
   * Get votes for a proposal
   */
  getVotes(proposalId: string): Vote[] {
    return this.proposalVotes.get(proposalId) ?? [];
  }
  
  /**
   * Register a message handler for an agent
   */
  onMessage(
    agentId: string,
    type: AgentMessageType | string,
    handler: MessageHandler
  ): void {
    if (!this.agentHandlers.has(agentId)) {
      this.agentHandlers.set(agentId, new Map());
    }
    this.agentHandlers.get(agentId)!.set(type, handler);
  }
  
  /**
   * Remove a message handler
   */
  offMessage(agentId: string, type: AgentMessageType | string): void {
    this.agentHandlers.get(agentId)?.delete(type);
  }
  
  /**
   * Get pending messages for an agent
   */
  getMessages(agentId: string, options?: {
    maxMessages?: number;
    types?: string[];
    markAsRead?: boolean;
  }): AgentToAgentMessage[] {
    return this.messageQueue.receive(agentId, options);
  }
  
  /**
   * Acknowledge a message
   */
  acknowledge(messageId: string): boolean {
    return this.messageQueue.acknowledge(messageId);
  }
  
  /**
   * Get message queue stats
   */
  getStats() {
    return this.messageQueue.getStats();
  }
  
  /**
   * Get the underlying message queue
   */
  getMessageQueue(): MessageQueue {
    return this.messageQueue;
  }
  
  /**
   * Handle incoming messages
   */
  private handleIncomingMessage(message: AgentToAgentMessage): void {
    this.emit('message', message);
    
    // Handle response to pending request
    if (message.type === AgentMessageType.RESPONSE && message.correlationId) {
      const pending = this.pendingRequests.get(message.correlationId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(message.correlationId);
        pending.resolve(message.payload);
        this.emit('response', message.correlationId, message.payload);
        return;
      }
    }
    
    // Emit request event for request messages
    if (message.type === AgentMessageType.REQUEST && message.correlationId) {
      this.emit('request', message.senderId, message.type, message.payload, message.correlationId);
    }
    
    // Call registered handlers
    if (message.recipientId !== 'broadcast') {
      const handlers = this.agentHandlers.get(message.recipientId);
      if (handlers) {
        const handler = handlers.get(message.type);
        if (handler) {
          try {
            const result = handler(message);
            if (result instanceof Promise) {
              result.catch(err => {
                this.emit('error', err instanceof Error ? err : new Error(String(err)), message);
              });
            }
          } catch (err) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)), message);
          }
        }
      }
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Communication layer destroyed'));
    }
    this.pendingRequests.clear();
    
    this.messageQueue.destroy();
    this.removeAllListeners();
  }
}
