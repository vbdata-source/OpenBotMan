/**
 * Discussion Engine
 * 
 * Enables structured discussions between agents.
 * Supports consensus building and voting.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type { 
  DiscussionRoom, 
  DiscussionMessage, 
  OrchestratorEvents 
} from './types.js';
import type { AgentRunner } from './agent-runner.js';

/**
 * Discussion options
 */
export interface DiscussionOptions {
  topic: string;
  participants: string[];
  moderator?: string;
  maxRounds?: number;
  consensusThreshold?: number;
  deadline?: Date;
  context?: Record<string, unknown>;
}

/**
 * Discussion result
 */
export interface DiscussionResult {
  room: DiscussionRoom;
  consensus: boolean;
  decision?: string;
  votes: Record<string, string>;
  reasoning?: string;
}

/**
 * Discussion Engine
 */
export class DiscussionEngine extends EventEmitter<OrchestratorEvents> {
  private rooms: Map<string, DiscussionRoom> = new Map();
  private agentRunner: AgentRunner;
  
  constructor(agentRunner: AgentRunner) {
    super();
    this.agentRunner = agentRunner;
  }
  
  /**
   * Start a new discussion
   */
  async startDiscussion(options: DiscussionOptions): Promise<DiscussionRoom> {
    const room: DiscussionRoom = {
      id: uuidv4(),
      topic: options.topic,
      participants: options.participants,
      moderator: options.moderator ?? 'orchestrator',
      round: 0,
      maxRounds: options.maxRounds ?? 5,
      consensusThreshold: options.consensusThreshold ?? 0.8,
      transcript: [],
      votes: {},
      status: 'open',
      createdAt: new Date(),
    };
    
    this.rooms.set(room.id, room);
    this.emit('discussion:started', room);
    
    return room;
  }
  
