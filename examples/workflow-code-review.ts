#!/usr/bin/env npx ts-node

/**
 * Workflow Example: Code Review
 * 
 * Demonstrates a multi-step workflow with different agents.
 */

import { Orchestrator } from '@openbotman/orchestrator';

const config = {
  orchestrator: {
    model: 'claude-sonnet-4-20250514',
    maxIterations: 15,
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
      id: 'analyzer',
      name: 'Code Analyzer',
      role: 'coder' as const,
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-20250514',
      systemPrompt: `You are a code analysis expert. 
Analyze code structure, identify patterns, and find potential issues.
Be thorough but concise.`,
      capabilities: {
        code: true, review: true, filesystem: true, shell: false,
        web: false, mcp: false, discussion: true, decisions: true,
      },
      enabled: true,
    },
    {
      id: 'security_reviewer',
      name: 'Security Reviewer',
      role: 'security' as const,
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-20250514',
      systemPrompt: `You are a security code reviewer.
Look for:
- SQL injection
- XSS vulnerabilities
- Authentication issues
- Data exposure
- Insecure dependencies
Rate severity: Critical, High, Medium, Low, Info`,
      capabilities: {
        code: false, review: true, filesystem: false, shell: false,
        web: false, mcp: false, discussion: true, decisions: true,
      },
      enabled: true,
    },
    {
      id: 'test_generator',
      name: 'Test Generator',
      role: 'tester' as const,
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-20250514',
      systemPrompt: `You are a testing expert.
Generate comprehensive tests including:
- Unit tests
- Edge cases
- Error scenarios
- Integration points
Use a popular testing framework appropriate for the language.`,
      capabilities: {
        code: true, review: false, filesystem: true, shell: false,
        web: false, mcp: false, discussion: true, decisions: false,
      },
      enabled: true,
    },
  ],
  workflows: [
    {
      id: 'code_review',
      name: 'Code Review Workflow',
      description: 'Comprehensive code review with security and tests',
      steps: [
        {
          id: 'analyze',
          name: 'Analyze Code',
          agent: 'analyzer',
          role: 'coder' as const,
          task: 'Analyze the code structure and identify potential issues.',
          output: 'analysis',
        },
        {
          id: 'security',
          name: 'Security Review',
          agent: 'security_reviewer',
          role: 'security' as const,
          task: 'Review for security vulnerabilities based on the analysis.',
          inputs: ['analysis'],
          output: 'security_review',
        },
        {
          id: 'tests',
          name: 'Generate Tests',
          agent: 'test_generator',
          role: 'tester' as const,
          task: 'Generate comprehensive tests based on the code analysis.',
          inputs: ['analysis'],
          output: 'tests',
          maxIterations: 2,
        },
      ],
    },
  ],
  qualityGates: [],
};

// Sample code to review
const sampleCode = `
// user-auth.ts
import { db } from './database';
import { hash, compare } from 'bcrypt';

export async function registerUser(email: string, password: string) {
  const hashedPassword = await hash(password, 10);
  const result = await db.query(
    \`INSERT INTO users (email, password) VALUES ('\${email}', '\${hashedPassword}')\`
  );
  return result.insertId;
}

export async function loginUser(email: string, password: string) {
  const result = await db.query(
    \`SELECT * FROM users WHERE email = '\${email}'\`
  );
  
  if (result.length === 0) {
    throw new Error('User not found');
  }
  
  const user = result[0];
  const valid = await compare(password, user.password);
  
  if (!valid) {
    throw new Error('Invalid password');
  }
  
  return { id: user.id, email: user.email };
}
`;

async function main() {
  console.log('Initializing OpenBotMan Code Review Workflow...\n');
  
  const orchestrator = new Orchestrator(config as any);
  
  console.log('Orchestrator ready!\n');
  console.log('Running code review workflow on sample code...\n');
  console.log('==='.repeat(20));
  console.log('\nCode to review:');
  console.log(sampleCode);
  console.log('==='.repeat(20) + '\n');
  
  // Run workflow
  const result = await orchestrator.runWorkflow('code_review', {
    code: sampleCode,
    language: 'typescript',
    filename: 'user-auth.ts',
  });
  
  console.log('\n' + '==='.repeat(20));
  console.log('\nWorkflow Results:\n');
  
  if (result['analysis']) {
    console.log('📊 ANALYSIS:');
    console.log(String(result['analysis']).slice(0, 500) + '...\n');
  }
  
  if (result['security_review']) {
    console.log('🔒 SECURITY REVIEW:');
    console.log(String(result['security_review']).slice(0, 500) + '...\n');
  }
  
  if (result['tests']) {
    console.log('🧪 GENERATED TESTS:');
    console.log(String(result['tests']).slice(0, 500) + '...\n');
  }
  
  console.log('✅ Workflow complete!');
}

main().catch(console.error);
