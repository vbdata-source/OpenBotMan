/**
 * Multi-Agent Orchestrator
 * 
 * The brain of OpenBotMan.
 * Coordinates agents, manages tasks, and maintains shared knowledge.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import Anthropic from '@anthropic-ai/sdk';
import { 
  AgentRole,
  Priority,
} from '@openbotman/protocol';
import { 
  KnowledgeBase 
} from '@openbotman/knowledge-base';
import { AgentRunner, type AgentExecutionResult } from './agent-runner.js';
import { DiscussionEngine, type DiscussionOptions, type DiscussionResult } from './discussion.js';
import { ClaudeAuthProvider, type ClaudeAuthConfig } from './auth/index.js';
import { ClaudeCliProvider } from './providers/claude-cli.js';
import type { 
  OrchestratorConfig, 
  Task, 
  HumanRequest,
  HumanResponse,
  OrchestratorEvents,
} from './types.js';

/**
 * Multi-Agent Orchestrator
 */
export class Orchestrator extends EventEmitter<OrchestratorEvents> {
  private config: OrchestratorConfig;
  private client?: Anthropic;
  private cliProvider?: ClaudeCliProvider;
  private agentRunner: AgentRunner;
  private discussionEngine: DiscussionEngine;
  private knowledgeBase?: KnowledgeBase;
  private authProvider: ClaudeAuthProvider;
  
  // State
  private tasks: Map<string, Task> = new Map();
  private pendingHumanRequests: Map<string, HumanRequest> = new Map();
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  
  // Metrics
  private startTime: Date;
  private totalTasksProcessed = 0;
  private totalTokensUsed = 0;
  
  constructor(config: OrchestratorConfig, authConfig?: ClaudeAuthConfig) {
    super();
    this.config = config;
    this.startTime = new Date();
    
    // Initialize auth provider
    this.authProvider = new ClaudeAuthProvider(authConfig);
    
    // Check if we should use Claude CLI provider
    if (config.provider === 'claude-cli') {
      console.log(`[Orchestrator] Using Claude CLI provider`);
      this.cliProvider = new ClaudeCliProvider({
        command: config.cli?.command ?? 'claude',
        model: config.model,
        maxTurns: config.cli?.maxTurns ?? config.maxIterations,
      });
    } else {
      // Initialize Anthropic client using auth provider
      try {
        this.client = this.authProvider.createClient();
        
        const authStatus = this.authProvider.getStatus();
        console.log(`[Orchestrator] Auth: ${authStatus.message}`);
      } catch {
        // Fallback to legacy API key check for backward compatibility
        const apiKey = process.env['ANTHROPIC_API_KEY'];
        if (!apiKey) {
          throw new Error(
            'No authentication method available. ' +
            'Set ANTHROPIC_API_KEY environment variable or run: openbotman auth setup-token'
          );
        }
        this.client = new Anthropic({ apiKey });
      }
    }
    
    // Initialize components
    this.agentRunner = new AgentRunner();
    this.discussionEngine = new DiscussionEngine(this.agentRunner);
    
    // Initialize agents
    for (const agentDef of config.agents) {
      if (agentDef.enabled) {
        this.agentRunner.initAgent(agentDef);
      }
    }
    
    // Initialize knowledge base
    if (config.knowledgeBase.enabled) {
      this.knowledgeBase = new KnowledgeBase({
        storagePath: config.knowledgeBase.storagePath,
        vectorDb: 'memory',
        autoLearn: config.knowledgeBase.autoLearn,
        autoLink: true,
      });
    }
    
    // Forward events from discussion engine
    this.discussionEngine.on('discussion:started', (room) => 
      this.emit('discussion:started', room));
    this.discussionEngine.on('discussion:message', (room, msg) => 
      this.emit('discussion:message', room, msg));
    this.discussionEngine.on('discussion:consensus', (room, decision) => 
      this.emit('discussion:consensus', room, decision));
  }
  
