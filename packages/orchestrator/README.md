# @openbotman/orchestrator

Multi-Agent Orchestrator - The brain of OpenBotMan.

## Overview

The orchestrator coordinates specialized AI agents to accomplish complex tasks collaboratively. It provides:

- **Agent Management**: Initialize, track, and execute agents
- **Task Delegation**: Assign tasks to the most suitable agents
- **Discussion Engine**: Structured multi-agent discussions with consensus building
- **Agent-to-Agent Communication**: Message queue for inter-agent messaging
- **Knowledge Base Integration**: Shared learning and decision storage

## Installation

```bash
pnpm add @openbotman/orchestrator
```

## Usage

### Basic Orchestrator

```typescript
import { Orchestrator } from '@openbotman/orchestrator';

const orchestrator = new Orchestrator({
  model: 'claude-sonnet-4-20250514',
  maxIterations: 10,
  agentTimeout: 30000,
  autonomous: false,
  humanApproval: true,
  knowledgeBase: {
    enabled: true,
    storagePath: './knowledge',
    autoLearn: true,
  },
  agents: [
    {
      id: 'coder',
      name: 'Code Agent',
      role: 'coder',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'You are an expert software developer...',
      capabilities: { code: true, review: true, filesystem: true },
      enabled: true,
    },
  ],
  workflows: [],
  qualityGates: [],
});

// Chat with the orchestrator
const response = await orchestrator.chat('Create a REST API for user management');
```

## Agent-to-Agent Communication

### Message Queue

The message queue enables asynchronous communication between agents.

```typescript
import { MessageQueue, MessagePriority } from '@openbotman/orchestrator';

const queue = new MessageQueue();

// Register agents
queue.registerAgent('agent1');
queue.registerAgent('agent2');

// Send a direct message
const message = queue.send(
  'agent1',           // sender
  'agent2',           // recipient
  'task-request',     // type
  { task: 'Review this code' }, // payload
  { priority: MessagePriority.HIGH }
);

// Receive messages
const messages = queue.receive('agent2', {
  types: ['task-request'],
  markAsRead: true,
});

// Acknowledge processing
queue.acknowledge(message.id);

// Broadcast to all agents
queue.broadcast('agent1', 'announcement', { info: 'System update' });
```

### Agent Communication Layer

Higher-level API for agent communication with request/response patterns.

```typescript
import { AgentCommunication, AgentMessageType } from '@openbotman/orchestrator';

const comm = new AgentCommunication();

// Register agents
comm.registerAgent('architect');
comm.registerAgent('coder');
comm.registerAgent('reviewer');

// Direct messaging
comm.sendMessage('architect', 'coder', {
  instruction: 'Implement the user service',
});

// Request/Response pattern
const response = await comm.request(
  'coder',
  'reviewer',
  { code: '...', file: 'user.ts' },
  { timeoutMs: 30000 }
);

// Broadcasting
comm.broadcast('architect', {
  decision: 'We will use TypeScript for this project',
}, { priority: MessagePriority.HIGH });
```

### Proposals and Voting

```typescript
// Create a proposal for team discussion
const proposal = comm.createProposal(
  'architect',
  'Database Choice',
  'Should we use PostgreSQL or MongoDB for this project?',
  {
    proposalOptions: ['PostgreSQL', 'MongoDB', 'Need more info'],
    notifyAgents: ['coder', 'reviewer'],
  }
);

// Submit arguments
comm.submitArgument(
  'coder',
  proposal.id,
  'support',
  'PostgreSQL has better ACID compliance',
  { confidence: 0.9 }
);

comm.submitArgument(
  'reviewer',
  proposal.id,
  'oppose',
  'MongoDB offers more flexibility for changing schemas',
  { confidence: 0.7 }
);

// Cast votes
comm.castVote('coder', proposal.id, 'PostgreSQL');
comm.castVote('reviewer', proposal.id, 'MongoDB');

// Calculate consensus
const result = comm.calculateConsensus(proposal.id, 0.6);
console.log(result.reached, result.decision, result.breakdown);
```

