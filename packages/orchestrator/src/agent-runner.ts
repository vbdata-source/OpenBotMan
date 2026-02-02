/**
 * Agent Runner
 * 
 * Executes agents via CLI or API.
 * Manages sessions and message history.
 */

import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import type { AgentDefinition, AgentInstance, AgentMessage, ToolDefinition, ToolResult } from './types.js';
import { AgentRole, LLMProvider } from '@openbotman/protocol';

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  success: boolean;
  response: string;
  tokensUsed?: number;
  toolCalls?: Array<{
    name: string;
    input: Record<string, unknown>;
    result: ToolResult;
  }>;
  duration: number;
  error?: string;
}

/**
 * Agent Runner - executes agents
 */
export class AgentRunner {
  private anthropicClient?: Anthropic;
  private sessions: Map<string, AgentInstance> = new Map();
  private messageHistory: Map<string, AgentMessage[]> = new Map();
  
  constructor() {
    // Initialize Anthropic client if API key available
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (apiKey) {
      this.anthropicClient = new Anthropic({ apiKey });
    }
  }
  
  /**
   * Initialize an agent instance
   */
  initAgent(definition: AgentDefinition): AgentInstance {
    const instance: AgentInstance = {
      definition,
      status: 'idle',
      sessionId: uuidv4(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        tokensUsed: 0,
        averageResponseTime: 0,
      },
    };
    
    this.sessions.set(definition.id, instance);
    this.messageHistory.set(definition.id, []);
    
    return instance;
  }
  
  /**
   * Get agent instance
   */
  getAgent(agentId: string): AgentInstance | undefined {
    return this.sessions.get(agentId);
  }
  
