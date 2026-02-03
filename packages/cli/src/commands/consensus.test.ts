/**
 * Tests for Consensus Engine
 */

import { describe, it, expect } from 'vitest';
import {
  extractPosition,
  extractConditions,
  extractActionItems,
  evaluateRound,
  getPositionEmoji,
  getPositionColor,
  buildProposerPrompt,
  buildResponderPrompt,
  type ConsensusContribution,
  type ConsensusPosition,
} from './consensus.js';

describe('Consensus Engine', () => {
  describe('extractPosition', () => {
    it('should extract explicit SUPPORT position', () => {
      const content = `Ich stimme dem Vorschlag zu. Die Architektur ist solide.
[POSITION: SUPPORT]`;
      
      const result = extractPosition(content);
      expect(result.position).toBe('SUPPORT');
    });

    it('should extract SUPPORT_WITH_CONDITIONS with reason', () => {
      const content = `Der Ansatz ist gut, aber wir brauchen Limits.
[POSITION: SUPPORT_WITH_CONDITIONS] - Memory-Limits müssen definiert werden`;
      
      const result = extractPosition(content);
      expect(result.position).toBe('SUPPORT_WITH_CONDITIONS');
      expect(result.reason).toBe('Memory-Limits müssen definiert werden');
    });

    it('should extract CONCERN position', () => {
      const content = `Ich habe Bedenken bezüglich der Performance.
[POSITION: CONCERN]`;
      
      const result = extractPosition(content);
      expect(result.position).toBe('CONCERN');
    });

    it('should extract OBJECTION position', () => {
      const content = `Das ist ein Sicherheitsrisiko. Ich kann dem nicht zustimmen.
[POSITION: OBJECTION] - Security-Risiko bei der Authentifizierung`;
      
      const result = extractPosition(content);
      expect(result.position).toBe('OBJECTION');
      expect(result.reason).toBe('Security-Risiko bei der Authentifizierung');
    });

    it('should extract PROPOSAL position', () => {
      const content = `Hier ist mein Vorschlag für das Caching-System.
[POSITION: PROPOSAL]`;
      
      const result = extractPosition(content);
      expect(result.position).toBe('PROPOSAL');
    });

    it('should infer OBJECTION from text content', () => {
      const content = 'Ich widerspreche diesem Ansatz. Das kann nicht funktionieren.';
      
      const result = extractPosition(content);
      expect(result.position).toBe('OBJECTION');
    });

    it('should infer CONCERN from text content', () => {
      const content = 'Ich habe Bedenken bezüglich der Skalierbarkeit.';
      
      const result = extractPosition(content);
      expect(result.position).toBe('CONCERN');
    });

    it('should infer SUPPORT from text content', () => {
      const content = 'Ich stimme zu. Das ist eine gute Idee und sollte umgesetzt werden.';
      
      const result = extractPosition(content);
      expect(result.position).toBe('SUPPORT');
    });

    it('should infer SUPPORT_WITH_CONDITIONS from text content', () => {
      const content = 'Unter der Bedingung, dass wir Tests schreiben, bin ich einverstanden.';
      
      const result = extractPosition(content);
      expect(result.position).toBe('SUPPORT_WITH_CONDITIONS');
    });

    it('should default to CONCERN for unclear content', () => {
      const content = 'Lorem ipsum dolor sit amet.';
      
      const result = extractPosition(content);
      expect(result.position).toBe('CONCERN');
      expect(result.reason).toBe('Position unclear from response');
    });
  });

  describe('extractConditions', () => {
    it('should extract German conditions', () => {
      const content = `Unter der Bedingung, dass wir Tests schreiben.
Vorausgesetzt, die API ist stabil.`;
      
      const conditions = extractConditions(content);
      expect(conditions.length).toBeGreaterThan(0);
    });

    it('should extract English conditions', () => {
      const content = `Provided that we have proper error handling.
Assuming the database is reliable.`;
      
      const conditions = extractConditions(content);
      expect(conditions.length).toBeGreaterThan(0);
    });

    it('should extract explicit condition markers', () => {
      const content = `[BEDINGUNG]: Memory muss < 512MB bleiben
[CONDITION]: Response time < 100ms`;
      
      const conditions = extractConditions(content);
      expect(conditions.some(c => c.includes('Memory'))).toBe(true);
      expect(conditions.some(c => c.includes('Response'))).toBe(true);
    });

    it('should return empty array for no conditions', () => {
      const content = 'Alles gut, keine besonderen Bedingungen.';
      
      const conditions = extractConditions(content);
      expect(conditions.length).toBe(0);
    });
  });

  describe('extractActionItems', () => {
    it('should extract checkbox items', () => {
      const content = `
- [ ] Implementiere Caching (assigned: Coder)
- [ ] Schreibe Tests (zugewiesen: Reviewer)
`;
      
      const items = extractActionItems(content);
      expect(items.length).toBe(2);
      expect(items[0]?.task).toContain('Caching');
      expect(items[0]?.assignee).toBe('Coder');
    });

    it('should extract TODO markers', () => {
      const content = `
TODO: Refactor the auth module
TASK: Update documentation
`;
      
      const items = extractActionItems(content);
      expect(items.length).toBeGreaterThan(0);
    });

    it('should return empty array for no items', () => {
      const content = 'Alles gut, keine besonderen Punkte hier. Das Projekt sieht gut aus.';
      
      const items = extractActionItems(content);
      expect(items.length).toBe(0);
    });
  });

  describe('evaluateRound', () => {
    it('should detect consensus with all SUPPORT', () => {
      const contributions: ConsensusContribution[] = [
        createContribution('planner', 'PROPOSAL'),
        createContribution('coder', 'SUPPORT'),
        createContribution('reviewer', 'SUPPORT'),
      ];
      
      const status = evaluateRound(1, 10, contributions);
      
      expect(status.consensusReached).toBe(true);
      expect(status.positionCounts['SUPPORT']).toBe(2);
    });

    it('should detect consensus with SUPPORT_WITH_CONDITIONS', () => {
      const contributions: ConsensusContribution[] = [
        createContribution('planner', 'PROPOSAL'),
        createContribution('coder', 'SUPPORT'),
        createContribution('reviewer', 'SUPPORT_WITH_CONDITIONS', 'Tests needed'),
      ];
      
      const status = evaluateRound(1, 10, contributions);
      
      expect(status.consensusReached).toBe(true);
      expect(status.conditions.length).toBeGreaterThan(0);
    });

    it('should not reach consensus with OBJECTION', () => {
      const contributions: ConsensusContribution[] = [
        createContribution('planner', 'PROPOSAL'),
        createContribution('coder', 'SUPPORT'),
        createContribution('reviewer', 'OBJECTION', 'Security risk'),
      ];
      
      const status = evaluateRound(1, 10, contributions);
      
      expect(status.consensusReached).toBe(false);
      expect(status.objections.length).toBe(1);
      expect(status.objections[0]).toContain('Security risk');
    });

    it('should allow consensus with CONCERN (non-blocking)', () => {
      const contributions: ConsensusContribution[] = [
        createContribution('planner', 'PROPOSAL'),
        createContribution('coder', 'SUPPORT'),
        createContribution('reviewer', 'CONCERN', 'Performance unclear'),
      ];
      
      const status = evaluateRound(1, 10, contributions);
      
      // CONCERN alone doesn't block, but doesn't grant consensus either
      // Only SUPPORT/SUPPORT_WITH_CONDITIONS grant consensus
      expect(status.consensusReached).toBe(false);
      expect(status.concerns.length).toBe(1);
    });

    it('should track position counts correctly', () => {
      const contributions: ConsensusContribution[] = [
        createContribution('planner', 'PROPOSAL'),
        createContribution('coder', 'SUPPORT'),
        createContribution('reviewer', 'CONCERN'),
        createContribution('architect', 'OBJECTION'),
      ];
      
      const status = evaluateRound(1, 10, contributions);
      
      expect(status.positionCounts['PROPOSAL']).toBe(1);
      expect(status.positionCounts['SUPPORT']).toBe(1);
      expect(status.positionCounts['CONCERN']).toBe(1);
      expect(status.positionCounts['OBJECTION']).toBe(1);
    });
  });

  describe('getPositionEmoji', () => {
    it('should return correct emojis', () => {
      expect(getPositionEmoji('PROPOSAL')).toBe('💡');
      expect(getPositionEmoji('SUPPORT')).toBe('✅');
      expect(getPositionEmoji('SUPPORT_WITH_CONDITIONS')).toBe('☑️');
      expect(getPositionEmoji('CONCERN')).toBe('⚠️');
      expect(getPositionEmoji('OBJECTION')).toBe('🚫');
    });
  });

  describe('buildProposerPrompt', () => {
    it('should build initial proposal prompt for round 1', () => {
      const prompt = buildProposerPrompt('Caching implementieren', 1);
      
      expect(prompt).toContain('Caching implementieren');
      expect(prompt).toContain('initialen Vorschlag');
      expect(prompt).toContain('[POSITION: PROPOSAL]');
    });

    it('should build revision prompt for subsequent rounds', () => {
      const previousRound = {
        round: 1,
        maxRounds: 10,
        contributions: [],
        positionCounts: {} as Record<ConsensusPosition, number>,
        consensusReached: false,
        objections: ['Security issue'],
        concerns: ['Performance'],
        conditions: [],
      };
      
      const prompt = buildProposerPrompt('Caching implementieren', 2, previousRound);
      
      expect(prompt).toContain('Runde 2');
      expect(prompt).toContain('ÜBERARBEITETEN');
      expect(prompt).toContain('Security issue');
      expect(prompt).toContain('Performance');
    });
  });

  describe('buildResponderPrompt', () => {
    it('should build responder prompt with proposal', () => {
      const proposal = createContribution('planner', 'PROPOSAL');
      proposal.content = 'Wir sollten Redis verwenden.';
      
      const prompt = buildResponderPrompt('Caching', 1, proposal, [], 'coder');
      
      expect(prompt).toContain('Caching');
      expect(prompt).toContain('Redis');
      expect(prompt).toContain('coder');
      expect(prompt).toContain('[POSITION: SUPPORT]');
    });

    it('should include previous responses', () => {
      const proposal = createContribution('planner', 'PROPOSAL');
      const prevResponse = createContribution('coder', 'CONCERN');
      prevResponse.content = 'Was ist mit Memory?';
      
      const prompt = buildResponderPrompt('Caching', 1, proposal, [prevResponse], 'reviewer');
      
      expect(prompt).toContain('Memory');
      expect(prompt).toContain('Bisherige Reaktionen');
    });
  });
});

// Helper function to create test contributions
function createContribution(
  agentId: string,
  position: ConsensusPosition,
  reason?: string
): ConsensusContribution {
  return {
    agentId,
    agentName: agentId.charAt(0).toUpperCase() + agentId.slice(1),
    role: agentId,
    model: 'test-model',
    provider: 'mock',
    emoji: '🤖',
    content: `Test content for ${agentId}`,
    position,
    positionReason: reason,
    timestamp: new Date(),
  };
}
