/**
 * Telegram Channel for OpenBotMan
 * 
 * Provides bidirectional communication with Telegram.
 * Supports DMs, groups, inline queries, and inline keyboards.
 */

import { Bot, Context, webhookCallback, InlineKeyboard, GrammyError, HttpError } from 'grammy';
import type { Message, User } from 'grammy/types';
import { EventEmitter } from 'eventemitter3';

/**
 * Telegram channel configuration
 */
export interface TelegramChannelConfig {
  /** Bot token from @BotFather */
  botToken: string;
  /** Webhook URL (optional, uses polling if not set) */
  webhookUrl?: string;
  /** Webhook secret (optional) */
  webhookSecret?: string;
  /** Allowed user IDs (empty = all) */
  allowedUsers?: number[];
  /** Allowed chat IDs (empty = all) */
  allowedChats?: number[];
  /** Bot username (fetched automatically if not set) */
  botUsername?: string;
  /** Enable verbose logging */
  debug?: boolean;
}

/**
 * Incoming message from Telegram
 */
export interface TelegramMessage {
  id: number;
  chatId: number;
  chatType: 'private' | 'group' | 'supergroup' | 'channel';
  userId: number;
  userName: string;
  userUsername?: string;
  text: string;
  timestamp: Date;
  isGroup: boolean;
  mentioned: boolean;
  replyToMessageId?: number;
  attachments?: TelegramAttachment[];
  callbackData?: string;
}

/**
 * Attachment types
 */
export interface TelegramAttachment {
  type: 'photo' | 'video' | 'audio' | 'document' | 'voice' | 'sticker';
  fileId: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

/**
 * Inline button for keyboard
 */
export interface TelegramButton {
  text: string;
  callbackData?: string;
  url?: string;
}

/**
 * Message handler callback
 */
export type TelegramMessageHandler = (message: TelegramMessage, ctx: Context) => Promise<string | TelegramReply | void>;

/**
 * Command handler callback
 */
export type TelegramCommandHandler = (args: string, message: TelegramMessage, ctx: Context) => Promise<string | TelegramReply | void>;

/**
 * Callback query handler
 */
export type TelegramCallbackHandler = (data: string, message: TelegramMessage, ctx: Context) => Promise<string | void>;

/**
 * Reply with inline keyboard
 */
export interface TelegramReply {
  text: string;
  buttons?: TelegramButton[][];
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  replyToMessageId?: number;
  editMessageId?: number;
}

/**
 * Agent info for display
 */
export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  description?: string;
}

/**
 * Orchestrator integration interface
 */
export interface OrchestratorAdapter {
  chat(message: string, userId?: string): Promise<string>;
  getStatus(): Record<string, unknown>;
  getAgents(): AgentInfo[];
  startDiscussion(topic: string, participants?: string[]): Promise<string>;
  onDiscussionUpdate?(callback: (roomId: string, message: string, isComplete: boolean) => void): void;
}

/**
 * Channel events
 */
export interface TelegramChannelEvents {
  'message': (message: TelegramMessage) => void;
  'command': (command: string, args: string, message: TelegramMessage) => void;
  'callback': (data: string, message: TelegramMessage) => void;
  'error': (error: Error) => void;
  'started': () => void;
  'stopped': () => void;
}

/**
 * Telegram Channel
 */
export class TelegramChannel extends EventEmitter<TelegramChannelEvents> {
  private config: TelegramChannelConfig;
  private bot: Bot;
  private messageHandler?: TelegramMessageHandler;
  private commandHandlers: Map<string, TelegramCommandHandler> = new Map();
  private callbackHandler?: TelegramCallbackHandler;
  private orchestrator?: OrchestratorAdapter;
  private activeDiscussions: Map<number, { roomId: string; chatId: number }> = new Map();
  private isRunning = false;
  
  constructor(config: TelegramChannelConfig) {
    super();
    this.config = config;
    this.bot = new Bot(config.botToken);
    
    // Set up middleware
    this.setupMiddleware();
    
    // Set up default handlers
    this.setupDefaultHandlers();
  }
  
