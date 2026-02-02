/**
 * Telegram Channel for OpenBotMan
 * 
 * Provides bidirectional communication with Telegram.
 * Supports DMs, groups, and inline queries.
 */

import { Bot, Context, session, webhookCallback } from 'grammy';
import type { Message, Update, User, Chat } from 'grammy/types';

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
  /** Bot username */
  botUsername?: string;
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
  attachments?: Array<{
    type: 'photo' | 'video' | 'audio' | 'document' | 'voice' | 'sticker';
    fileId: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
  }>;
}

/**
 * Message handler callback
 */
export type TelegramMessageHandler = (message: TelegramMessage, ctx: Context) => Promise<string | void>;

/**
 * Telegram Channel
 */
export class TelegramChannel {
  private config: TelegramChannelConfig;
  private bot: Bot;
  private messageHandler?: TelegramMessageHandler;
  
  constructor(config: TelegramChannelConfig) {
    this.config = config;
    this.bot = new Bot(config.botToken);
    
    // Set up middleware
    this.setupMiddleware();
    
    // Set up handlers
    this.setupHandlers();
  }
  
  /**
   * Set message handler
   */
  onMessage(handler: TelegramMessageHandler): void {
    this.messageHandler = handler;
  }
  
  /**
   * Set up middleware
   */
  private setupMiddleware(): void {
    // Session middleware (if needed)
    this.bot.use(session({
      initial: () => ({}),
    }));
    
    // Auth middleware
    this.bot.use(async (ctx, next) => {
      // Check allowed users
      if (this.config.allowedUsers?.length) {
        const userId = ctx.from?.id;
        if (!userId || !this.config.allowedUsers.includes(userId)) {
          console.log(`[Telegram] Unauthorized user: ${userId}`);
          return;
        }
      }
      
      // Check allowed chats
      if (this.config.allowedChats?.length) {
        const chatId = ctx.chat?.id;
        if (!chatId || !this.config.allowedChats.includes(chatId)) {
          console.log(`[Telegram] Unauthorized chat: ${chatId}`);
          return;
        }
      }
      
      await next();
    });
  }
  