  /**
   * Main chat interface
   */
  async chat(userMessage: string): Promise<string> {
    // Add to history
    this.conversationHistory.push({ role: 'user', content: userMessage });
    
    // Use CLI provider if configured
    if (this.cliProvider) {
      return this.chatWithCli(userMessage);
    }
    
    // Build system prompt
    const systemPrompt = this.buildSystemPrompt();
    
    // Build tools
    const tools = this.buildTools();
    
    // Agentic loop
    let iterations = 0;
    
    while (iterations < this.config.maxIterations) {
      iterations++;
      console.log(`[Orchestrator] Iteration ${iterations}/${this.config.maxIterations}`);
      
      if (!this.client) {
        throw new Error('Anthropic client not initialized');
      }
      
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: this.conversationHistory.map(m => ({
          role: m.role,
          content: m.content,
        })),
      });
      
      // Track tokens
      this.totalTokensUsed += response.usage.input_tokens + response.usage.output_tokens;
      
      console.log(`[Orchestrator] Response stop_reason: ${response.stop_reason}`);
      
      // Handle response - 'end_turn' means completion, also handle max_tokens gracefully
      if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
        // Extract text
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n');
        
        this.conversationHistory.push({ role: 'assistant', content: text });
        return text;
      }
      
      if (response.stop_reason === 'tool_use') {
        // Execute tools
        const assistantContent = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n');
        
        if (assistantContent) {
          this.conversationHistory.push({ role: 'assistant', content: assistantContent });
        }
        
        const toolResults: string[] = [];
        
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            console.log(`[Orchestrator] Tool: ${block.name}`);
            
            try {
              const result = await this.executeTool(block.name, block.input as Record<string, unknown>);
              toolResults.push(`Tool ${block.name}: ${JSON.stringify(result, null, 2)}`);
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              toolResults.push(`Tool ${block.name} error: ${errorMsg}`);
            }
          }
        }
        
        // Add tool results to conversation
        this.conversationHistory.push({ 
          role: 'user', 
          content: `Tool Results:\n${toolResults.join('\n\n')}` 
        });
      }
    }
    
    return 'Max iterations reached. Please simplify your request.';
  }
  
  /**
   * Chat using Claude CLI provider
   */
  private async chatWithCli(userMessage: string): Promise<string> {
    if (!this.cliProvider) {
      throw new Error('Claude CLI provider not initialized');
    }
    
    console.log(`[Orchestrator] Sending to Claude CLI...`);
    
    try {
      const response = await this.cliProvider.send(userMessage);
      
      // Add response to history
      this.conversationHistory.push({ role: 'assistant', content: response.text });
      
      // Track cost if available
      if (response.costUsd) {
        console.log(`[Orchestrator] Cost: $${response.costUsd.toFixed(4)}`);
      }
      
      console.log(`[Orchestrator] Response received (${response.numTurns ?? 1} turns)`);
      
      return response.text;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Orchestrator] CLI Error: ${errorMsg}`);
      throw error;
    }
  }
  
  /**
   * Build system prompt
   */
  private buildSystemPrompt(): string {
    const agents = this.agentRunner.getAllAgents()
      .map(a => `- ${a.definition.id} (${a.definition.role}): ${a.definition.name}`)
      .join('\n');
    
    const workflows = this.config.workflows
      .map(w => `- ${w.id}: ${w.description}`)
      .join('\n');
    
    return `You are the Multi-Agent Orchestrator for OpenBotMan.

Your role: Coordinate specialized AI agents to accomplish complex tasks collaboratively.

Available Agents:
${agents}

Available Workflows:
${workflows}

Tools:
- delegate_task: Assign a task to a specific agent
- create_discussion: Start a multi-agent discussion
- run_workflow: Execute a predefined workflow
- query_knowledge: Search shared knowledge base
- add_knowledge: Store new knowledge
- request_human_input: Ask for human input/approval

Guidelines:
1. Break complex tasks into subtasks for different agents
2. Use agent specializations (coder for code, reviewer for reviews)
3. Important decisions → create discussion for consensus
4. Store learnings in knowledge base
5. Request human approval for external/destructive actions
6. Synthesize agent outputs into coherent final answers

Communication Style:
- Use AICP shorthand for agent messages when logging
- Example: @ORCH>CODER:TASK:impl_feature:P2
- Translate to human-readable for final output`;
  }
  
  /**
   * Build tool definitions
   */
  private buildTools(): Anthropic.Tool[] {
    return [
      {
        name: 'delegate_task',
        description: 'Assign a task to a specific agent. Returns the agent response.',
        input_schema: {
          type: 'object' as const,
          properties: {
            agent_id: { 
              type: 'string', 
              description: 'Agent ID to delegate to',
              enum: this.agentRunner.getAllAgents().map(a => a.definition.id),
            },
            role: { 
              type: 'string', 
              description: 'Role context for the task',
              enum: Object.values(AgentRole),
            },
            task: { 
              type: 'string', 
              description: 'Task description' 
            },
            context: { 
              type: 'object', 
              description: 'Additional context' 
            },
            priority: {
              type: 'number',
              description: 'Priority 0-4 (4 = critical)',
              default: 1,
            },
          },
          required: ['agent_id', 'task'],
        },
      },
      {
        name: 'create_discussion',
        description: 'Start a multi-agent discussion to reach consensus on a topic.',
        input_schema: {
          type: 'object' as const,
          properties: {
            topic: { 
              type: 'string', 
              description: 'Discussion topic' 
            },
            participants: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Agent IDs to participate' 
            },
            max_rounds: { 
              type: 'number', 
              description: 'Maximum discussion rounds',
              default: 3,
            },
            consensus_threshold: {
              type: 'number',
              description: 'Threshold for consensus (0-1)',
              default: 0.8,
            },
          },
          required: ['topic', 'participants'],
        },
      },
      {
        name: 'run_workflow',
        description: 'Execute a predefined multi-step workflow.',
        input_schema: {
          type: 'object' as const,
          properties: {
            workflow_id: { 
              type: 'string', 
              description: 'Workflow ID',
              enum: this.config.workflows.map(w => w.id),
            },
            input: { 
              type: 'object', 
              description: 'Workflow input data' 
            },
          },
          required: ['workflow_id'],
        },
      },
      {
        name: 'query_knowledge',
        description: 'Search the shared knowledge base.',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { 
              type: 'string', 
              description: 'Search query' 
            },
            types: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Filter by knowledge types' 
            },
            limit: { 
              type: 'number', 
              description: 'Max results',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'add_knowledge',
        description: 'Store new knowledge in the shared knowledge base.',
        input_schema: {
          type: 'object' as const,
          properties: {
            type: { 
              type: 'string', 
              description: 'Knowledge type',
              enum: ['decision', 'pattern', 'learning', 'code', 'doc'],
            },
            title: { 
              type: 'string', 
              description: 'Knowledge title' 
            },
            content: { 
              type: 'string', 
              description: 'Knowledge content' 
            },
            tags: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Tags for categorization' 
            },
          },
          required: ['type', 'title', 'content'],
        },
      },
      {
        name: 'request_human_input',
        description: 'Request input or approval from the human.',
        input_schema: {
          type: 'object' as const,
          properties: {
            type: { 
              type: 'string', 
              description: 'Request type',
              enum: ['approval', 'input', 'clarification', 'review'],
            },
            message: { 
              type: 'string', 
              description: 'Message to human' 
            },
            options: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Options to choose from' 
            },
          },
          required: ['type', 'message'],
        },
      },
    ];
  }
  
  /**
   * Execute a tool
   */
  private async executeTool(
    name: string, 
    input: Record<string, unknown>
  ): Promise<unknown> {
    switch (name) {
      case 'delegate_task':
        return this.delegateTask(
          input['agent_id'] as string,
          input['task'] as string,
          input['role'] as AgentRole | undefined,
          input['context'] as Record<string, unknown> | undefined,
          input['priority'] as number | undefined
        );
        
      case 'create_discussion':
        return this.createDiscussion({
          topic: input['topic'] as string,
          participants: input['participants'] as string[],
          maxRounds: input['max_rounds'] as number | undefined,
          consensusThreshold: input['consensus_threshold'] as number | undefined,
        });
        
      case 'run_workflow':
        return this.runWorkflow(
          input['workflow_id'] as string,
          input['input'] as Record<string, unknown> | undefined
        );
        
      case 'query_knowledge':
        return this.queryKnowledge(
          input['query'] as string,
          input['types'] as string[] | undefined,
          input['limit'] as number | undefined
        );
        
      case 'add_knowledge':
        return this.addKnowledge(
          input['type'] as string,
          input['title'] as string,
          input['content'] as string,
          input['tags'] as string[] | undefined
        );
        
      case 'request_human_input':
        return this.requestHumanInput(
          input['type'] as string,
          input['message'] as string,
          input['options'] as string[] | undefined
        );
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
  
  /**
   * Delegate task to agent
   */
  async delegateTask(
    agentId: string,
    taskDescription: string,
    role?: AgentRole,
    context?: Record<string, unknown>,
    priority: number = Priority.NORMAL
  ): Promise<AgentExecutionResult> {
    // Create task record
    const task: Task = {
      id: uuidv4(),
      description: taskDescription,
      assignedTo: agentId,
      role,
      priority,
      status: 'assigned',
      progress: 0,
      context,
      createdAt: new Date(),
    };
    
    this.tasks.set(task.id, task);
    this.emit('task:assigned', task);
    
    // Log in AICP shorthand
    const shorthand = `@ORCH>${agentId.toUpperCase()}:TASK:${taskDescription.slice(0, 20)}:P${priority}`;
    console.log(`[AICP] ${shorthand}`);
    
    // Execute
    task.status = 'in_progress';
    task.startedAt = new Date();
    
    const result = await this.agentRunner.execute(agentId, taskDescription, context);
    
    // Update task
    task.completedAt = new Date();
    if (result.success) {
      task.status = 'completed';
      task.result = result.response;
      task.progress = 100;
      this.emit('task:completed', task);
      
      // Auto-learn if enabled
      if (this.config.knowledgeBase.autoLearn && this.knowledgeBase) {
        await this.extractLearnings(task, result);
      }
    } else {
      task.status = 'failed';
      task.error = result.error;
      this.emit('task:failed', task);
    }
    
    this.totalTasksProcessed++;
    
    return result;
  }
  
  /**
   * Create and run a discussion
   */
  async createDiscussion(options: DiscussionOptions): Promise<DiscussionResult> {
    console.log(`[AICP] @ORCH>*:DISC:${options.topic.slice(0, 30)}:participants=${options.participants.length}`);
    
    const room = await this.discussionEngine.startDiscussion(options);
    return this.discussionEngine.runDiscussion(room.id, options.context);
  }
  
  /**
   * Run a workflow
   */
  async runWorkflow(
    workflowId: string,
    input?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const workflow = this.config.workflows.find(w => w.id === workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    console.log(`[Workflow] Starting: ${workflow.name}`);
    
    const context: Record<string, unknown> = { ...workflow.context, ...input };
    
    for (const step of workflow.steps) {
      console.log(`[Workflow] Step: ${step.name}`);
      
      // Get agent for step
      let agentId = step.agent;
      if (!agentId && step.role) {
        const agent = this.agentRunner.getBestAgentForRole(step.role);
        agentId = agent?.definition.id;
      }
      
      if (!agentId) {
        throw new Error(`No agent available for step: ${step.name}`);
      }
      
      // Build task with inputs from context
      let task = step.task;
      if (step.inputs) {
        for (const inputName of step.inputs) {
          if (context[inputName] !== undefined) {
            task += `\n\n${inputName}:\n${JSON.stringify(context[inputName], null, 2)}`;
          }
        }
      }
      
      // Execute with iterations
      let result: AgentExecutionResult | null = null;
      const maxIterations = step.maxIterations ?? 1;
      
      for (let i = 0; i < maxIterations; i++) {
        result = await this.delegateTask(agentId, task, step.role, context);
        
        if (result.success) break;
        
        if (step.onFailure === 'abort') {
          throw new Error(`Step failed: ${step.name} - ${result.error}`);
        }
        if (step.onFailure === 'skip') break;
        // 'retry' continues loop
      }
      
      // Store output
      if (step.output && result?.success) {
        context[step.output] = result.response;
      }
    }
    
    console.log(`[Workflow] Completed: ${workflow.name}`);
    
    return context;
  }
  
  /**
   * Query knowledge base
   */
  async queryKnowledge(
    query: string,
    types?: string[],
    limit: number = 10
  ): Promise<unknown> {
    if (!this.knowledgeBase) {
      return { error: 'Knowledge base not enabled' };
    }
    
    const results = await this.knowledgeBase.search({
      query,
      types: types as any,
      limit,
    });
    
    return results.map(r => ({
      title: r.knowledge.title,
      type: r.knowledge.type,
      content: r.knowledge.content.slice(0, 500),
      score: r.score,
    }));
  }
  
  /**
   * Add to knowledge base
   */
  async addKnowledge(
    type: string,
    title: string,
    content: string,
    tags?: string[]
  ): Promise<unknown> {
    if (!this.knowledgeBase) {
      return { error: 'Knowledge base not enabled' };
    }
    
    const knowledge = await this.knowledgeBase.add(
      type as any,
      title,
      content,
      { tags }
    );
    
    this.emit('knowledge:added', knowledge.id, type);
    
    return { id: knowledge.id, message: 'Knowledge added successfully' };
  }
  
  /**
   * Request human input
   */
  async requestHumanInput(
    type: string,
    message: string,
    options?: string[]
  ): Promise<HumanResponse> {
    const request: HumanRequest = {
      id: uuidv4(),
      type: type as any,
      message,
      options,
      priority: Priority.NORMAL,
    };
    
    this.pendingHumanRequests.set(request.id, request);
    this.emit('human:request', request);
    
    // For now, return a placeholder
    // In real implementation, this would wait for human response
    return {
      requestId: request.id,
      response: 'Awaiting human response...',
      timestamp: new Date(),
    };
  }
  
  /**
   * Handle human response
   */
  handleHumanResponse(requestId: string, response: string): void {
    const request = this.pendingHumanRequests.get(requestId);
    if (request) {
      const humanResponse: HumanResponse = {
        requestId,
        response,
        approved: response.toLowerCase() === 'yes' || response.toLowerCase() === 'approved',
        timestamp: new Date(),
      };
      
      this.emit('human:response', humanResponse);
      this.pendingHumanRequests.delete(requestId);
    }
  }
  
  /**
   * Extract learnings from completed task
   */
  private async extractLearnings(
    task: Task,
    result: AgentExecutionResult
  ): Promise<void> {
    if (!this.knowledgeBase) return;
    
    // Ask an agent to extract learnings
    const prompt = `
Analyze this completed task and extract learnings:

Task: ${task.description}
Agent: ${task.assignedTo}
Duration: ${task.completedAt!.getTime() - task.startedAt!.getTime()}ms
Success: ${result.success}

Result:
${result.response.slice(0, 1000)}

Extract:
1. What worked well?
2. What could be improved?
3. Any patterns or best practices discovered?

Keep it concise - max 3-4 bullet points.
    `;
    
    const extractResult = await this.agentRunner.execute(
      task.assignedTo!,
      prompt,
      { task, result }
    );
    
    if (extractResult.success) {
      await this.knowledgeBase.recordLearning({
        taskId: task.id,
        agentId: task.assignedTo!,
        lesson: extractResult.response,
        context: task.description,
        outcome: result.success ? 'success' : 'failure',
        confidence: 0.8,
      });
    }
  }
  
  /**
   * Get orchestrator status
   */
  getStatus(): Record<string, unknown> {
    const uptime = Date.now() - this.startTime.getTime();
    
    return {
      uptime: Math.round(uptime / 1000),
      agents: this.agentRunner.getAllAgents().map(a => ({
        id: a.definition.id,
        role: a.definition.role,
        status: a.status,
        tasks: a.metrics.tasksCompleted,
      })),
      tasks: {
        total: this.totalTasksProcessed,
        pending: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
        active: Array.from(this.tasks.values()).filter(t => t.status === 'in_progress').length,
      },
      tokens: this.totalTokensUsed,
      discussions: this.discussionEngine.listActiveDiscussions().length,
    };
  }
  
  /**
   * Reset conversation
   */
  reset(): void {
    this.conversationHistory = [];
    for (const agent of this.agentRunner.getAllAgents()) {
      this.agentRunner.resetSession(agent.definition.id);
    }
  }
  
  /**
   * Get authentication status
   */
  getAuthStatus() {
    return this.authProvider.getStatus();
  }
  
  /**
   * Get the auth provider for advanced operations
   */
  getAuthProvider(): ClaudeAuthProvider {
    return this.authProvider;
  }
}
