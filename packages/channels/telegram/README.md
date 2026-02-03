# @openbotman/channel-telegram

Telegram channel integration for OpenBotMan. Enables communication with your AI agents through Telegram bots.

## Features

- 🤖 Full Telegram Bot API support via [grammY](https://grammy.dev/)
- 📱 Works in private chats and groups
- 🔘 Inline keyboards for interactive buttons
- 📎 Attachment support (photos, documents, voice messages)
- 🔐 User/chat allowlists for security
- 🔄 Webhook and polling modes
- 🗣️ Agent discussions with live updates
- 🎯 Command handlers (/start, /help, /status, etc.)

## Installation

```bash
pnpm add @openbotman/channel-telegram
```

## Quick Start

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Basic Usage

```typescript
import { TelegramChannel } from '@openbotman/channel-telegram';

const channel = new TelegramChannel({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  botUsername: 'your_bot_username', // optional, auto-fetched
});

// Handle all messages
channel.onMessage(async (message, ctx) => {
  return `You said: ${message.text}`;
});

// Start the bot
await channel.start();
```

### 3. With Orchestrator

```typescript
import { TelegramChannel, OrchestratorAdapter } from '@openbotman/channel-telegram';
import { Orchestrator } from '@openbotman/orchestrator';

const channel = new TelegramChannel({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});

// Create orchestrator adapter
const orchestratorAdapter: OrchestratorAdapter = {
  chat: (message) => orchestrator.chat(message),
  getStatus: () => orchestrator.getStatus(),
  getAgents: () => orchestrator.getAgents().map(a => ({
    id: a.id,
    name: a.name,
    role: a.role,
    status: a.status,
  })),
  startDiscussion: (topic) => orchestrator.startDiscussion({ topic, participants: [] }),
};

channel.connectOrchestrator(orchestratorAdapter);
await channel.start();
```

## Configuration

```typescript
interface TelegramChannelConfig {
  // Required
  botToken: string;              // Token from @BotFather
  
  // Optional
  botUsername?: string;          // Bot username (auto-fetched if not set)
  webhookUrl?: string;           // Use webhook instead of polling
  webhookSecret?: string;        // Secret for webhook validation
  allowedUsers?: number[];       // Only allow these user IDs
  allowedChats?: number[];       // Only allow these chat IDs
  debug?: boolean;               // Enable verbose logging
}
```

## Commands

Built-in commands (can be overridden):

| Command | Description |
|---------|-------------|
| `/start` | Welcome message with buttons |
| `/help` | List available commands |
| `/status` | System status and agent info |
| `/agents` | List available AI agents |
| `/chat <message>` | Chat with the AI |
| `/discuss <topic>` | Start multi-agent discussion |

### Custom Commands

```typescript
channel.onCommand('mycommand', async (args, message, ctx) => {
  return `You ran /mycommand with: ${args}`;
});
```

## Messages

### Handling Messages

```typescript
channel.onMessage(async (message, ctx) => {
  // Access message data
  console.log(`From: ${message.userName} (${message.userId})`);
  console.log(`Chat: ${message.chatId} (${message.chatType})`);
  console.log(`Text: ${message.text}`);
  
  // Check attachments
  if (message.attachments) {
    for (const att of message.attachments) {
      console.log(`Attachment: ${att.type} - ${att.fileId}`);
    }
  }
  
  // Return a simple response
  return 'Got it!';
  
  // Or return a rich response
  return {
    text: 'Choose an option:',
    buttons: [
      [{ text: 'Option A', callbackData: 'opt_a' }],
      [{ text: 'Option B', callbackData: 'opt_b' }],
    ],
  };
});
```

### Sending Messages

```typescript
// Simple text
await channel.sendMessage(chatId, 'Hello!');

// With markdown
await channel.sendMessage(chatId, '*Bold* and _italic_', {
  parseMode: 'Markdown',
});

// With buttons
await channel.sendMessage(chatId, 'Click a button:', {
  buttons: [
    [
      { text: '✅ Yes', callbackData: 'yes' },
      { text: '❌ No', callbackData: 'no' },
    ],
    [
      { text: '🔗 Website', url: 'https://example.com' },
    ],
  ],
});

// Reply to a message
await channel.sendMessage(chatId, 'Replying!', {
  replyToMessageId: originalMessageId,
});
```

### Photos & Documents

```typescript
// Send photo (file ID, URL, or path)
await channel.sendPhoto(chatId, 'AgACAgIAAxk...', 'Nice photo!');

// Send document
await channel.sendDocument(chatId, 'BQACAgIAAxk...', 'Here is the file');

// Get file URL for downloading
const url = await channel.getFileUrl(message.attachments[0].fileId);
```

### Edit & Delete

```typescript
// Edit message text
await channel.editMessage(chatId, messageId, 'Updated text');

// Edit with new buttons
await channel.editMessage(chatId, messageId, 'Choose again:', {
  buttons: [[{ text: 'New option', callbackData: 'new' }]],
});

// Delete message
await channel.deleteMessage(chatId, messageId);
```

## Inline Buttons (Callbacks)

```typescript
channel.onCallback(async (data, message, ctx) => {
  if (data === 'yes') {
    return 'You clicked Yes!';
  } else if (data === 'no') {
    return 'You clicked No!';
  }
});
```

## Events

```typescript
channel.on('message', (message) => {
  console.log('New message:', message.text);
});

channel.on('command', (cmd, args, message) => {
  console.log(`Command: /${cmd} ${args}`);
});

channel.on('callback', (data, message) => {
  console.log('Button clicked:', data);
});

channel.on('error', (error) => {
  console.error('Error:', error);
});

channel.on('started', () => {
  console.log('Bot started!');
});

channel.on('stopped', () => {
  console.log('Bot stopped!');
});
```

## Webhook Mode

For production, use webhooks instead of polling:

```typescript
import express from 'express';

const app = express();
const channel = new TelegramChannel({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  webhookUrl: 'https://yourdomain.com/telegram/webhook',
  webhookSecret: process.env.WEBHOOK_SECRET,
});

// Mount webhook handler
app.use('/telegram/webhook', channel.getWebhookCallback());

// Start server (not the bot itself for webhooks)
app.listen(3000);
await channel.start(); // This sets up the webhook
```

## Security

### Restrict to Specific Users

```typescript
const channel = new TelegramChannel({
  botToken: '...',
  allowedUsers: [123456789, 987654321], // Telegram user IDs
});
```

### Restrict to Specific Chats

```typescript
const channel = new TelegramChannel({
  botToken: '...',
  allowedChats: [-100123456789], // Group/channel IDs
});
```

Get your user ID by sending a message to [@userinfobot](https://t.me/userinfobot).

## Group Chat Behavior

In groups, the bot only responds when:
- Directly mentioned (`@your_bot_username message`)
- Replied to (reply to a bot message)

This prevents spam in busy groups.

## TelegramMessage Type

```typescript
interface TelegramMessage {
  id: number;                    // Message ID
  chatId: number;                // Chat ID
  chatType: 'private' | 'group' | 'supergroup' | 'channel';
  userId: number;                // Sender's user ID
  userName: string;              // Sender's display name
  userUsername?: string;         // Sender's @username
  text: string;                  // Message text
  timestamp: Date;               // When sent
  isGroup: boolean;              // Is group/supergroup
  mentioned: boolean;            // Bot was @mentioned
  replyToMessageId?: number;     // If replying to a message
  attachments?: TelegramAttachment[];
  callbackData?: string;         // If from button click
}
```

## Access Raw grammY Bot

```typescript
const bot = channel.getBot();

// Use any grammY feature
bot.on('inline_query', async (ctx) => {
  // Handle inline queries
});
```

## License

MIT
