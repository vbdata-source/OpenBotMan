/**
 * Enhanced Discussion Engine
 * 
 * Extends the base DiscussionEngine with:
 * - Structured discussions (Proposal → Arguments → Consensus)
 * - Voting mechanism with weights
 * - Timeout handling
 * - Moderator role (Orchestrator)
 * - CLI streaming support
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import { 
  AgentCommunication,
  type Proposal,
  type Argument,
  type Vote,
} from './agent-communication.js';
import type { AgentRunner } from './agent-runner.js';

/**
 * Discussion phase
 */
export enum DiscussionPhase {
  PROPOSAL = 'proposal',
  ARGUMENT = 'argument',
  VOTING = 'voting',
  CONSENSUS = 'consensus',
  TIMEOUT = 'timeout',
  CLOSED = 'closed',
}

/**
 * Enhanced discussion room
 */
export interface EnhancedDiscussionRoom {
  id: string;
  topic: string;
  description: string;
  participants: string[];
  moderatorId: string;
  phase: DiscussionPhase;
  proposal: Proposal;
  arguments: Argument[];
  votes: Vote[];
  decision?: string;
  consensus?: {
    reached: boolean;
    decision: string;
    breakdown: Record<string, number>;
  };
  options: string[];
  consensusThreshold: number;
  timeoutMs: number;
  startedAt: Date;
  phaseStartedAt: Date;
  closedAt?: Date;
  transcript: DiscussionEntry[];
}

/**
 * Discussion transcript entry
 */
export interface DiscussionEntry {
  timestamp: Date;
  phase: DiscussionPhase;
  agentId: string;
  type: 'proposal' | 'argument' | 'counter_argument' | 'vote' | 'moderator' | 'consensus' | 'timeout';
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced discussion options
 */
export interface EnhancedDiscussionOptions {
  topic: string;
  description: string;
  participants: string[];
  moderatorId?: string;
  options?: string[];
  consensusThreshold?: number;
  argumentTimeoutMs?: number;
  votingTimeoutMs?: number;
  totalTimeoutMs?: number;
  context?: Record<string, unknown>;
  autoRun?: boolean;
}

/**
 * Enhanced Discussion Events
 */
export interface EnhancedDiscussionEvents {
  'discussion:created': (room: EnhancedDiscussionRoom) => void;
  'discussion:phase': (room: EnhancedDiscussionRoom, phase: DiscussionPhase) => void;
  'discussion:entry': (room: EnhancedDiscussionRoom, entry: DiscussionEntry) => void;
  'discussion:argument': (room: EnhancedDiscussionRoom, argument: Argument) => void;
  'discussion:vote': (room: EnhancedDiscussionRoom, vote: Vote) => void;
  'discussion:consensus': (room: EnhancedDiscussionRoom, decision: string) => void;
  'discussion:timeout': (room: EnhancedDiscussionRoom, phase: DiscussionPhase) => void;
  'discussion:closed': (room: EnhancedDiscussionRoom) => void;
}

/**
 * Enhanced Discussion Engine
 */
export class EnhancedDiscussionEngine extends EventEmitter<EnhancedDiscussionEvents> {
  private rooms: Map<string, EnhancedDiscussionRoom> = new Map();
  private agentCommunication: AgentCommunication;
  private agentRunner?: AgentRunner;
  private timeoutTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  
  constructor(agentCommunication: AgentCommunication, agentRunner?: AgentRunner) {
    super();
    this.agentCommunication = agentCommunication;
    this.agentRunner = agentRunner;
    
    // Note: We don't listen to communication events here because
    // submitArgument and submitVote handle adding to room directly.
    // Listening would cause duplicates.
  }
  
  /**
   * Create a new enhanced discussion
   */
  createDiscussion(options: EnhancedDiscussionOptions): EnhancedDiscussionRoom {
    const proposal = this.agentCommunication.createProposal(
      options.moderatorId ?? 'orchestrator',
      options.topic,
      options.description,
      {
        proposalOptions: options.options ?? ['Approve', 'Reject', 'Need more info'],
        context: options.context,
        deadlineMs: options.totalTimeoutMs,
        notifyAgents: options.participants,
      }
    );
    
    const room: EnhancedDiscussionRoom = {
      id: uuidv4(),
      topic: options.topic,
      description: options.description,
      participants: options.participants,
      moderatorId: options.moderatorId ?? 'orchestrator',
      phase: DiscussionPhase.PROPOSAL,
      proposal,
      arguments: [],
      votes: [],
      options: options.options ?? ['Approve', 'Reject', 'Need more info'],
      consensusThreshold: options.consensusThreshold ?? 0.6,
      timeoutMs: options.totalTimeoutMs ?? 300000, // 5 minutes default
      startedAt: new Date(),
      phaseStartedAt: new Date(),
      transcript: [],
    };
    
    this.rooms.set(room.id, room);
    
    // Add proposal to transcript
    this.addTranscriptEntry(room, {
      timestamp: new Date(),
      phase: DiscussionPhase.PROPOSAL,
      agentId: room.moderatorId,
      type: 'proposal',
      content: `Proposal: ${options.topic}\n\n${options.description}`,
      metadata: { proposalId: proposal.id, options: room.options },
    });
    
    this.emit('discussion:created', room);
    
    return room;
  }
  