  /**
   * Connect orchestrator for AI processing
   */
  connectOrchestrator(orchestrator: OrchestratorAdapter): void {
    this.orchestrator = orchestrator;
    
    // Subscribe to discussion updates if supported
    if (orchestrator.onDiscussionUpdate) {
      orchestrator.onDiscussionUpdate((roomId, message, isComplete) => {
        // Find chat for this discussion
        for (const [userId, disc] of this.activeDiscussions) {
          if (disc.roomId === roomId) {
            this.sendMessage(disc.chatId, message).catch((err: Error) => {
              // eslint-disable-next-line no-console
              console.error('[Telegram] Failed to send discussion update:', err);
            });
            
            if (isComplete) {
              this.activeDiscussions.delete(userId);
            }
            break;
          }
        }
      });
    }
  }
  
  /**
   * Set message handler for all non-command messages
   */
  onMessage(handler: TelegramMessageHandler): void {
    this.messageHandler = handler;
  }
  
  /**
   * Register a command handler
   */
  onCommand(command: string, handler: TelegramCommandHandler): void {
    this.commandHandlers.set(command.toLowerCase(), handler);
  }
  
  /**
   * Set callback query handler
   */
  onCallback(handler: TelegramCallbackHandler): void {
    this.callbackHandler = handler;
  }
  
  /**
   * Set up middleware
   */
  private setupMiddleware(): void {
    // Auth middleware
    this.bot.use(async (ctx: Context, next: () => Promise<void>) => {
      // Check allowed users
      if (this.config.allowedUsers?.length) {
        const userId = ctx.from?.id;
        if (!userId || !this.config.allowedUsers.includes(userId)) {
          this.log(`Unauthorized user: ${userId}`);
          return;
        }
      }
      
      // Check allowed chats
      if (this.config.allowedChats?.length) {
        const chatId = ctx.chat?.id;
        if (!chatId || !this.config.allowedChats.includes(chatId)) {
          this.log(`Unauthorized chat: ${chatId}`);
          return;
        }
      }
      
      await next();
    });
  }
  
