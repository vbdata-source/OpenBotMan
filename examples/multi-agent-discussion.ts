#!/usr/bin/env npx ts-node

/**
 * Multi-Agent Discussion Example
 * 
 * Demonstrates how agents can discuss and reach consensus.
 */

import { Orchestrator } from '@openbotman/orchestrator';

const config = {
  orchestrator: {
    model: 'claude-sonnet-4-20250514',
    maxIterations: 10,
    agentTimeout: 120000,
    autonomous: false,
    humanApproval: false,
  },
  knowledgeBase: {
    enabled: true,
    storagePath: './data/knowledge',
    autoLearn: true,
  },
  agents: [
    {
      id: 'architect',
      name: 'Architect Agent',
      role: 'architect' as const,
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-20250514',
      systemPrompt: `You are a software architect focused on:
- System design and scalability
- Best practices and patterns
- Long-term maintainability
Argue for solutions that are clean and well-structured.`,
      capabilities: {
        code: true,
        review: true,
        filesystem: false,
        shell: false,
        web: false,
        mcp: false,
        discussion: true,
        decisions: true,
      },
      enabled: true,
    },
    {
      id: 'security',
      name: 'Security Agent',
      role: 'security' as const,
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-20250514',
      systemPrompt: `You are a security expert focused on:
- Application security
- OWASP best practices
- Threat modeling
Always consider security implications in decisions.`,
      capabilities: {
        code: false,
        review: true,
        filesystem: false,
        shell: false,
        web: false,
        mcp: false,
        discussion: true,
        decisions: true,
      },
      enabled: true,
    },
    {
      id: 'pragmatist',
      name: 'Pragmatist Agent',
      role: 'coder' as const,
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-20250514',
      systemPrompt: `You are a pragmatic developer focused on:
- Getting things done
- Simple solutions
- Developer experience
Balance idealism with practical constraints.`,
      capabilities: {
        code: true,
        review: true,
        filesystem: true,
        shell: true,
        web: false,
        mcp: false,
        discussion: true,
        decisions: true,
      },
      enabled: true,
    },
  ],
  workflows: [],
  qualityGates: [],
};

async function main() {
  console.log('Initializing OpenBotMan Multi-Agent Discussion...\n');
  
  const orchestrator = new Orchestrator(config as any);
  
  console.log('Orchestrator ready with 3 agents!\n');
  console.log('Starting discussion...\n');
  console.log('==='.repeat(20) + '\n');
  
  // Start a discussion
  const topic = 'Should we use microservices or a monolith for a new e-commerce platform?';
  
  const result = await orchestrator.createDiscussion({
    topic,
    participants: ['architect', 'security', 'pragmatist'],
    maxRounds: 3,
    consensusThreshold: 0.7,
    context: {
      teamSize: 5,
      timeline: '6 months',
      budget: 'medium',
      expectedUsers: '10,000 monthly',
    },
  });
  
  console.log('\n' + '==='.repeat(20));
  console.log('\nDiscussion Result:\n');
  console.log('Topic:', topic);
  console.log('Consensus:', result.consensus ? 'YES ✓' : 'NO ✗');
  console.log('Decision:', result.decision);
  console.log('\nVotes:', JSON.stringify(result.votes, null, 2));
  console.log('\nReasoning:', result.reasoning?.slice(0, 500) + '...');
}

main().catch(console.error);