  /**
   * Set up message handlers
   */
  private setupHandlers(): void {
    // Start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '🤖 Hello! I\'m OpenBotMan - your multi-agent AI assistant.\n\n' +
        'I can help you with:\n' +
        '• Code development and review\n' +
        '• Research and analysis\n' +
        '• Task coordination\n\n' +
        'Just send me a message to get started!'
      );
    });
    
    // Help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '📚 *OpenBotMan Commands*\n\n' +
        '/start - Start the bot\n' +
        '/help - Show this help\n' +
        '/status - Check system status\n' +
        '/agents - List available agents\n\n' +
        'Or just send a message to chat!',
        { parse_mode: 'Markdown' }
      );
    });
    
    // Status command
    this.bot.command('status', async (ctx) => {
      await ctx.reply('✅ OpenBotMan is running!');
    });
    
    // Handle text messages
    this.bot.on('message:text', async (ctx) => {
      await this.handleMessage(ctx);
    });
    
    // Handle photos
    this.bot.on('message:photo', async (ctx) => {
      await this.handleMessage(ctx);
    });
    
    // Handle documents
    this.bot.on('message:document', async (ctx) => {
      await this.handleMessage(ctx);
    });
    
    // Handle voice messages
    this.bot.on('message:voice', async (ctx) => {
      await this.handleMessage(ctx);
    });
    
    // Error handler
    this.bot.catch((err) => {
      console.error('[Telegram] Error:', err);
    });
  }
  
  /**
   * Handle incoming message
   */
  private async handleMessage(ctx: Context): Promise<void> {
    if (!ctx.message || !ctx.from || !ctx.chat) return;
    
    const msg = ctx.message as Message.TextMessage & Message.PhotoMessage & Message.DocumentMessage & Message.VoiceMessage;
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    
    // Check if bot was mentioned in group
    const mentioned = this.wasMentioned(ctx);
    
    // In groups, only respond if mentioned or replied to
    if (isGroup && !mentioned && !this.isReplyToBot(ctx)) {
      return;
    }
    
    // Extract text
    let text = msg.text || msg.caption || '';
    if (mentioned && this.config.botUsername) {
      text = text.replace(new RegExp(`@${this.config.botUsername}`, 'gi'), '').trim();
    }
    
    // Build attachments
    const attachments: TelegramMessage['attachments'] = [];
    
    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1]; // Highest resolution
      attachments.push({
        type: 'photo',
        fileId: photo.file_id,
        fileSize: photo.file_size,
      });
    }
    
    if (msg.document) {
      attachments.push({
        type: 'document',
        fileId: msg.document.file_id,
        fileName: msg.document.file_name,
        mimeType: msg.document.mime_type,
        fileSize: msg.document.file_size,
      });
    }
    
    if (msg.voice) {
      attachments.push({
        type: 'voice',
        fileId: msg.voice.file_id,
        mimeType: msg.voice.mime_type,
        fileSize: msg.voice.file_size,
      });
    }
    
    // Build message object
    const message: TelegramMessage = {
      id: msg.message_id,
      chatId: ctx.chat.id,
      chatType: ctx.chat.type as TelegramMessage['chatType'],
      userId: ctx.from.id,
      userName: this.getUserName(ctx.from),
      userUsername: ctx.from.username,
      text,
      timestamp: new Date(msg.date * 1000),
      isGroup,
      mentioned,
      replyToMessageId: msg.reply_to_message?.message_id,
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    
    // Call handler
    if (this.messageHandler) {
      try {
        // Show typing indicator
        await ctx.replyWithChatAction('typing');
        
        const response = await this.messageHandler(message, ctx);
        
        if (response) {
          // Split long messages
          if (response.length > 4096) {
            const chunks = this.splitMessage(response, 4096);
            for (const chunk of chunks) {
              await ctx.reply(chunk, { parse_mode: 'Markdown' });
            }
          } else {
            await ctx.reply(response, { parse_mode: 'Markdown' });
          }
        }
      } catch (error) {
        console.error('[Telegram] Handler error:', error);
        await ctx.reply('Sorry, an error occurred processing your message.');
      }
    }
  }
  
  /**
   * Check if bot was mentioned
   */
  private wasMentioned(ctx: Context): boolean {
    const text = (ctx.message as any)?.text || '';
    if (!this.config.botUsername) return false;
    return text.toLowerCase().includes(`@${this.config.botUsername.toLowerCase()}`);
  }
  
  /**
   * Check if message is a reply to the bot
   */
  private isReplyToBot(ctx: Context): boolean {
    const replyTo = (ctx.message as any)?.reply_to_message;
    if (!replyTo) return false;
    return replyTo.from?.is_bot === true;
  }
  
  /**
   * Get user display name
   */
  private getUserName(user: User): string {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.first_name || user.username || 'Unknown';
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
   * Start the bot (polling mode)
   */
  async start(): Promise<void> {
    if (this.config.webhookUrl) {
      console.log(`[Telegram] Webhook mode: ${this.config.webhookUrl}`);
      await this.bot.api.setWebhook(this.config.webhookUrl, {
        secret_token: this.config.webhookSecret,
      });
    } else {
      console.log('[Telegram] Starting in polling mode...');
      await this.bot.start({
        drop_pending_updates: true,
      });
    }
  }
  
  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    await this.bot.stop();
  }
  
  /**
   * Get webhook callback for express
   */
  getWebhookCallback() {
    return webhookCallback(this.bot, 'express', {
      secretToken: this.config.webhookSecret,
    });
  }
  
  /**
   * Send a message to a chat
   */
  async sendMessage(chatId: number, text: string): Promise<Message.TextMessage> {
    return this.bot.api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
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
