/**
 * Claude Code CLI Provider
 * 
 * Uses the Claude Code CLI (`claude`) as a subprocess to interact with Claude.
 * This allows using Claude Pro/Max subscriptions without API keys.
 * 
 * Based on OpenClaw's implementation of Claude Code CLI integration.
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'eventemitter3';

/**
 * Message types in Claude CLI JSON output
 */
export interface ClaudeCliMessage {
  type: 'system' | 'user' | 'assistant' | 'result';
  session_id?: string;
  message?: ClaudeCliContent;
  result?: ClaudeCliResult;
  subtype?: string;
  cost_usd?: number;
  is_error?: boolean;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  tool?: string;
  tool_input?: unknown;
  tool_result?: unknown;
}

/**
 * Content in a Claude CLI message
 */
export interface ClaudeCliContent {
  id?: string;
  type?: string;
  role?: 'user' | 'assistant';
  model?: string;
  content?: ClaudeCliContentBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

/**
 * Content block in a Claude CLI message
 */
export interface ClaudeCliContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  content?: string;
}

/**
 * Result from Claude CLI
 */
export interface ClaudeCliResult {
  text?: string;
  cost_usd?: number;
  session_id?: string;
  is_error?: boolean;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
}

/**
 * Options for Claude CLI provider
 */
export interface ClaudeCliProviderOptions {
  /** Path to claude CLI command (default: 'claude') */
  command?: string;
  
  /** Additional CLI arguments */
  args?: string[];
  
  /** Model to use (e.g., 'claude-sonnet-4-20250514') */
  model?: string;
  
  /** System prompt */
  systemPrompt?: string;
  
  /** Maximum turns for agentic loop */
  maxTurns?: number;
  
  /** Timeout in milliseconds */
  timeoutMs?: number;
  
  /** Working directory for CLI */
  cwd?: string;
  
  /** Enable verbose output */
  verbose?: boolean;
  
  /** Tools to enable (default: all) */
  tools?: string[];
  
  /** Session ID for continuing conversations */
  sessionId?: string;
}

/**
 * Response from Claude CLI
 */
export interface ClaudeCliResponse {
  /** Response text */
  text: string;
  
  /** Session ID for continuation */
  sessionId?: string;
  
  /** Cost in USD */
  costUsd?: number;
  
  /** Duration in milliseconds */
  durationMs?: number;
  
  /** Number of turns used */
  numTurns?: number;
  
  /** Whether response is an error */
  isError: boolean;
  
  /** Raw messages from CLI */
  rawMessages?: ClaudeCliMessage[];
}

/**
 * Events emitted by Claude CLI Provider
 */
export interface ClaudeCliProviderEvents {
  /** Emitted when a message is received from CLI */
  'message': (message: ClaudeCliMessage) => void;
  
  /** Emitted when streaming text is received */
  'text': (text: string) => void;
  
  /** Emitted when a tool is invoked */
  'tool': (name: string, input: unknown) => void;
  
  /** Emitted on error */
  'error': (error: Error) => void;
  
  /** Emitted when CLI process starts */
  'start': () => void;
  
  /** Emitted when CLI process ends */
  'end': (response: ClaudeCliResponse) => void;
}

/**
 * Claude Code CLI Provider
 * 
 * Spawns the Claude CLI as a subprocess and communicates via JSON.
 */
export class ClaudeCliProvider extends EventEmitter<ClaudeCliProviderEvents> {
  private options: Required<Omit<ClaudeCliProviderOptions, 'sessionId'>> & Pick<ClaudeCliProviderOptions, 'sessionId'>;
  private process: ChildProcess | null = null;
  private currentSessionId?: string;
  
  constructor(options: ClaudeCliProviderOptions = {}) {
    super();
    
    this.options = {
      command: options.command ?? 'claude',
      args: options.args ?? [],
      model: options.model ?? 'claude-sonnet-4-20250514',
      systemPrompt: options.systemPrompt ?? '',
      maxTurns: options.maxTurns ?? 10,
      timeoutMs: options.timeoutMs ?? 300000, // 5 minutes default
      cwd: options.cwd ?? process.cwd(),
      verbose: options.verbose ?? false,
      tools: options.tools ?? [],
      sessionId: options.sessionId,
    };
    
    if (options.sessionId) {
      this.currentSessionId = options.sessionId;
    }
  }
  