  /**
   * Set up default command handlers
   */
  private setupDefaultHandlers(): void {
    // Start command
    this.bot.command('start', async (ctx: Context) => {
      const customHandler = this.commandHandlers.get('start');
      const message = this.buildMessage(ctx);
      
      if (customHandler) {
        const result = await customHandler('', message, ctx);
        await this.sendReply(ctx, result);
        return;
      }
      
      const keyboard = new InlineKeyboard()
        .text('📋 Status', 'cmd:status')
        .text('🤖 Agents', 'cmd:agents')
        .row()
        .text('❓ Help', 'cmd:help');
      
      await ctx.reply(
        '🤖 *Welcome to OpenBotMan!*\n\n' +
        'I\'m your multi-agent AI assistant. I can help you with:\n\n' +
        '• 💻 Code development and review\n' +
        '• 🔍 Research and analysis\n' +
        '• 📋 Task coordination\n' +
        '• 🗣️ Multi-agent discussions\n\n' +
        'Just send me a message or use the buttons below!',
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
      
      this.emit('command', 'start', '', message);
    });
    
    // Help command
    this.bot.command('help', async (ctx: Context) => {
      const customHandler = this.commandHandlers.get('help');
      const message = this.buildMessage(ctx);
      
      if (customHandler) {
        const result = await customHandler('', message, ctx);
        await this.sendReply(ctx, result);
        return;
      }
      
      await ctx.reply(
        '📚 *OpenBotMan Commands*\n\n' +
        '`/start` - Start the bot\n' +
        '`/help` - Show this help\n' +
        '`/status` - Check system status\n' +
        '`/agents` - List available agents\n' +
        '`/chat <message>` - Chat with the AI team\n' +
        '`/discuss <topic>` - Start a multi-agent discussion\n\n' +
        '_Or just send a message to chat directly!_',
        { parse_mode: 'Markdown' }
      );
      
      this.emit('command', 'help', '', message);
    });
    
    // Status command
    this.bot.command('status', async (ctx: Context) => {
      const customHandler = this.commandHandlers.get('status');
      const message = this.buildMessage(ctx);
      
      if (customHandler) {
        const result = await customHandler('', message, ctx);
        await this.sendReply(ctx, result);
        return;
      }
      
      await this.sendStatusMessage(ctx);
      this.emit('command', 'status', '', message);
    });
    
    // Agents command
    this.bot.command('agents', async (ctx: Context) => {
      const customHandler = this.commandHandlers.get('agents');
      const message = this.buildMessage(ctx);
      
      if (customHandler) {
        const result = await customHandler('', message, ctx);
        await this.sendReply(ctx, result);
        return;
      }
      
      await this.sendAgentsMessage(ctx);
      this.emit('command', 'agents', '', message);
    });
    
    // Chat command
    this.bot.command('chat', async (ctx: Context) => {
      const args = (ctx.match as string)?.trim() || '';
      const message = this.buildMessage(ctx);
      
      const customHandler = this.commandHandlers.get('chat');
      if (customHandler) {
        const result = await customHandler(args, message, ctx);
        await this.sendReply(ctx, result);
        return;
      }
      
      if (!args) {
        await ctx.reply('Usage: `/chat <your message>`', { parse_mode: 'Markdown' });
        return;
      }
      
      await this.handleChatMessage(ctx, args, message);
      this.emit('command', 'chat', args, message);
    });
    
    // Discuss command
    this.bot.command('discuss', async (ctx: Context) => {
      const args = (ctx.match as string)?.trim() || '';
      const message = this.buildMessage(ctx);
      
      const customHandler = this.commandHandlers.get('discuss');
      if (customHandler) {
        const result = await customHandler(args, message, ctx);
        await this.sendReply(ctx, result);
        return;
      }
      
      if (!args) {
        await ctx.reply('Usage: `/discuss <topic>`\n\nExample: `/discuss What architecture should we use for the payment system?`', { parse_mode: 'Markdown' });
        return;
      }
      
      await this.startDiscussion(ctx, args);
      this.emit('command', 'discuss', args, message);
    });
    
    // Handle callback queries (inline button presses)
    this.bot.on('callback_query:data', async (ctx: Context) => {
      const data = ctx.callbackQuery?.data || '';
      const message = this.buildMessage(ctx);
      
      // Answer callback to remove loading indicator
      await ctx.answerCallbackQuery();
      
      // Handle built-in callbacks
      if (data.startsWith('cmd:')) {
        const cmd = data.slice(4);
        await this.handleBuiltinCallback(ctx, cmd);
        return;
      }
      
      if (data.startsWith('agent:')) {
        const agentId = data.slice(6);
        await this.sendAgentDetails(ctx, agentId);
        return;
      }
      
      if (data.startsWith('discuss:stop:')) {
        const parts = data.split(':');
        const userId = parseInt(parts[2] || '0', 10);
        await this.stopDiscussion(ctx, userId);
        return;
      }
      
      // Custom callback handler
      if (this.callbackHandler) {
        const result = await this.callbackHandler(data, message, ctx);
        if (result) {
          await ctx.reply(result, { parse_mode: 'Markdown' });
        }
      }
      
      this.emit('callback', data, message);
    });
    
    // Handle text messages
    this.bot.on('message:text', async (ctx: Context) => {
      // Skip commands (they're handled separately)
      const text = (ctx.message as Message.TextMessage)?.text;
      if (text?.startsWith('/')) return;
      
      const message = this.buildMessage(ctx);
      await this.handleIncomingMessage(ctx, message);
    });
    
    // Handle photos
    this.bot.on('message:photo', async (ctx: Context) => {
      const message = this.buildMessage(ctx);
      await this.handleIncomingMessage(ctx, message);
    });
    
    // Handle documents
    this.bot.on('message:document', async (ctx: Context) => {
      const message = this.buildMessage(ctx);
      await this.handleIncomingMessage(ctx, message);
    });
    
    // Handle voice messages
    this.bot.on('message:voice', async (ctx: Context) => {
      const message = this.buildMessage(ctx);
      await this.handleIncomingMessage(ctx, message);
    });
    
    // Error handler
    this.bot.catch((err: { error: unknown }) => {
      let error: Error;
      
      if (err.error instanceof GrammyError) {
        error = new Error(`Grammy error: ${err.error.description}`);
      } else if (err.error instanceof HttpError) {
        error = new Error(`HTTP error: ${err.error.message}`);
      } else if (err.error instanceof Error) {
        error = err.error;
      } else {
        error = new Error(String(err.error));
      }
      
      // eslint-disable-next-line no-console
      console.error('[Telegram] Error:', error.message);
      this.emit('error', error);
    });
  }
  
  /**
   * Send status message
   */
  private async sendStatusMessage(ctx: Context, edit = false): Promise<void> {
    if (this.orchestrator) {
      const status = this.orchestrator.getStatus();
      const agents = status.agents as Array<{ id: string; status: string; tasks: number }> || [];
      const tasks = status.tasks as { total: number; active: number } || { total: 0, active: 0 };
      
      const agentList = agents.map(a => 
        `${this.getStatusEmoji(a.status)} ${a.id} (${a.tasks} tasks)`
      ).join('\n');
      
      const keyboard = new InlineKeyboard()
        .text('🔄 Refresh', 'cmd:status')
        .text('🤖 Agents', 'cmd:agents');
      
      const text = '📊 *System Status*\n\n' +
        `⏱️ Uptime: ${status.uptime}s\n` +
        `📝 Tasks: ${tasks.total} (${tasks.active} active)\n` +
        `🎫 Tokens used: ${status.tokens}\n\n` +
        '*Agents:*\n' + agentList;
      
      if (edit && ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
    } else {
      await ctx.reply('✅ OpenBotMan is running!\n\n_No orchestrator connected._', { parse_mode: 'Markdown' });
    }
  }
  
  /**
   * Send agents list message
   */
  private async sendAgentsMessage(ctx: Context, edit = false): Promise<void> {
    if (!this.orchestrator) {
      await ctx.reply('_No orchestrator connected._', { parse_mode: 'Markdown' });
      return;
    }
    
    const agents = this.orchestrator.getAgents();
    
    if (agents.length === 0) {
      await ctx.reply('No agents configured.');
      return;
    }
    
    const agentList = agents.map(a => 
      `${this.getStatusEmoji(a.status)} ${this.getRoleEmoji(a.role)} *${a.name}* (${a.id})\n   _${a.role}_ ${a.description ? `- ${a.description}` : ''}`
    ).join('\n\n');
    
    // Create buttons for each agent
    const keyboard = new InlineKeyboard();
    agents.forEach((a, i) => {
      keyboard.text(`${this.getRoleEmoji(a.role)} ${a.id}`, `agent:${a.id}`);
      if ((i + 1) % 3 === 0) keyboard.row();
    });
    
    const text = '🤖 *Available Agents*\n\n' + agentList;
    
    if (edit && ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }
  
  /**
   * Send agent details
   */
  private async sendAgentDetails(ctx: Context, agentId: string): Promise<void> {
    if (!this.orchestrator) return;
    
    const agents = this.orchestrator.getAgents();
    const agent = agents.find(a => a.id === agentId);
    
    if (agent) {
      await ctx.reply(
        `🤖 *${agent.name}*\n\n` +
        `ID: \`${agent.id}\`\n` +
        `Role: ${agent.role}\n` +
        `Status: ${this.getStatusEmoji(agent.status)} ${agent.status}\n` +
        (agent.description ? `\n_${agent.description}_` : ''),
        { parse_mode: 'Markdown' }
      );
    }
  }
  
  /**
   * Handle built-in callback commands
   */
  private async handleBuiltinCallback(ctx: Context, cmd: string): Promise<void> {
    switch (cmd) {
      case 'status':
        await this.sendStatusMessage(ctx, true);
        break;
      case 'agents':
        await this.sendAgentsMessage(ctx, true);
        break;
      case 'help':
        await ctx.editMessageText(
          '📚 *Commands:*\n\n' +
          '`/chat <msg>` - Chat\n' +
          '`/discuss <topic>` - Discuss\n' +
          '`/status` - Status\n' +
          '`/agents` - Agents',
          { parse_mode: 'Markdown' }
        );
        break;
    }
  }
  
  /**
   * Start a discussion
   */
  private async startDiscussion(ctx: Context, topic: string): Promise<void> {
    if (!this.orchestrator) {
      await ctx.reply('_No orchestrator connected._', { parse_mode: 'Markdown' });
      return;
    }
    
    await ctx.replyWithChatAction('typing');
    
    const keyboard = new InlineKeyboard()
      .text('⏹️ Stop Discussion', `discuss:stop:${ctx.from?.id}`);
    
    await ctx.reply(
      `🗣️ *Starting Discussion*\n\nTopic: _${this.escapeMarkdown(topic)}_\n\nAgents are gathering...`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    
    try {
      const roomId = await this.orchestrator.startDiscussion(topic);
      if (ctx.from && ctx.chat) {
        this.activeDiscussions.set(ctx.from.id, { roomId, chatId: ctx.chat.id });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await ctx.reply(`❌ Failed to start discussion: ${errMsg}`);
    }
  }
  
  /**
   * Stop a discussion
   */
  private async stopDiscussion(ctx: Context, userId: number): Promise<void> {
    const disc = this.activeDiscussions.get(userId);
    if (disc && ctx.from?.id === userId) {
      this.activeDiscussions.delete(userId);
      await ctx.editMessageText('🛑 Discussion stopped.');
    }
  }
  
  /**
   * Handle incoming non-command message
   */
  private async handleIncomingMessage(ctx: Context, message: TelegramMessage): Promise<void> {
    if (!ctx.message || !ctx.from || !ctx.chat) return;
    
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    const mentioned = this.wasMentioned(ctx);
    
    // In groups, only respond if mentioned or replied to
    if (isGroup && !mentioned && !this.isReplyToBot(ctx)) {
      return;
    }
    
    this.emit('message', message);
    
    // Try custom handler first
    if (this.messageHandler) {
      try {
        await ctx.replyWithChatAction('typing');
        const result = await this.messageHandler(message, ctx);
        await this.sendReply(ctx, result);
        return;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[Telegram] Handler error:', error);
        await ctx.reply('Sorry, an error occurred processing your message.');
        return;
      }
    }
    
    // Fall back to orchestrator chat
    await this.handleChatMessage(ctx, message.text, message);
  }
  
  /**
   * Handle chat message with orchestrator
   */
  private async handleChatMessage(ctx: Context, text: string, _message: TelegramMessage): Promise<void> {
    if (!this.orchestrator) {
      await ctx.reply('_No AI backend connected._', { parse_mode: 'Markdown' });
      return;
    }
    
    try {
      await ctx.replyWithChatAction('typing');
      
      const response = await this.orchestrator.chat(text, ctx.from?.id.toString());
      
      // Split long messages
      if (response.length > 4096) {
        const chunks = this.splitMessage(response, 4096);
        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: 'Markdown' });
        }
      } else {
        await ctx.reply(response, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Telegram] Orchestrator error:', error);
      await ctx.reply('Sorry, an error occurred. Please try again.');
    }
  }
  
  /**
   * Build message object from context
   */
  private buildMessage(ctx: Context): TelegramMessage {
    const msg = ctx.message || ctx.callbackQuery?.message;
    const from = ctx.from || (ctx.callbackQuery?.message as Message)?.from;
    const chat = ctx.chat || ctx.callbackQuery?.message?.chat;
    
    const isGroup = chat?.type === 'group' || chat?.type === 'supergroup';
    const mentioned = this.wasMentioned(ctx);
    
    // Extract text
    let text = '';
    if (ctx.message) {
      const m = ctx.message as Message.TextMessage & Message.CaptionableMessage;
      text = (m as Message.TextMessage).text || m.caption || '';
      if (mentioned && this.config.botUsername) {
        text = text.replace(new RegExp(`@${this.config.botUsername}`, 'gi'), '').trim();
      }
    }
    
    // Build attachments
    const attachments: TelegramAttachment[] = [];
    if (ctx.message) {
      const m = ctx.message as Message.PhotoMessage & Message.DocumentMessage & Message.VoiceMessage;
      
      const photoMsg = m as Message.PhotoMessage;
      if (photoMsg.photo && photoMsg.photo.length > 0) {
        const largest = photoMsg.photo[photoMsg.photo.length - 1];
        if (largest) {
          attachments.push({
            type: 'photo',
            fileId: largest.file_id,
            fileSize: largest.file_size,
          });
        }
      }
      
      const docMsg = m as Message.DocumentMessage;
      if (docMsg.document) {
        attachments.push({
          type: 'document',
          fileId: docMsg.document.file_id,
          fileName: docMsg.document.file_name,
          mimeType: docMsg.document.mime_type,
          fileSize: docMsg.document.file_size,
        });
      }
      
      const voiceMsg = m as Message.VoiceMessage;
      if (voiceMsg.voice) {
        attachments.push({
          type: 'voice',
          fileId: voiceMsg.voice.file_id,
          mimeType: voiceMsg.voice.mime_type,
          fileSize: voiceMsg.voice.file_size,
        });
      }
    }
    
    return {
      id: msg?.message_id || 0,
      chatId: chat?.id || 0,
      chatType: (chat?.type || 'private') as TelegramMessage['chatType'],
      userId: from?.id || 0,
      userName: this.getUserName(from),
      userUsername: from?.username,
      text,
      timestamp: msg ? new Date((msg as Message).date * 1000) : new Date(),
      isGroup: isGroup || false,
      mentioned,
      replyToMessageId: (ctx.message as Message.CommonMessage)?.reply_to_message?.message_id,
      attachments: attachments.length > 0 ? attachments : undefined,
      callbackData: ctx.callbackQuery?.data,
    };
  }
  
  /**
   * Send reply based on result type
   */
  private async sendReply(ctx: Context, result: string | TelegramReply | void): Promise<void> {
    if (!result) return;
    
    if (typeof result === 'string') {
      if (result.length > 4096) {
        const chunks = this.splitMessage(result, 4096);
        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: 'Markdown' });
        }
      } else {
        await ctx.reply(result, { parse_mode: 'Markdown' });
      }
    } else {
      const keyboard = result.buttons ? this.buildKeyboard(result.buttons) : undefined;
      
      if (result.editMessageId && ctx.callbackQuery) {
        await ctx.editMessageText(result.text, { 
          parse_mode: result.parseMode || 'Markdown',
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(result.text, {
          parse_mode: result.parseMode || 'Markdown',
          reply_markup: keyboard,
          reply_parameters: result.replyToMessageId ? { message_id: result.replyToMessageId } : undefined,
        });
      }
    }
  }
  
  /**
   * Build inline keyboard from button definitions
   */
  private buildKeyboard(buttons: TelegramButton[][]): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    for (const row of buttons) {
      for (const btn of row) {
        if (btn.url) {
          keyboard.url(btn.text, btn.url);
        } else if (btn.callbackData) {
          keyboard.text(btn.text, btn.callbackData);
        }
      }
      keyboard.row();
    }
    
    return keyboard;
  }
  
  /**
   * Check if bot was mentioned
   */
  private wasMentioned(ctx: Context): boolean {
    const text = (ctx.message as Message.TextMessage)?.text || '';
    if (!this.config.botUsername) return false;
    return text.toLowerCase().includes(`@${this.config.botUsername.toLowerCase()}`);
  }
  
  /**
   * Check if message is a reply to the bot
   */
  private isReplyToBot(ctx: Context): boolean {
    const replyTo = (ctx.message as Message.CommonMessage)?.reply_to_message;
    if (!replyTo) return false;
    return replyTo.from?.is_bot === true;
  }
  
  /**
   * Get user display name
   */
  private getUserName(user?: User): string {
    if (!user) return 'Unknown';
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.first_name || user.username || 'Unknown';
  }
  
  /**
   * Escape markdown special characters
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }
  
  /**
   * Get status emoji
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'idle': return '🟢';
      case 'busy': return '🟡';
      case 'error': return '🔴';
      default: return '⚫';
    }
  }
  
  /**
   * Get role emoji
   */
  private getRoleEmoji(role: string): string {
    switch (role.toLowerCase()) {
      case 'coder': return '💻';
      case 'reviewer': return '🔍';
      case 'architect': return '🏗️';
      case 'tester': return '🧪';
      case 'researcher': return '📚';
      case 'writer': return '✍️';
      default: return '🤖';
    }
  }
  
  /**
   * Split long message into chunks
   */
  private splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }
      