  /**
   * Start the argument phase
   */
  async startArgumentPhase(
    roomId: string,
    timeoutMs?: number
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== DiscussionPhase.PROPOSAL) {
      return;
    }
    
    room.phase = DiscussionPhase.ARGUMENT;
    room.phaseStartedAt = new Date();
    
    this.addTranscriptEntry(room, {
      timestamp: new Date(),
      phase: DiscussionPhase.ARGUMENT,
      agentId: room.moderatorId,
      type: 'moderator',
      content: 'Argument phase started. Please share your perspectives.',
    });
    
    this.emit('discussion:phase', room, DiscussionPhase.ARGUMENT);
    
    // Set timeout for argument phase
    const timeout = timeoutMs ?? 60000; // 1 minute default
    this.setPhaseTimeout(roomId, timeout, async () => {
      await this.startVotingPhase(roomId);
    });
    
    // If we have an agent runner, prompt agents for arguments
    if (this.agentRunner) {
      await this.promptAgentsForArguments(room);
    }
  }
  
  /**
   * Start the voting phase
   */
  async startVotingPhase(
    roomId: string,
    timeoutMs?: number
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || room.phase === DiscussionPhase.VOTING || 
        room.phase === DiscussionPhase.CONSENSUS || 
        room.phase === DiscussionPhase.CLOSED) {
      return;
    }
    
    // Clear argument phase timeout
    this.clearPhaseTimeout(roomId);
    
    room.phase = DiscussionPhase.VOTING;
    room.phaseStartedAt = new Date();
    
    // Summarize arguments
    const argSummary = this.summarizeArguments(room);
    
    this.addTranscriptEntry(room, {
      timestamp: new Date(),
      phase: DiscussionPhase.VOTING,
      agentId: room.moderatorId,
      type: 'moderator',
      content: `Voting phase started.\n\nArgument Summary:\n${argSummary}\n\nOptions: ${room.options.join(', ')}`,
    });
    
    this.emit('discussion:phase', room, DiscussionPhase.VOTING);
    
    // Set timeout for voting phase
    const timeout = timeoutMs ?? 30000; // 30 seconds default
    this.setPhaseTimeout(roomId, timeout, async () => {
      await this.finalizeDiscussion(roomId);
    });
    