  /**
   * Check if Claude CLI is available
   */
  static async isAvailable(command: string = 'claude'): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(command, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
      });
      
      proc.on('close', (code) => {
        resolve(code === 0);
      });
      
      proc.on('error', () => {
        resolve(false);
      });
    });
  }
  
  /**
   * Get Claude CLI version
   */
  static async getVersion(command: string = 'claude'): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn(command, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
      });
      
      let output = '';
      
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          resolve(null);
        }
      });
      
      proc.on('error', () => {
        resolve(null);
      });
    });
  }
  
  /**
   * Send a message and get a response
   * 
   * Uses stdin to pass the message to avoid OS argument length limits (ENAMETOOLONG).
   * This allows for large context windows with project files.
   */
  async send(message: string): Promise<ClaudeCliResponse> {
    return new Promise((resolve, reject) => {
      const args = this.buildArgs(); // No message in args - will use stdin
      
      if (this.options.verbose) {
        console.log(`[ClaudeCliProvider] Running: ${this.options.command} ${args.join(' ')}`);
        console.log(`[ClaudeCliProvider] Message length: ${message.length} bytes (via stdin)`);
      }
      
      this.process = spawn(this.options.command, args, {
        cwd: this.options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.options.timeoutMs,
      });
      
      this.emit('start');
      
      const messages: ClaudeCliMessage[] = [];
      let stdout = '';
      let stderr = '';
      
      this.process.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Parse NDJSON lines
        const lines = stdout.split('\n');
        stdout = lines.pop() ?? ''; // Keep incomplete line
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const msg: ClaudeCliMessage = JSON.parse(line);
            messages.push(msg);
            this.emit('message', msg);
            
            // Emit specific events
            if (msg.type === 'assistant' && msg.message?.content) {
              for (const block of msg.message.content) {
                if (block.type === 'text' && block.text) {
                  this.emit('text', block.text);
                } else if (block.type === 'tool_use' && block.name) {
                  this.emit('tool', block.name, block.input);
                }
              }
            }
          } catch {
            // Ignore non-JSON lines
            if (this.options.verbose) {
              console.log(`[ClaudeCliProvider] Non-JSON: ${line}`);
            }
          }
        }
      });
      
      this.process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      this.process.on('close', (code) => {
        this.process = null;
        
        // Parse any remaining stdout
        if (stdout.trim()) {
          try {
            const msg: ClaudeCliMessage = JSON.parse(stdout);
            messages.push(msg);
          } catch {
            // Ignore
          }
        }
        
        // Build response
        const response = this.buildResponse(messages, code, stderr);
        
        if (response.sessionId) {
          this.currentSessionId = response.sessionId;
        }
        
        this.emit('end', response);
        
        if (response.isError) {
          reject(new Error(response.text || stderr || 'Claude CLI error'));
        } else {
          resolve(response);
        }
      });
      
      this.process.on('error', (error) => {
        this.process = null;
        this.emit('error', error);
        reject(error);
      });
      
      // Write message to stdin and close it
      // This avoids ENAMETOOLONG errors with large prompts
      this.process.stdin?.write(message);
      this.process.stdin?.end();
    });
  }
  
  /**
   * Send a message with streaming callback
   */
  async sendStream(
    message: string,
    onText: (text: string) => void
  ): Promise<ClaudeCliResponse> {
    const handler = (text: string) => onText(text);
    this.on('text', handler);
    
    try {
      return await this.send(message);
    } finally {
      this.off('text', handler);
    }
  }
  
  /**
   * Continue conversation with same session
   */
  async continue(message: string): Promise<ClaudeCliResponse> {
    if (!this.currentSessionId) {
      throw new Error('No session to continue. Call send() first.');
    }
    
    const originalSessionId = this.options.sessionId;
    this.options.sessionId = this.currentSessionId;
    
    try {
      return await this.send(message);
    } finally {
      this.options.sessionId = originalSessionId;
    }
  }
  
  /**
   * Abort current operation
   */
  abort(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
  
  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.currentSessionId;
  }
  
  /**
   * Clear session ID (start fresh)
   */
  clearSession(): void {
    this.currentSessionId = undefined;
  }
  
  /**
   * Build CLI arguments
   * 
   * Note: Message is passed via stdin to avoid ENAMETOOLONG errors.
   * The '-' argument tells claude CLI to read from stdin.
   */
  private buildArgs(): string[] {
    const args: string[] = [
      '--print',              // Non-interactive mode
      '--output-format', 'stream-json',  // Stream JSON for real-time updates
      '--verbose',            // Required for stream-json with --print
      ...this.options.args,
    ];
    
    // Model
    if (this.options.model) {
      args.push('--model', this.options.model);
    }
    
    // System prompt
    if (this.options.systemPrompt) {
      args.push('--system-prompt', this.options.systemPrompt);
    }
    
    // Max turns
    if (this.options.maxTurns) {
      args.push('--max-turns', String(this.options.maxTurns));
    }
    
    // Tools
    if (this.options.tools.length > 0) {
      args.push('--tools', this.options.tools.join(','));
    }
    
    // Session continuation
    if (this.options.sessionId) {
      args.push('--resume', this.options.sessionId);
    }
    
    // Read message from stdin (avoids argument length limits)
    args.push('-');
    
    return args;
  }
  
  /**
   * Build response from CLI messages
   */
  private buildResponse(
    messages: ClaudeCliMessage[],
    exitCode: number | null,
    stderr: string
  ): ClaudeCliResponse {
    // Find the result message
    const resultMsg = messages.find(m => m.type === 'result');
    
    // Collect all text from assistant messages
    const texts: string[] = [];
    let sessionId: string | undefined;
    let costUsd: number | undefined;
    let durationMs: number | undefined;
    let numTurns: number | undefined;
    
    for (const msg of messages) {
      if (msg.session_id) {
        sessionId = msg.session_id;
      }
      
      if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text) {
            texts.push(block.text);
          }
        }
      }
      
      if (msg.type === 'result' && msg.result) {
        if (msg.result.text) {
          texts.push(msg.result.text);
        }
        sessionId = msg.result.session_id ?? sessionId;
        costUsd = msg.result.cost_usd;
        durationMs = msg.result.duration_ms;
        numTurns = msg.result.num_turns;
      }
    }
    
    const isError = exitCode !== 0 || resultMsg?.result?.is_error === true;
    let text = texts.join('\n').trim();
    
    // If no text but error, use stderr
    if (!text && isError && stderr) {
      text = stderr.trim();
    }
    
    return {
      text,
      sessionId,
      costUsd,
      durationMs,
      numTurns,
      isError,
      rawMessages: messages,
    };
  }
}

/**
 * Create a simple one-shot request
 */
export async function claudeCliRequest(
  message: string,
  options?: ClaudeCliProviderOptions
): Promise<string> {
  const provider = new ClaudeCliProvider(options);
  const response = await provider.send(message);
  return response.text;
}

/**
 * Factory function to create provider
 */
export function createClaudeCliProvider(
  options?: ClaudeCliProviderOptions
): ClaudeCliProvider {
  return new ClaudeCliProvider(options);
}