## Enhanced Discussion Engine

Structured discussions with phases, voting, and CLI streaming.

```typescript
import { 
  EnhancedDiscussionEngine, 
  AgentCommunication,
  DiscussionPhase,
} from '@openbotman/orchestrator';

const comm = new AgentCommunication();
const discussionEngine = new EnhancedDiscussionEngine(comm);

// Register participants
comm.registerAgent('orchestrator');
comm.registerAgent('architect');
comm.registerAgent('security');
comm.registerAgent('devops');

// Create a discussion
const room = discussionEngine.createDiscussion({
  topic: 'API Authentication Strategy',
  description: 'Should we use JWT, OAuth2, or API keys?',
  participants: ['architect', 'security', 'devops'],
  moderatorId: 'orchestrator',
  options: ['JWT', 'OAuth2', 'API Keys', 'Hybrid'],
  consensusThreshold: 0.6,
  totalTimeoutMs: 300000, // 5 minutes
});

// Listen to discussion events
discussionEngine.on('discussion:entry', (room, entry) => {
  console.log(`[${entry.agentId}] ${entry.content}`);
});

discussionEngine.on('discussion:consensus', (room, decision) => {
  console.log(`Consensus reached: ${decision}`);
});

// Start argument phase
await discussionEngine.startArgumentPhase(room.id, 60000);

// Participants submit arguments
discussionEngine.submitArgument(
  room.id,
  'architect',
  'support',
  'JWT is stateless and scales well',
  0.8
);

discussionEngine.submitArgument(
  room.id,
  'security',
  'neutral',
  'All options are secure if implemented correctly',
  0.6
);

// Move to voting phase
await discussionEngine.startVotingPhase(room.id, 30000);

// Participants vote
discussionEngine.submitVote(room.id, 'architect', 'JWT', 'Best for microservices');
discussionEngine.submitVote(room.id, 'security', 'OAuth2', 'Industry standard');
discussionEngine.submitVote(room.id, 'devops', 'JWT', 'Easier to deploy');

// Finalize discussion
const result = await discussionEngine.finalizeDiscussion(room.id);

// Format for CLI display
const transcript = discussionEngine.formatTranscriptForCLI(room.id, true);
console.log(transcript);
```

### User Intervention

Users can inject messages into ongoing discussions:

```typescript
// Inject user input as a moderator message
discussionEngine.injectUserMessage(
  room.id,
  'user',
  'Please consider the latency implications'
);

// Inject user input as an argument
discussionEngine.injectUserMessage(
  room.id,
  'user',
  'JWT has known security concerns with long-lived tokens',
  { stance: 'oppose' }
);
```

## Discussion Engine (Original)

The original discussion engine for simpler use cases:

```typescript
import { DiscussionEngine, AgentRunner } from '@openbotman/orchestrator';

const agentRunner = new AgentRunner();
const discussionEngine = new DiscussionEngine(agentRunner);

const room = await discussionEngine.startDiscussion({
  topic: 'Code Review Standards',
  participants: ['coder', 'reviewer'],
  maxRounds: 3,
  consensusThreshold: 0.8,
});

const result = await discussionEngine.runDiscussion(room.id);
console.log(result.consensus, result.decision);
```

## Events

### MessageQueue Events

```typescript
queue.on('message:queued', (message) => { /* ... */ });
queue.on('message:delivered', (message) => { /* ... */ });
queue.on('message:processed', (message) => { /* ... */ });
queue.on('broadcast', (message) => { /* ... */ });
```

### AgentCommunication Events

```typescript
comm.on('message', (message) => { /* ... */ });
comm.on('request', (senderId, type, payload, correlationId) => { /* ... */ });
comm.on('response', (correlationId, payload) => { /* ... */ });
comm.on('proposal', (proposal) => { /* ... */ });
comm.on('argument', (argument) => { /* ... */ });
comm.on('vote', (vote) => { /* ... */ });
comm.on('consensus', (proposalId, decision, votes) => { /* ... */ });
```