  /**
   * Execute an agent with a task
   */
  async execute(
    agentId: string,
    task: string,
    context?: Record<string, unknown>,
    tools?: ToolDefinition[]
  ): Promise<AgentExecutionResult> {
    const instance = this.sessions.get(agentId);
    if (!instance) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    const startTime = Date.now();
    instance.status = 'busy';
    instance.currentTask = task;
    instance.lastActivity = new Date();
    
    try {
      let result: AgentExecutionResult;
      
      // Route to appropriate execution method
      if (instance.definition.cli) {
        result = await this.executeViaCli(instance, task, context);
      } else if (instance.definition.provider === LLMProvider.ANTHROPIC) {
        result = await this.executeViaAnthropic(instance, task, context, tools);
      } else {
        throw new Error(`Unsupported provider: ${instance.definition.provider}`);
      }
      
      // Update metrics
      instance.metrics.tokensUsed += result.tokensUsed ?? 0;
      if (result.success) {
        instance.metrics.tasksCompleted++;
      } else {
        instance.metrics.tasksFailed++;
      }
      
      const duration = Date.now() - startTime;
      const totalTasks = instance.metrics.tasksCompleted + instance.metrics.tasksFailed;
      instance.metrics.averageResponseTime = 
        (instance.metrics.averageResponseTime * (totalTasks - 1) + duration) / totalTasks;
      
      instance.status = 'idle';
      instance.currentTask = undefined;
      
      return { ...result, duration };
      
    } catch (error) {
      instance.status = 'error';
      instance.metrics.tasksFailed++;
      
      return {
        success: false,
        response: '',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Execute via CLI (e.g., claude-code, gemini-cli)
   */
  private async executeViaCli(
    instance: AgentInstance,
    task: string,
    context?: Record<string, unknown>
  ): Promise<AgentExecutionResult> {
    const def = instance.definition;
    
    return new Promise((resolve) => {
      const args = [
        ...(def.cliArgs ?? []),
        '--session-id', instance.sessionId ?? uuidv4(),
        '-p', // Print mode
      ];
      
      // Add context if provided
      let fullTask = task;
      if (context && Object.keys(context).length > 0) {
        fullTask = `Context:\n${JSON.stringify(context, null, 2)}\n\nTask:\n${task}`;
      }
      
      const child = spawn(def.cli!, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Send task to stdin
      child.stdin.write(fullTask);
      child.stdin.end();
      
      child.on('close', (code) => {
        if (code === 0) {
          // Try to parse JSON response
          try {
            const json = JSON.parse(stdout);
            resolve({
              success: true,
              response: json.result ?? json.message ?? json.content ?? stdout,
              tokensUsed: json.usage?.total_tokens,
              duration: 0,
            });
          } catch {
            resolve({
              success: true,
              response: stdout.trim(),
              duration: 0,
            });
          }
        } else {
          resolve({
            success: false,
            response: stdout.trim(),
            error: stderr || `Exit code: ${code}`,
            duration: 0,
          });
        }
      });
      
      child.on('error', (err) => {
        resolve({
          success: false,
          response: '',
          error: err.message,
          duration: 0,
        });
      });
    });
  }
  
  /**
   * Execute via Anthropic API
   */
  private async executeViaAnthropic(
    instance: AgentInstance,
    task: string,
    context?: Record<string, unknown>,
    tools?: ToolDefinition[]
  ): Promise<AgentExecutionResult> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized. Set ANTHROPIC_API_KEY.');
    }
    
    const def = instance.definition;
    const history = this.messageHistory.get(def.id) ?? [];
    
    // Build message with context
    let userMessage = task;
    if (context && Object.keys(context).length > 0) {
      userMessage = `Context:\n${JSON.stringify(context, null, 2)}\n\nTask:\n${task}`;
    }
    
    // Add to history
    history.push({ role: 'user', content: userMessage });
    
    // Convert tools to Anthropic format
    const anthropicTools = tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));
    
    // Call API
    const response = await this.anthropicClient.messages.create({
      model: def.model || 'claude-sonnet-4-20250514',
      max_tokens: def.maxTokens ?? 4096,
      temperature: def.temperature ?? 0.7,
      system: def.systemPrompt,
      messages: history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      tools: anthropicTools,
    });
    
    // Extract text response
    let textResponse = '';
    const toolCalls: AgentExecutionResult['toolCalls'] = [];
    
    for (const block of response.content) {
      if (block.type === 'text') {
        textResponse += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          input: block.input as Record<string, unknown>,
          result: { success: true }, // Would be filled by tool execution
        });
      }
    }
    
    // Add assistant response to history
    history.push({ role: 'assistant', content: textResponse });
    this.messageHistory.set(def.id, history);
    
    return {
      success: true,
      response: textResponse,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      duration: 0,
    };
  }
  
  /**
   * Reset agent session
   */
  resetSession(agentId: string): void {
    const instance = this.sessions.get(agentId);
    if (instance) {
      instance.sessionId = uuidv4();
      this.messageHistory.set(agentId, []);
    }
  }
  
  /**
   * Get conversation history
   */
  getHistory(agentId: string): AgentMessage[] {
    return this.messageHistory.get(agentId) ?? [];
  }
  
  /**
   * Add message to history (for context injection)
   */
  addToHistory(agentId: string, message: AgentMessage): void {
    const history = this.messageHistory.get(agentId) ?? [];
    history.push(message);
    this.messageHistory.set(agentId, history);
  }
  
  /**
   * Get all agent instances
   */
  getAllAgents(): AgentInstance[] {
    return Array.from(this.sessions.values());
  }
  
  /**
   * Get agents by role
   */
  getAgentsByRole(role: AgentRole): AgentInstance[] {
    return Array.from(this.sessions.values())
      .filter(a => a.definition.role === role);
  }
  
  /**
   * Get idle agents
   */
  getIdleAgents(): AgentInstance[] {
    return Array.from(this.sessions.values())
      .filter(a => a.status === 'idle');
  }
  
  /**
   * Get best agent for a role
   */
  getBestAgentForRole(role: AgentRole): AgentInstance | undefined {
    const candidates = this.getAgentsByRole(role)
      .filter(a => a.status === 'idle' && a.definition.enabled);
    
    if (candidates.length === 0) return undefined;
    
    // Sort by success rate
    candidates.sort((a, b) => {
      const aRate = a.metrics.tasksCompleted / 
        (a.metrics.tasksCompleted + a.metrics.tasksFailed || 1);
      const bRate = b.metrics.tasksCompleted / 
        (b.metrics.tasksCompleted + b.metrics.tasksFailed || 1);
      return bRate - aRate;
    });
    
    return candidates[0];
  }
}