    // If we have an agent runner, prompt agents for votes
    if (this.agentRunner) {
      await this.promptAgentsForVotes(room);
    }
  }
  
  /**
   * Submit an argument in the discussion
   */
  submitArgument(
    roomId: string,
    agentId: string,
    stance: 'support' | 'oppose' | 'neutral',
    reasoning: string,
    confidence?: number
  ): Argument | null {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== DiscussionPhase.ARGUMENT) {
      return null;
    }
    
    if (!room.participants.includes(agentId)) {
      return null;
    }
    
    const argument = this.agentCommunication.submitArgument(
      agentId,
      room.proposal.id,
      stance,
      reasoning,
      { confidence, notifyAgents: room.participants }
    );
    
    if (argument) {
      room.arguments.push(argument);
      
      this.addTranscriptEntry(room, {
        timestamp: new Date(),
        phase: DiscussionPhase.ARGUMENT,
        agentId,
        type: 'argument',
        content: `[${stance.toUpperCase()}] ${reasoning}`,
        metadata: { confidence: argument.confidence },
      });
      
      this.emit('discussion:argument', room, argument);
    }
    
    return argument;
  }
  
  /**
   * Submit a vote in the discussion
   */
  submitVote(
    roomId: string,
    agentId: string,
    option: string,
    reasoning?: string
  ): Vote | null {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== DiscussionPhase.VOTING) {
      return null;
    }
    
    if (!room.participants.includes(agentId)) {
      return null;
    }
    
    if (!room.options.includes(option)) {
      return null;
    }
    
    const vote = this.agentCommunication.castVote(
      agentId,
      room.proposal.id,
      option,
      { reasoning }
    );
    
    if (vote) {
      // Update or add vote
      const existingIndex = room.votes.findIndex(v => v.agentId === agentId);
      if (existingIndex !== -1) {
        room.votes[existingIndex] = vote;
      } else {
        room.votes.push(vote);
      }
      
      this.addTranscriptEntry(room, {
        timestamp: new Date(),
        phase: DiscussionPhase.VOTING,
        agentId,
        type: 'vote',
        content: `Voted: ${option}${reasoning ? ` - ${reasoning}` : ''}`,
      });
      
      this.emit('discussion:vote', room, vote);
      
      // Check if all participants have voted
      if (room.votes.length >= room.participants.length) {
        this.finalizeDiscussion(roomId);
      }
    }
    
    return vote;
  }
  
  /**
   * Finalize the discussion and determine consensus
   */
  async finalizeDiscussion(roomId: string): Promise<EnhancedDiscussionRoom | null> {
    const room = this.rooms.get(roomId);
    if (!room || room.phase === DiscussionPhase.CLOSED) {
      return null;
    }
    
    // Clear any pending timeouts
    this.clearPhaseTimeout(roomId);
    
    // Calculate consensus
    const result = this.agentCommunication.calculateConsensus(
      room.proposal.id,
      room.consensusThreshold
    );
    
    if (result) {
      room.consensus = {
        reached: result.reached,
        decision: result.decision,
        breakdown: result.breakdown,
      };
      room.decision = result.decision;
      room.phase = result.reached ? DiscussionPhase.CONSENSUS : DiscussionPhase.TIMEOUT;
    } else {
      room.phase = DiscussionPhase.TIMEOUT;
    }
    
    room.closedAt = new Date();
    
    // Add final transcript entry
    if (result?.reached) {
      this.addTranscriptEntry(room, {
        timestamp: new Date(),
        phase: DiscussionPhase.CONSENSUS,
        agentId: room.moderatorId,
        type: 'consensus',
        content: `Consensus reached: ${result.decision}\n\nVote breakdown: ${JSON.stringify(result.breakdown)}`,
        metadata: { breakdown: result.breakdown },
      });
      
      this.emit('discussion:consensus', room, result.decision);
    } else {
      this.addTranscriptEntry(room, {
        timestamp: new Date(),
        phase: DiscussionPhase.TIMEOUT,
        agentId: room.moderatorId,
        type: 'timeout',
        content: `No consensus reached. Votes: ${JSON.stringify(result?.breakdown ?? {})}`,
        metadata: { breakdown: result?.breakdown },
      });
      
      this.emit('discussion:timeout', room, room.phase);
    }
    
    room.phase = DiscussionPhase.CLOSED;
    this.emit('discussion:closed', room);
    
    return room;
  }
  
  /**
   * Run a complete discussion automatically
   */
  async runDiscussion(
    options: EnhancedDiscussionOptions,
    callbacks?: {
      onPhase?: (phase: DiscussionPhase) => void;
      onEntry?: (entry: DiscussionEntry) => void;
      onConsensus?: (decision: string) => void;
    }
  ): Promise<EnhancedDiscussionRoom> {
    const room = this.createDiscussion(options);
    
    // Set up callbacks
    if (callbacks) {
      const phaseHandler = (r: EnhancedDiscussionRoom, phase: DiscussionPhase) => {
        if (r.id === room.id && callbacks.onPhase) {
          callbacks.onPhase(phase);
        }
      };
      
      const entryHandler = (r: EnhancedDiscussionRoom, entry: DiscussionEntry) => {
        if (r.id === room.id && callbacks.onEntry) {
          callbacks.onEntry(entry);
        }
      };
      
      const consensusHandler = (r: EnhancedDiscussionRoom, decision: string) => {
        if (r.id === room.id && callbacks.onConsensus) {
          callbacks.onConsensus(decision);
        }
      };
      
      this.on('discussion:phase', phaseHandler);
      this.on('discussion:entry', entryHandler);
      this.on('discussion:consensus', consensusHandler);
    }
    
    // Start argument phase
    await this.startArgumentPhase(room.id, options.argumentTimeoutMs);
    
    // Wait for completion
    return new Promise((resolve) => {
      const checkClosed = () => {
        const updatedRoom = this.rooms.get(room.id);
        if (updatedRoom?.phase === DiscussionPhase.CLOSED) {
          resolve(updatedRoom);
        } else {
          setTimeout(checkClosed, 100);
        }
      };
      
      // Set total timeout
      setTimeout(() => {
        const updatedRoom = this.rooms.get(room.id);
        if (updatedRoom && updatedRoom.phase !== DiscussionPhase.CLOSED) {
          this.finalizeDiscussion(room.id).then(() => {
            resolve(this.rooms.get(room.id)!);
          });
        }
      }, options.totalTimeoutMs ?? 300000);
      
      checkClosed();
    });
  }
  
  /**
   * Get a discussion room
   */
  getRoom(roomId: string): EnhancedDiscussionRoom | undefined {
    return this.rooms.get(roomId);
  }
  
  /**
   * Get all active discussions
   */
  getActiveDiscussions(): EnhancedDiscussionRoom[] {
    return Array.from(this.rooms.values())
      .filter(r => r.phase !== DiscussionPhase.CLOSED);
  }
  
  /**
   * Get discussion transcript
   */
  getTranscript(roomId: string): DiscussionEntry[] {
    return this.rooms.get(roomId)?.transcript ?? [];
  }
  
  /**
   * Format transcript for CLI display
   */
  formatTranscriptForCLI(roomId: string, useColors: boolean = true): string {
    const room = this.rooms.get(roomId);
    if (!room) return '';
    
    const colors: Record<string, string> = {
      orchestrator: '\x1b[35m', // Magenta
      agent1: '\x1b[36m', // Cyan
      agent2: '\x1b[33m', // Yellow
      agent3: '\x1b[32m', // Green
      agent4: '\x1b[34m', // Blue
    };
    const reset = '\x1b[0m';
    
    const lines: string[] = [
      useColors ? `\x1b[1m=== Discussion: ${room.topic} ===\x1b[0m` : `=== Discussion: ${room.topic} ===`,
      '',
    ];
    
    let colorIndex = 0;
    const agentColors: Record<string, string> = {};
    
    for (const entry of room.transcript) {
      // Assign color to agent
      if (!agentColors[entry.agentId]) {
        const colorKeys = Object.keys(colors);
        agentColors[entry.agentId] = colors[colorKeys[colorIndex % colorKeys.length]!] ?? '';
        colorIndex++;
      }
      
      const color = useColors ? agentColors[entry.agentId] : '';
      const timestamp = entry.timestamp.toISOString().slice(11, 19);
      const agentName = entry.agentId.toUpperCase();
      
      let prefix = '';
      switch (entry.type) {
        case 'proposal':
          prefix = '📋 ';
          break;
        case 'argument':
          prefix = '💬 ';
          break;
        case 'counter_argument':
          prefix = '⚡ ';
          break;
        case 'vote':
          prefix = '🗳️  ';
          break;
        case 'moderator':
          prefix = '👤 ';
          break;
        case 'consensus':
          prefix = '✅ ';
          break;
        case 'timeout':
          prefix = '⏰ ';
          break;
      }
      
      const line = useColors
        ? `${color}[${timestamp}] ${prefix}${agentName}:${reset} ${entry.content}`
        : `[${timestamp}] ${prefix}${agentName}: ${entry.content}`;
      
      lines.push(line);
    }
    
    if (room.consensus) {
      lines.push('');
      lines.push(useColors ? '\x1b[1m--- Result ---\x1b[0m' : '--- Result ---');
      lines.push(`Decision: ${room.consensus.decision}`);
      lines.push(`Consensus: ${room.consensus.reached ? 'Yes' : 'No'}`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Allow user to inject a message into the discussion
   */
  injectUserMessage(
    roomId: string,
    userId: string,
    message: string,
    asArgument?: { stance: 'support' | 'oppose' | 'neutral' }
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    if (asArgument && room.phase === DiscussionPhase.ARGUMENT) {
      // Add as argument
      const argument: Argument = {
        proposalId: room.proposal.id,
        agentId: userId,
        stance: asArgument.stance,
        reasoning: message,
        confidence: 1.0, // User input is high confidence
      };
      
      room.arguments.push(argument);
      
      this.addTranscriptEntry(room, {
        timestamp: new Date(),
        phase: room.phase,
        agentId: userId,
        type: 'argument',
        content: `[USER - ${asArgument.stance.toUpperCase()}] ${message}`,
        metadata: { isUser: true },
      });
    } else {
      // Add as moderator message
      this.addTranscriptEntry(room, {
        timestamp: new Date(),
        phase: room.phase,
        agentId: userId,
        type: 'moderator',
        content: `[USER INPUT] ${message}`,
        metadata: { isUser: true },
      });
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    for (const timer of this.timeoutTimers.values()) {
      clearTimeout(timer);
    }
    this.timeoutTimers.clear();
    this.removeAllListeners();
  }
  
  // Private methods
  
  private addTranscriptEntry(room: EnhancedDiscussionRoom, entry: DiscussionEntry): void {
    room.transcript.push(entry);
    this.emit('discussion:entry', room, entry);
  }
  
  private setPhaseTimeout(roomId: string, timeoutMs: number, callback: () => void): void {
    this.clearPhaseTimeout(roomId);
    
    const timer = setTimeout(callback, timeoutMs);
    this.timeoutTimers.set(roomId, timer);
  }
  
  private clearPhaseTimeout(roomId: string): void {
    const timer = this.timeoutTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(roomId);
    }
  }
  
  private summarizeArguments(room: EnhancedDiscussionRoom): string {
    const support = room.arguments.filter(a => a.stance === 'support');
    const oppose = room.arguments.filter(a => a.stance === 'oppose');
    const neutral = room.arguments.filter(a => a.stance === 'neutral');
    
    const lines: string[] = [];
    
    if (support.length > 0) {
      lines.push(`Supporting (${support.length}):`);
      for (const arg of support) {
        lines.push(`  - ${arg.agentId}: ${arg.reasoning.slice(0, 100)}...`);
      }
    }
    
    if (oppose.length > 0) {
      lines.push(`Opposing (${oppose.length}):`);
      for (const arg of oppose) {
        lines.push(`  - ${arg.agentId}: ${arg.reasoning.slice(0, 100)}...`);
      }
    }
    
    if (neutral.length > 0) {
      lines.push(`Neutral (${neutral.length}):`);
      for (const arg of neutral) {
        lines.push(`  - ${arg.agentId}: ${arg.reasoning.slice(0, 100)}...`);
      }
    }
    
    return lines.join('\n') || 'No arguments submitted.';
  }
  
  private async promptAgentsForArguments(room: EnhancedDiscussionRoom): Promise<void> {
    if (!this.agentRunner) return;
    
    for (const agentId of room.participants) {
      const agent = this.agentRunner.getAgent(agentId);
      if (!agent) continue;
      
      const prompt = `
You are participating in a team discussion about: "${room.topic}"

${room.description}

Please share your opinion. Format your response as:
STANCE: [support/oppose/neutral]
CONFIDENCE: [0-100]%
REASONING: [Your detailed reasoning]

Keep it concise but thoughtful.
      `.trim();
      
      try {
        const result = await this.agentRunner.execute(agentId, prompt, { discussion: room.topic });
        
        // Parse response
        const stanceMatch = result.response.match(/STANCE:\s*(support|oppose|neutral)/i);
        const confidenceMatch = result.response.match(/CONFIDENCE:\s*(\d+)/);
        const reasoningMatch = result.response.match(/REASONING:\s*([\s\S]*?)(?:$)/i);
        
        const stanceValue = stanceMatch?.[1]?.toLowerCase();
        const stance = stanceValue === 'support' || stanceValue === 'oppose' || stanceValue === 'neutral' 
          ? stanceValue 
          : 'neutral';
        const confidence = confidenceMatch?.[1] ? parseInt(confidenceMatch[1]) / 100 : 0.5;
        const reasoning = reasoningMatch?.[1]?.trim() ?? result.response;
        
        this.submitArgument(room.id, agentId, stance, reasoning, confidence);
      } catch (error) {
        console.error(`[Discussion] Error getting argument from ${agentId}:`, error);
      }
    }
  }
  
  private async promptAgentsForVotes(room: EnhancedDiscussionRoom): Promise<void> {
    if (!this.agentRunner) return;
    
    const argSummary = this.summarizeArguments(room);
    
    for (const agentId of room.participants) {
      const agent = this.agentRunner.getAgent(agentId);
      if (!agent) continue;
      
      const prompt = `
Based on the discussion about "${room.topic}", please cast your vote.

Arguments summary:
${argSummary}

Options: ${room.options.join(', ')}

Respond with:
VOTE: [your chosen option]
REASONING: [brief reasoning]
      `.trim();
      
      try {
        const result = await this.agentRunner.execute(agentId, prompt, { discussion: room.topic });
        
        // Parse vote
        const voteMatch = result.response.match(/VOTE:\s*([^\n]+)/i);
        const reasoningMatch = result.response.match(/REASONING:\s*([\s\S]*?)(?:$)/i);
        
        if (voteMatch?.[1]) {
          const votedOption = room.options.find(o => 
            o.toLowerCase() === voteMatch[1]?.trim().toLowerCase()
          );
          
          if (votedOption) {
            this.submitVote(room.id, agentId, votedOption, reasoningMatch?.[1]?.trim());
          }
        }
      } catch (error) {
        console.error(`[Discussion] Error getting vote from ${agentId}:`, error);
      }
    }
  }
}
