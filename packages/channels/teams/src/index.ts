/**
 * Microsoft Teams Channel for OpenBotMan
 * 
 * Provides bidirectional communication with Teams.
 * Supports DMs and group conversations.
 */

import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  Activity,
  ActivityTypes,
} from 'botbuilder';
import express from 'express';
import type { Application } from 'express';

/**
 * Teams channel configuration
 */
export interface TeamsChannelConfig {
  /** Microsoft App ID */
  appId: string;
  /** Microsoft App Password */
  appPassword: string;
  /** Tenant ID (optional, for single-tenant) */
  tenantId?: string;
  /** Webhook endpoint path */
  endpoint?: string;
  /** Port for webhook server */
  port?: number;
  /** Allowed users (empty = all) */
  allowedUsers?: string[];
  /** Allowed tenants (empty = all) */
  allowedTenants?: string[];
}

/**
 * Incoming message from Teams
 */
export interface TeamsMessage {
  id: string;
  conversationId: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
  isGroup: boolean;
  mentioned: boolean;
  attachments?: Array<{
    contentType: string;
    content: unknown;
    name?: string;
  }>;
  replyToId?: string;
}

/**
 * Message handler callback
 */
export type TeamsMessageHandler = (message: TeamsMessage, context: TurnContext) => Promise<string | void>;

/**
 * Teams Channel
 */
export class TeamsChannel {
  private config: TeamsChannelConfig;
  private adapter: CloudAdapter;
  private app: Application;
  private messageHandler?: TeamsMessageHandler;
  private conversationReferences: Map<string, Partial<Activity>> = new Map();
  
  constructor(config: TeamsChannelConfig) {
    this.config = {
      endpoint: '/api/messages',
      port: 3978,
      ...config,
    };
    
    // Create bot framework adapter
    const botFrameworkAuth = new ConfigurationBotFrameworkAuthentication({
      MicrosoftAppId: config.appId,
      MicrosoftAppPassword: config.appPassword,
      MicrosoftAppTenantId: config.tenantId,
    });
    
    this.adapter = new CloudAdapter(botFrameworkAuth);
    
    // Error handler
    this.adapter.onTurnError = async (context, error) => {
      console.error('[Teams] Error:', error);
      await context.sendActivity('An error occurred. Please try again.');
    };
    
    // Create express app
    this.app = express();
    this.app.use(express.json());
    
    // Webhook endpoint
    this.app.post(this.config.endpoint!, async (req, res) => {
      await this.adapter.process(req, res, async (context) => {
        await this.handleActivity(context);
      });
    });
    
    // Health check
    this.app.get('/health', (_, res) => {
      res.json({ status: 'ok', channel: 'teams' });
    });
  }
  
  /**
   * Set message handler
   */
  onMessage(handler: TeamsMessageHandler): void {
    this.messageHandler = handler;
  }
  
  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, () => {
        console.log(`[Teams] Webhook listening on port ${this.config.port}`);
        resolve();
      });
    });
  }
  
  /**
   * Handle incoming activity
   */
  private async handleActivity(context: TurnContext): Promise<void> {
    const activity = context.activity;
    
    // Store conversation reference for proactive messaging
    const ref = TurnContext.getConversationReference(activity);
    this.conversationReferences.set(activity.conversation.id, ref);
    
    // Handle different activity types
    switch (activity.type) {
      case ActivityTypes.Message:
        await this.handleMessage(context);
        break;
        
      case ActivityTypes.ConversationUpdate:
        await this.handleConversationUpdate(context);
        break;
        
      case ActivityTypes.Invoke:
        // Handle adaptive card actions, etc.
        break;
    }
  }
  
  /**
   * Handle incoming message
   */
  private async handleMessage(context: TurnContext): Promise<void> {
    const activity = context.activity;
    
    // Security: Check allowed users
    if (this.config.allowedUsers?.length) {
      const userId = activity.from.aadObjectId || activity.from.id;
      if (!this.config.allowedUsers.includes(userId)) {
        console.log(`[Teams] Unauthorized user: ${userId}`);
        return;
      }
    }
    
    // Security: Check allowed tenants
    if (this.config.allowedTenants?.length) {
      const tenantId = activity.conversation.tenantId;
      if (tenantId && !this.config.allowedTenants.includes(tenantId)) {
        console.log(`[Teams] Unauthorized tenant: ${tenantId}`);
        return;
      }
    }
    
    // Check if bot was mentioned in group
    const mentioned = this.wasMentioned(activity);
    const isGroup = activity.conversation.isGroup ?? false;
    
    // In groups, only respond if mentioned
    if (isGroup && !mentioned) {
      return;
    }
    
    // Extract message text (remove bot mention)
    let text = activity.text || '';
    if (mentioned) {
      text = this.removeMention(text);
    }
    
    // Build message object
    const message: TeamsMessage = {
      id: activity.id,
      conversationId: activity.conversation.id,
      userId: activity.from.aadObjectId || activity.from.id,
      userName: activity.from.name,
      text: text.trim(),
      timestamp: new Date(activity.timestamp),
      isGroup,
      mentioned,
      attachments: activity.attachments?.map(a => ({
        contentType: a.contentType,
        content: a.content,
        name: a.name,
      })),
      replyToId: activity.replyToId,
    };
    
    // Call handler
    if (this.messageHandler) {
      try {
        const response = await this.messageHandler(message, context);
        
        if (response) {
          await context.sendActivity(response);
        }
      } catch (error) {
        console.error('[Teams] Handler error:', error);
        await context.sendActivity('Sorry, an error occurred processing your message.');
      }
    }
  }
  
  /**
   * Handle conversation update (join/leave)
   */
  private async handleConversationUpdate(context: TurnContext): Promise<void> {
    const activity = context.activity;
    
    // Bot was added to conversation
    if (activity.membersAdded?.some(m => m.id === activity.recipient.id)) {
      await context.sendActivity(
        'Hello! I\'m OpenBotMan - your multi-agent AI assistant. ' +
        'How can I help you today?'
      );
    }
  }
  
  /**
   * Check if bot was mentioned
   */
  private wasMentioned(activity: Activity): boolean {
    if (!activity.entities) return false;
    
    return activity.entities.some(
      e => e.type === 'mention' && 
           (e as any).mentioned?.id === activity.recipient.id
    );
  }
  
  /**
   * Remove bot mention from text
   */
  private removeMention(text: string): string {
    // Remove <at>BotName</at> pattern
    return text.replace(/<at>[^<]*<\/at>/gi, '').trim();
  }
  
  /**
   * Send a proactive message to a conversation
   */
  async sendMessage(conversationId: string, message: string): Promise<void> {
    const ref = this.conversationReferences.get(conversationId);
    if (!ref) {
      throw new Error(`No conversation reference for: ${conversationId}`);
    }
    
    await this.adapter.continueConversationAsync(
      this.config.appId,
      ref,
      async (context) => {
        await context.sendActivity(message);
      }
    );
  }
  
  /**
   * Send an adaptive card
   */
  async sendCard(conversationId: string, card: unknown): Promise<void> {
    const ref = this.conversationReferences.get(conversationId);
    if (!ref) {
      throw new Error(`No conversation reference for: ${conversationId}`);
    }
    
    await this.adapter.continueConversationAsync(
      this.config.appId,
      ref,
      async (context) => {
        await context.sendActivity({
          attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: card,
          }],
        });
      }
    );
  }
  
  /**
   * Get stored conversation references
   */
  getConversationReferences(): Map<string, Partial<Activity>> {
    return this.conversationReferences;
  }
}

export default TeamsChannel;