      // Find a good split point
      let splitAt = maxLength;
      const lastNewline = remaining.lastIndexOf('\n', maxLength);
      const lastSpace = remaining.lastIndexOf(' ', maxLength);
      
      if (lastNewline > maxLength * 0.5) {
        splitAt = lastNewline;
      } else if (lastSpace > maxLength * 0.5) {
        splitAt = lastSpace;
      }
      
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trim();
    }
    
    return chunks;
  }
  
  /**
   * Log message (only in debug mode)
   */
  private log(message: string): void {
    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.log(`[Telegram] ${message}`);
    }
  }
  
  /**
   * Start the bot (polling mode)
   */
  async start(): Promise<void> {
    // Fetch bot username if not set
    if (!this.config.botUsername) {
      try {
        const me = await this.bot.api.getMe();
        this.config.botUsername = me.username;
        this.log(`Bot username: @${this.config.botUsername}`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[Telegram] Failed to fetch bot info:', error);
      }
    }
    
    if (this.config.webhookUrl) {
      this.log(`Webhook mode: ${this.config.webhookUrl}`);
      await this.bot.api.setWebhook(this.config.webhookUrl, {
        secret_token: this.config.webhookSecret,
      });
    } else {
      this.log('Starting in polling mode...');
      await this.bot.start({
        drop_pending_updates: true,
      });
    }
    
    this.isRunning = true;
    this.emit('started');
  }
  
  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    await this.bot.stop();
    this.isRunning = false;
    this.emit('stopped');
  }
  
  /**
   * Check if bot is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
  
  /**
   * Get webhook callback for express/hono/etc
   */
  getWebhookCallback() {
    return webhookCallback(this.bot, 'express', {
      secretToken: this.config.webhookSecret,
    });
  }
  
  /**
   * Send a message to a chat
   */
  async sendMessage(chatId: number, text: string, options?: {
    parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    buttons?: TelegramButton[][];
    replyToMessageId?: number;
  }): Promise<Message.TextMessage> {
    const keyboard = options?.buttons ? this.buildKeyboard(options.buttons) : undefined;
    
    return this.bot.api.sendMessage(chatId, text, { 
      parse_mode: options?.parseMode || 'Markdown',
      reply_markup: keyboard,
      reply_parameters: options?.replyToMessageId ? { message_id: options.replyToMessageId } : undefined,
    });
  }
  
  /**
   * Send a photo
   */
  async sendPhoto(chatId: number, photo: string, caption?: string): Promise<Message.PhotoMessage> {
    return this.bot.api.sendPhoto(chatId, photo, { caption, parse_mode: 'Markdown' });
  }
  
  /**
   * Send a document
   */
  async sendDocument(chatId: number, document: string, caption?: string): Promise<Message.DocumentMessage> {
    return this.bot.api.sendDocument(chatId, document, { caption, parse_mode: 'Markdown' });
  }
  
  /**
   * Edit a message
   */
  async editMessage(chatId: number, messageId: number, text: string, options?: {
    parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    buttons?: TelegramButton[][];
  }): Promise<Message.TextMessage | true> {
    const keyboard = options?.buttons ? this.buildKeyboard(options.buttons) : undefined;
    
    return this.bot.api.editMessageText(chatId, messageId, text, {
      parse_mode: options?.parseMode || 'Markdown',
      reply_markup: keyboard,
    });
  }
  
  /**
   * Delete a message
   */
  async deleteMessage(chatId: number, messageId: number): Promise<boolean> {
    return this.bot.api.deleteMessage(chatId, messageId);
  }
  
  /**
   * Send typing indicator
   */
  async sendTyping(chatId: number): Promise<boolean> {
    return this.bot.api.sendChatAction(chatId, 'typing');
  }
  
  /**
   * Get file URL for downloading
   */
  async getFileUrl(fileId: string): Promise<string> {
    const file = await this.bot.api.getFile(fileId);
    return `https://api.telegram.org/file/bot${this.config.botToken}/${file.file_path}`;
  }
  
  /**
   * Get bot info
   */
  async getBotInfo() {
    return this.bot.api.getMe();
  }
  
  /**
   * Get underlying bot instance
   */
  getBot(): Bot {
    return this.bot;
  }
}

export default TelegramChannel;