  /**
   * Run discussion until consensus or max rounds
   */
  async runDiscussion(
    roomId: string,
    initialContext?: Record<string, unknown>
  ): Promise<DiscussionResult> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Discussion room not found: ${roomId}`);
    }
    
    // Run discussion rounds
    while (room.round < room.maxRounds && room.status === 'open') {
      room.round++;
      
      // Get opinions from all participants
      for (const agentId of room.participants) {
        const message = await this.getAgentOpinion(room, agentId, initialContext);
        room.transcript.push(message);
        this.emit('discussion:message', room, message);
      }
      
      // Check for consensus
      if (await this.checkConsensus(room)) {
        room.status = 'consensus';
        break;
      }
      
      // If last round and no consensus, move to voting
      if (room.round >= room.maxRounds) {
        room.status = 'voting';
        await this.runVoting(room);
      }
    }
    
    // Determine final decision
    if (room.status === 'consensus') {
      room.decision = this.extractConsensusDecision(room);
    } else if (room.status === 'voting') {
      room.decision = this.extractVotingDecision(room);
    } else {
      room.status = 'deadlock';
    }
    
    room.closedAt = new Date();
    this.emit('discussion:consensus', room, room.decision ?? 'No decision');
    
    return {
      room,
      consensus: room.status === 'consensus',
      decision: room.decision,
      votes: room.votes,
      reasoning: this.summarizeDiscussion(room),
    };
  }
  
  /**
   * Get an agent's opinion on the topic
   */
  private async getAgentOpinion(
    room: DiscussionRoom,
    agentId: string,
    context?: Record<string, unknown>
  ): Promise<DiscussionMessage> {
    const agent = this.agentRunner.getAgent(agentId);
    if (!agent) {
      return {
        agentId,
        round: room.round,
        type: 'opinion',
        content: '[Agent not available]',
        timestamp: new Date(),
      };
    }
    
    // Build prompt with previous opinions
    const previousOpinions = room.transcript
      .filter(m => m.round === room.round - 1)
      .map(m => `${m.agentId}: ${m.content}`)
      .join('\n\n');
    
    const prompt = `
You are participating in a team discussion about: "${room.topic}"

${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

${previousOpinions ? `Previous round opinions:\n${previousOpinions}` : 'This is the first round.'}

Please share your opinion on this topic. Be concise but thorough.
Consider different perspectives and provide your stance.

Format your response as:
STANCE: [support/oppose/neutral]
CONFIDENCE: [0-100]%
OPINION: [Your detailed opinion]
    `.trim();
    
    const result = await this.agentRunner.execute(agentId, prompt, context);
    
    // Parse response
    const stanceMatch = result.response.match(/STANCE:\s*(support|oppose|neutral)/i);
    const confidenceMatch = result.response.match(/CONFIDENCE:\s*(\d+)/);
    const opinionMatch = result.response.match(/OPINION:\s*([\s\S]*?)(?:$)/i);
    
    const message: DiscussionMessage = {
      agentId,
      round: room.round,
      type: 'opinion',
      content: opinionMatch?.[1]?.trim() ?? result.response,
      timestamp: new Date(),
    };
    
    const stanceValue = stanceMatch?.[1]?.toLowerCase();
    if (stanceValue === 'support' || stanceValue === 'oppose' || stanceValue === 'neutral') {
      message.stance = stanceValue;
    }
    
    if (confidenceMatch && confidenceMatch[1]) {
      message.confidence = parseInt(confidenceMatch[1]) / 100;
    }
    
    return message;
  }
  
  /**
   * Check if consensus has been reached
   */
  private checkConsensus(room: DiscussionRoom): boolean {
    const currentRoundOpinions = room.transcript.filter(m => m.round === room.round);
    
    // Count stances
    const stances: Record<string, number> = { support: 0, oppose: 0, neutral: 0 };
    for (const opinion of currentRoundOpinions) {
      if (opinion.stance) {
        stances[opinion.stance] = (stances[opinion.stance] ?? 0) + 1;
      }
    }
    
    const total = currentRoundOpinions.length;
    if (total === 0) return false;
    
    // Check if any stance has super-majority
    const maxStance = Math.max(stances['support'] ?? 0, stances['oppose'] ?? 0);
    return maxStance / total >= room.consensusThreshold;
  }
  
  /**
   * Run formal voting round
   */
  private async runVoting(room: DiscussionRoom): Promise<void> {
    // Extract options from discussion
    const options = this.extractOptions(room);
    
    for (const agentId of room.participants) {
      const prompt = `
Based on our discussion about "${room.topic}", please cast your final vote.

Options:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Respond with just the number of your choice.
      `.trim();
      
      const result = await this.agentRunner.execute(agentId, prompt);
      
      // Parse vote
      const voteMatch = result.response.match(/\d+/);
      if (voteMatch && voteMatch[0]) {
        const voteIndex = parseInt(voteMatch[0]) - 1;
        const selectedOption = options[voteIndex];
        if (voteIndex >= 0 && voteIndex < options.length && selectedOption) {
          room.votes[agentId] = selectedOption;
        }
      }
      
      const voteContent = room.votes[agentId];
      room.transcript.push({
        agentId,
        round: room.round,
        type: 'vote',
        content: voteContent ?? 'Abstain',
        timestamp: new Date(),
      });
    }
  }
  
  /**
   * Extract options from discussion
   */
  private extractOptions(room: DiscussionRoom): string[] {
    // Simple extraction - in practice would use NLP
    const options = new Set<string>();
    
    // Look for "Option:" or numbered lists
    for (const msg of room.transcript) {
      const matches = msg.content.matchAll(/(?:option|choice|proposal)\s*(?:\d+)?[:\s]+([^\n]+)/gi);
      for (const match of matches) {
        const option = match[1];
        if (option) {
          options.add(option.trim());
        }
      }
    }
    
    // Fallback to topic variants
    if (options.size === 0) {
      return ['Yes', 'No', 'Need more discussion'];
    }
    
    return Array.from(options);
  }
  
  /**
   * Extract consensus decision
   */
  private extractConsensusDecision(room: DiscussionRoom): string {
    const lastRound = room.transcript.filter(m => m.round === room.round);
    
    // Find the dominant stance
    const stances: Record<string, number> = { support: 0, oppose: 0, neutral: 0 };
    for (const msg of lastRound) {
      if (msg.stance) {
        stances[msg.stance] = (stances[msg.stance] ?? 0) + 1;
      }
    }
    
    const supportCount = stances['support'] ?? 0;
    const opposeCount = stances['oppose'] ?? 0;
    
    if (supportCount > opposeCount) {
      return `Approved: ${room.topic}`;
    } else if (opposeCount > supportCount) {
      return `Rejected: ${room.topic}`;
    }
    
    return `Inconclusive: ${room.topic}`;
  }
  
  /**
   * Extract decision from voting
   */
  private extractVotingDecision(room: DiscussionRoom): string {
    const voteCounts: Record<string, number> = {};
    
    for (const vote of Object.values(room.votes)) {
      voteCounts[vote] = (voteCounts[vote] ?? 0) + 1;
    }
    
    // Find winner
    let winner = '';
    let maxVotes = 0;
    for (const [option, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        winner = option;
        maxVotes = count;
      }
    }
    
    return winner || 'No decision';
  }
  
  /**
   * Summarize discussion
   */
  private summarizeDiscussion(room: DiscussionRoom): string {
    const lines: string[] = [
      `Discussion: ${room.topic}`,
      `Rounds: ${room.round}/${room.maxRounds}`,
      `Status: ${room.status}`,
      `Decision: ${room.decision ?? 'None'}`,
      '',
      'Transcript Summary:',
    ];
    
    for (let round = 1; round <= room.round; round++) {
      lines.push(`\n--- Round ${round} ---`);
      const roundMsgs = room.transcript.filter(m => m.round === round);
      for (const msg of roundMsgs) {
        const stance = msg.stance ? ` [${msg.stance}]` : '';
        lines.push(`${msg.agentId}${stance}: ${msg.content.slice(0, 100)}...`);
      }
    }
    
    if (Object.keys(room.votes).length > 0) {
      lines.push('\n--- Votes ---');
      for (const [agent, vote] of Object.entries(room.votes)) {
        lines.push(`${agent}: ${vote}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Get discussion room
   */
  getRoom(roomId: string): DiscussionRoom | undefined {
    return this.rooms.get(roomId);
  }
  
  /**
   * List active discussions
   */
  listActiveDiscussions(): DiscussionRoom[] {
    return Array.from(this.rooms.values())
      .filter(r => r.status === 'open' || r.status === 'voting');
  }
  
  /**
   * Add message to discussion
   */
  addMessage(roomId: string, message: DiscussionMessage): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.transcript.push(message);
      this.emit('discussion:message', room, message);
    }
  }
  
  /**
   * Close discussion
   */
  closeDiscussion(roomId: string, decision?: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.status = 'closed';
      room.decision = decision;
      room.closedAt = new Date();
    }
  }
}