### EnhancedDiscussionEngine Events

```typescript
discussionEngine.on('discussion:created', (room) => { /* ... */ });
discussionEngine.on('discussion:phase', (room, phase) => { /* ... */ });
discussionEngine.on('discussion:entry', (room, entry) => { /* ... */ });
discussionEngine.on('discussion:argument', (room, argument) => { /* ... */ });
discussionEngine.on('discussion:vote', (room, vote) => { /* ... */ });
discussionEngine.on('discussion:consensus', (room, decision) => { /* ... */ });
discussionEngine.on('discussion:timeout', (room, phase) => { /* ... */ });
discussionEngine.on('discussion:closed', (room) => { /* ... */ });
```

## Message Types

```typescript
enum AgentMessageType {
  DIRECT = 'direct',
  REQUEST = 'request',
  RESPONSE = 'response',
  PROPOSAL = 'proposal',
  ARGUMENT = 'argument',
  COUNTER_ARGUMENT = 'counter_argument',
  VOTE = 'vote',
  CONSENSUS = 'consensus',
  // ... more types
}
```

## Discussion Phases

```typescript
enum DiscussionPhase {
  PROPOSAL = 'proposal',
  ARGUMENT = 'argument',
  VOTING = 'voting',
  CONSENSUS = 'consensus',
  TIMEOUT = 'timeout',
  CLOSED = 'closed',
}
```

## API Reference

### MessageQueue

| Method | Description |
|--------|-------------|
| `registerAgent(agentId)` | Register an agent to receive messages |
| `unregisterAgent(agentId)` | Remove an agent |
| `send(senderId, recipientId, type, payload, options?)` | Send a direct message |
| `broadcast(senderId, type, payload, options?)` | Broadcast to all agents |
| `reply(messageId, senderId, type, payload)` | Reply to a message |
| `receive(agentId, options?)` | Receive messages for an agent |
| `acknowledge(messageId)` | Mark message as processed |
| `subscribe(agentId, handler, filter?)` | Subscribe to messages |
| `getThread(correlationId)` | Get conversation thread |
| `getStats()` | Get queue statistics |

### AgentCommunication

| Method | Description |
|--------|-------------|
| `registerAgent(agentId)` | Register an agent |
| `sendMessage(senderId, recipientId, content, options?)` | Send a message |
| `request(senderId, recipientId, payload, options?)` | Request with response |
| `respond(responderId, correlationId, originalSenderId, payload)` | Respond to request |
| `broadcast(senderId, content, options?)` | Broadcast message |
| `createProposal(proposerId, topic, description, options?)` | Create a proposal |
| `submitArgument(agentId, proposalId, stance, reasoning, options?)` | Submit argument |
| `castVote(agentId, proposalId, option, options?)` | Cast a vote |
| `calculateConsensus(proposalId, threshold?)` | Calculate consensus |

### EnhancedDiscussionEngine

| Method | Description |
|--------|-------------|
| `createDiscussion(options)` | Create a new discussion |
| `startArgumentPhase(roomId, timeoutMs?)` | Start argument collection |
| `startVotingPhase(roomId, timeoutMs?)` | Start voting |
| `submitArgument(roomId, agentId, stance, reasoning, confidence?)` | Submit argument |
| `submitVote(roomId, agentId, option, reasoning?)` | Submit vote |
| `finalizeDiscussion(roomId)` | Finalize and determine consensus |
| `runDiscussion(options, callbacks?)` | Run complete discussion |
| `injectUserMessage(roomId, userId, message, asArgument?)` | Inject user input |
| `formatTranscriptForCLI(roomId, useColors?)` | Format for CLI output |
| `getRoom(roomId)` | Get discussion room |
| `getActiveDiscussions()` | List active discussions |
| `getTranscript(roomId)` | Get transcript entries |

## License

MIT
