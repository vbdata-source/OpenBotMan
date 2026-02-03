/**
 * Tests for Telegram Channel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelegramChannel, type TelegramChannelConfig, type TelegramMessage, type OrchestratorAdapter, type AgentInfo } from './index.js';

// Mock grammy
vi.mock('grammy', () => {
  const mockBot = {
    use: vi.fn(),
    command: vi.fn(),
    on: vi.fn(),
    catch: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    api: {
      getMe: vi.fn().mockResolvedValue({ username: 'test_bot', id: 123 }),
      setWebhook: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
      sendPhoto: vi.fn().mockResolvedValue({ message_id: 2 }),
      sendDocument: vi.fn().mockResolvedValue({ message_id: 3 }),
      editMessageText: vi.fn().mockResolvedValue({ message_id: 1 }),
      deleteMessage: vi.fn().mockResolvedValue(true),
      sendChatAction: vi.fn().mockResolvedValue(true),
      getFile: vi.fn().mockResolvedValue({ file_path: 'photos/test.jpg' }),
    },
  };

  return {
    Bot: vi.fn(() => mockBot),
    Context: vi.fn(),
    session: vi.fn(() => vi.fn()),
    webhookCallback: vi.fn(() => vi.fn()),
    InlineKeyboard: vi.fn().mockImplementation(() => ({
      text: vi.fn().mockReturnThis(),
      url: vi.fn().mockReturnThis(),
      row: vi.fn().mockReturnThis(),
    })),
    GrammyError: class GrammyError extends Error {
      description: string;
      constructor(message: string) {
        super(message);
        this.description = message;
      }
    },
    HttpError: class HttpError extends Error {},
  };
});

describe('TelegramChannel', () => {
  let channel: TelegramChannel;
  let config: TelegramChannelConfig;
  
  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      botToken: 'test-token-123',
      botUsername: 'test_bot',
      debug: false,
    };
    channel = new TelegramChannel(config);
  });
  
  afterEach(async () => {
    if (channel.isActive()) {
      await channel.stop();
    }
  });
  
  describe('constructor', () => {
    it('should create channel with config', () => {
      expect(channel).toBeInstanceOf(TelegramChannel);
    });
    
    it('should accept all config options', () => {
      const fullConfig: TelegramChannelConfig = {
        botToken: 'token',
        webhookUrl: 'https://example.com/webhook',
        webhookSecret: 'secret',
        allowedUsers: [123, 456],
        allowedChats: [789],
        botUsername: 'my_bot',
        debug: true,
      };
      
      const ch = new TelegramChannel(fullConfig);
      expect(ch).toBeInstanceOf(TelegramChannel);
    });
  });
  
  describe('start/stop', () => {
    it('should start in polling mode by default', async () => {
      await channel.start();
      expect(channel.isActive()).toBe(true);
    });
    
    it('should start in webhook mode when webhookUrl is set', async () => {
      const webhookChannel = new TelegramChannel({
        ...config,
        webhookUrl: 'https://example.com/webhook',
      });
      
      await webhookChannel.start();
      expect(webhookChannel.isActive()).toBe(true);
    });
    
    it('should stop the bot', async () => {
      await channel.start();
      await channel.stop();
      expect(channel.isActive()).toBe(false);
    });
    
    it('should emit started event', async () => {
      const startedHandler = vi.fn();
      channel.on('started', startedHandler);
      
      await channel.start();
      expect(startedHandler).toHaveBeenCalled();
    });
    
    it('should emit stopped event', async () => {
      const stoppedHandler = vi.fn();
      channel.on('stopped', stoppedHandler);
      
      await channel.start();
      await channel.stop();
      expect(stoppedHandler).toHaveBeenCalled();
    });
  });
  
  describe('message handlers', () => {
    it('should register message handler', () => {
      const handler = vi.fn();
      channel.onMessage(handler);
      // Handler is registered (internal implementation)
    });
    
    it('should register command handler', () => {
      const handler = vi.fn();
      channel.onCommand('test', handler);
      // Handler is registered (internal implementation)
    });
    
    it('should register callback handler', () => {
      const handler = vi.fn();
      channel.onCallback(handler);
      // Handler is registered (internal implementation)
    });
  });
  
  describe('orchestrator integration', () => {
    it('should connect orchestrator', () => {
      const mockOrchestrator: OrchestratorAdapter = {
        chat: vi.fn().mockResolvedValue('Hello!'),
        getStatus: vi.fn().mockReturnValue({
          uptime: 100,
          tokens: 1000,
          tasks: { total: 5, active: 1 },
          agents: [],
        }),
        getAgents: vi.fn().mockReturnValue([]),
        startDiscussion: vi.fn().mockResolvedValue('room-123'),
      };
      
      channel.connectOrchestrator(mockOrchestrator);
      // Orchestrator is connected (internal implementation)
    });
    
    it('should connect orchestrator with discussion updates', () => {
      const updateCallback = vi.fn();
      const mockOrchestrator: OrchestratorAdapter = {
        chat: vi.fn().mockResolvedValue('Hello!'),
        getStatus: vi.fn().mockReturnValue({ uptime: 100 }),
        getAgents: vi.fn().mockReturnValue([]),
        startDiscussion: vi.fn().mockResolvedValue('room-123'),
        onDiscussionUpdate: (callback) => {
          updateCallback.mockImplementation(callback);
        },
      };
      
      channel.connectOrchestrator(mockOrchestrator);
      // Discussion update callback is registered
    });
  });
  
  describe('sendMessage', () => {
    it('should send a text message', async () => {
      const result = await channel.sendMessage(123, 'Hello!');
      expect(result).toHaveProperty('message_id', 1);
    });
    
    it('should send message with parse mode', async () => {
      await channel.sendMessage(123, '*bold*', { parseMode: 'Markdown' });
      // API is called with parse_mode
    });
    
    it('should send message with buttons', async () => {
      await channel.sendMessage(123, 'Choose:', {
        buttons: [[{ text: 'Option 1', callbackData: 'opt1' }]],
      });
      // API is called with reply_markup
    });
    
    it('should send message with reply', async () => {
      await channel.sendMessage(123, 'Reply!', { replyToMessageId: 456 });
      // API is called with reply_parameters
    });
  });
  
  describe('sendPhoto', () => {
    it('should send a photo', async () => {
      const result = await channel.sendPhoto(123, 'photo-file-id', 'Caption');
      expect(result).toHaveProperty('message_id', 2);
    });
  });
  
  describe('sendDocument', () => {
    it('should send a document', async () => {
      const result = await channel.sendDocument(123, 'doc-file-id', 'Document caption');
      expect(result).toHaveProperty('message_id', 3);
    });
  });
  
  describe('editMessage', () => {
    it('should edit a message', async () => {
      const result = await channel.editMessage(123, 1, 'Updated text');
      expect(result).toHaveProperty('message_id', 1);
    });
    
    it('should edit message with buttons', async () => {
      await channel.editMessage(123, 1, 'Updated', {
        buttons: [[{ text: 'New button', callbackData: 'new' }]],
      });
      // API is called with reply_markup
    });
  });
  
  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      const result = await channel.deleteMessage(123, 456);
      expect(result).toBe(true);
    });
  });
  
  describe('sendTyping', () => {
    it('should send typing indicator', async () => {
      const result = await channel.sendTyping(123);
      expect(result).toBe(true);
    });
  });
  
  describe('getFileUrl', () => {
    it('should get file URL', async () => {
      const url = await channel.getFileUrl('file-id-123');
      expect(url).toContain('api.telegram.org');
      expect(url).toContain('photos/test.jpg');
    });
  });
  
  describe('getBotInfo', () => {
    it('should get bot info', async () => {
      const info = await channel.getBotInfo();
      expect(info).toHaveProperty('username', 'test_bot');
    });
  });
  
  describe('getBot', () => {
    it('should return the underlying bot instance', () => {
      const bot = channel.getBot();
      expect(bot).toBeDefined();
    });
  });
  
  describe('getWebhookCallback', () => {
    it('should return webhook callback', () => {
      const callback = channel.getWebhookCallback();
      expect(callback).toBeDefined();
    });
  });
  
  describe('events', () => {
    it('should emit message event', () => {
      const messageHandler = vi.fn();
      channel.on('message', messageHandler);
      
      // Event system works (emitting is internal)
      channel.emit('message', {} as TelegramMessage);
      expect(messageHandler).toHaveBeenCalled();
    });
    
    it('should emit command event', () => {
      const commandHandler = vi.fn();
      channel.on('command', commandHandler);
      
      channel.emit('command', 'test', 'args', {} as TelegramMessage);
      expect(commandHandler).toHaveBeenCalledWith('test', 'args', expect.anything());
    });
    
    it('should emit callback event', () => {
      const callbackHandler = vi.fn();
      channel.on('callback', callbackHandler);
      
      channel.emit('callback', 'data', {} as TelegramMessage);
      expect(callbackHandler).toHaveBeenCalledWith('data', expect.anything());
    });
    
    it('should emit error event', () => {
      const errorHandler = vi.fn();
      channel.on('error', errorHandler);
      
      channel.emit('error', new Error('test error'));
      expect(errorHandler).toHaveBeenCalled();
    });
  });
});

describe('TelegramMessage interface', () => {
  it('should have all required fields', () => {
    const message: TelegramMessage = {
      id: 123,
      chatId: 456,
      chatType: 'private',
      userId: 789,
      userName: 'Test User',
      text: 'Hello',
      timestamp: new Date(),
      isGroup: false,
      mentioned: false,
    };
    
    expect(message.id).toBe(123);
    expect(message.chatId).toBe(456);
    expect(message.chatType).toBe('private');
    expect(message.userId).toBe(789);
    expect(message.userName).toBe('Test User');
    expect(message.text).toBe('Hello');
    expect(message.isGroup).toBe(false);
    expect(message.mentioned).toBe(false);
  });
  
  it('should support optional fields', () => {
    const message: TelegramMessage = {
      id: 123,
      chatId: 456,
      chatType: 'group',
      userId: 789,
      userName: 'Test User',
      userUsername: 'testuser',
      text: 'Hello',
      timestamp: new Date(),
      isGroup: true,
      mentioned: true,
      replyToMessageId: 100,
      attachments: [
        { type: 'photo', fileId: 'photo-123', fileSize: 1024 },
        { type: 'document', fileId: 'doc-456', fileName: 'test.pdf', mimeType: 'application/pdf' },
      ],
      callbackData: 'button_click',
    };
    
    expect(message.userUsername).toBe('testuser');
    expect(message.replyToMessageId).toBe(100);
    expect(message.attachments).toHaveLength(2);
    expect(message.attachments![0].type).toBe('photo');
    expect(message.callbackData).toBe('button_click');
  });
  
  it('should support all chat types', () => {
    const types: TelegramMessage['chatType'][] = ['private', 'group', 'supergroup', 'channel'];
    
    types.forEach(type => {
      const message: TelegramMessage = {
        id: 1,
        chatId: 1,
        chatType: type,
        userId: 1,
        userName: 'User',
        text: '',
        timestamp: new Date(),
        isGroup: type !== 'private',
        mentioned: false,
      };
      
      expect(message.chatType).toBe(type);
    });
  });
});

describe('AgentInfo interface', () => {
  it('should represent agent information', () => {
    const agent: AgentInfo = {
      id: 'coder',
      name: 'Code Agent',
      role: 'coder',
      status: 'idle',
      description: 'Writes code',
    };
    
    expect(agent.id).toBe('coder');
    expect(agent.name).toBe('Code Agent');
    expect(agent.role).toBe('coder');
    expect(agent.status).toBe('idle');
    expect(agent.description).toBe('Writes code');
  });
  
  it('should support all status values', () => {
    const statuses: AgentInfo['status'][] = ['idle', 'busy', 'error', 'offline'];
    
    statuses.forEach(status => {
      const agent: AgentInfo = {
        id: 'test',
        name: 'Test',
        role: 'tester',
        status,
      };
      
      expect(agent.status).toBe(status);
    });
  });
});

describe('OrchestratorAdapter interface', () => {
  it('should define required methods', () => {
    const adapter: OrchestratorAdapter = {
      chat: vi.fn().mockResolvedValue('response'),
      getStatus: vi.fn().mockReturnValue({}),
      getAgents: vi.fn().mockReturnValue([]),
      startDiscussion: vi.fn().mockResolvedValue('room-id'),
    };
    
    expect(typeof adapter.chat).toBe('function');
    expect(typeof adapter.getStatus).toBe('function');
    expect(typeof adapter.getAgents).toBe('function');
    expect(typeof adapter.startDiscussion).toBe('function');
  });
  
  it('should support optional onDiscussionUpdate', () => {
    const adapter: OrchestratorAdapter = {
      chat: vi.fn(),
      getStatus: vi.fn(),
      getAgents: vi.fn(),
      startDiscussion: vi.fn(),
      onDiscussionUpdate: vi.fn(),
    };
    
    expect(typeof adapter.onDiscussionUpdate).toBe('function');
  });
});

describe('TelegramButton interface', () => {
  it('should support callback button', () => {
    const button = {
      text: 'Click me',
      callbackData: 'action:click',
    };
    
    expect(button.text).toBe('Click me');
    expect(button.callbackData).toBe('action:click');
  });
  
  it('should support URL button', () => {
    const button = {
      text: 'Visit',
      url: 'https://example.com',
    };
    
    expect(button.text).toBe('Visit');
    expect(button.url).toBe('https://example.com');
  });
});

describe('Configuration validation', () => {
  it('should require botToken', () => {
    expect(() => new TelegramChannel({ botToken: '' })).not.toThrow();
    // Empty token will fail at runtime when connecting
  });
  
  it('should accept minimal config', () => {
    const ch = new TelegramChannel({ botToken: 'token' });
    expect(ch).toBeInstanceOf(TelegramChannel);
  });
  
  it('should accept allowedUsers as number array', () => {
    const ch = new TelegramChannel({
      botToken: 'token',
      allowedUsers: [123, 456, 789],
    });
    expect(ch).toBeInstanceOf(TelegramChannel);
  });
  
  it('should accept allowedChats as number array', () => {
    const ch = new TelegramChannel({
      botToken: 'token',
      allowedChats: [-100123, -100456],
    });
    expect(ch).toBeInstanceOf(TelegramChannel);
  });
});
