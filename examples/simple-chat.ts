#!/usr/bin/env npx ts-node

/**
 * Simple Chat Example
 * 
 * Demonstrates basic interaction with the orchestrator.
 */

import { Orchestrator } from '@openbotman/orchestrator';

// Minimal configuration
const config = {
  orchestrator: {
    model: 'claude-sonnet-4-20250514',
    maxIterations: 5,
    agentTimeout: 60000,
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
      id: 'claude_code',
      name: 'Claude Code',
      role: 'coder' as const,
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'You are an expert software developer.',
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
  console.log('Initializing OpenBotMan...\n');
  
  const orchestrator = new Orchestrator(config as any);
  
  console.log('Orchestrator ready!\n');
  console.log('---\n');
  
  // Simple task
  const response = await orchestrator.chat(
    'Write a TypeScript function that validates an email address using a regex.'
  );
  
  console.log('Response:\n');
  console.log(response);
  console.log('\n---\n');
  
  // Get status
  console.log('Status:', JSON.stringify(orchestrator.getStatus(), null, 2));
}

main().catch(console.error);
