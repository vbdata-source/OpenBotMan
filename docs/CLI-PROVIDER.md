# Claude Code CLI Provider

OpenBotMan supports using the Claude Code CLI as a backend provider instead of direct Anthropic API calls. This allows users with Claude Pro/Max subscriptions to use OpenBotMan without needing separate API keys.

## Overview

The Claude CLI Provider spawns the `claude` CLI as a subprocess and communicates via JSON streams. This approach:

- **Works with Claude Pro subscriptions** - No API key required
- **Uses the same authentication** as Claude Code CLI
- **Supports streaming** - Real-time text output
- **Session management** - Continue conversations

## Prerequisites

1. **Install Claude Code CLI**:
   ```bash
   # macOS/Linux
   curl -fsSL https://claude.ai/install.sh | bash
   
   # Windows (PowerShell)
   irm https://claude.ai/install.ps1 | iex
   
   # Homebrew (macOS/Linux)
   brew install --cask claude-code
   ```

2. **Authenticate with Claude Code**:
   ```bash
   claude
   # Follow the login prompts
   ```

## Configuration

### config.yaml

```yaml
orchestrator:
  # Use Claude CLI instead of direct API
  provider: claude-cli
  
  # Model to use
  model: claude-sonnet-4-20250514
  
  # CLI-specific settings
  cli:
    command: claude     # Path to CLI (default: 'claude')
    args: []            # Additional CLI arguments
    maxTurns: 10        # Max agentic turns
    tools: []           # Tools to enable (empty = all)
```

### Provider Options

| Option | Default | Description |
|--------|---------|-------------|
| `provider` | `anthropic` | Set to `claude-cli` to use CLI |
| `cli.command` | `claude` | Path to the claude CLI |
| `cli.args` | `[]` | Additional CLI arguments |
| `cli.maxTurns` | `10` | Maximum turns for agentic loop |
| `cli.tools` | `[]` | Tools to enable (empty = all) |

## Checking Availability

Use the CLI to check if Claude Code is available:

```bash
openbotman auth status
```

Output:
```
🔐 Authentication Status

Claude Code CLI:
  ✓ Available (1.2.3)

API Authentication:
  ✓ Authenticated
    Method: Setup Token (Pro)
    Profile: default
    Token: sk-ant-oa...xyz

Recommended Provider:
  → claude-cli (uses Claude Pro subscription)
    Set in config.yaml: provider: claude-cli
```

## Programmatic Usage

### Basic Usage

```typescript
import { ClaudeCliProvider } from '@openbotman/orchestrator';

// Check if CLI is available
const available = await ClaudeCliProvider.isAvailable();
console.log(`Claude CLI available: ${available}`);

// Get version
const version = await ClaudeCliProvider.getVersion();
console.log(`Version: ${version}`);

// Create provider
const provider = new ClaudeCliProvider({
  model: 'claude-sonnet-4-20250514',
  maxTurns: 5,
});

// Send a message
const response = await provider.send('What is 2+2?');
console.log(response.text);          // "4"
console.log(response.sessionId);     // "abc-123-..."
console.log(response.costUsd);       // 0.001
```

### Streaming

```typescript
const response = await provider.sendStream('Explain quantum computing', (text) => {
  process.stdout.write(text);
});
```

### Session Continuation

```typescript
// First message
const response1 = await provider.send('My name is Alice');

// Continue conversation
const response2 = await provider.continue('What is my name?');
console.log(response2.text); // "Your name is Alice"
```

### Events

```typescript
const provider = new ClaudeCliProvider();

provider.on('start', () => console.log('Started'));
provider.on('text', (text) => console.log('Text:', text));
provider.on('tool', (name, input) => console.log('Tool:', name, input));
provider.on('message', (msg) => console.log('Message:', msg));
provider.on('end', (response) => console.log('Done:', response));
provider.on('error', (error) => console.error('Error:', error));

await provider.send('List files in current directory');
```

### Abort

```typescript
const provider = new ClaudeCliProvider();

// Start long-running request
const promise = provider.send('Complex task...');

// Abort after 5 seconds
setTimeout(() => provider.abort(), 5000);
```

## Claude CLI Output Format

The provider parses NDJSON (newline-delimited JSON) from the CLI:

```json
{"type":"system","session_id":"abc123"}
{"type":"assistant","message":{"content":[{"type":"text","text":"Hello!"}]}}
{"type":"result","result":{"text":"Hello!","session_id":"abc123","cost_usd":0.001}}
```

### Message Types

| Type | Description |
|------|-------------|
| `system` | System messages with session info |
| `assistant` | Claude's responses with content blocks |
| `result` | Final result with cost and session ID |

## Comparison: CLI vs API

| Feature | CLI Provider | API Provider |
|---------|--------------|--------------|
| Auth | Claude Pro subscription | API key |
| Billing | Included in subscription | Per-token usage |
| Tools | CLI-managed | Custom tools |
| Streaming | Yes | Yes |
| Sessions | Via session ID | Manual |
| Setup | Install CLI + login | Set API key |

## Troubleshooting

### CLI Not Found

```
Claude Code CLI:
  ✗ Not found in PATH
```

**Solution**: Install Claude Code CLI or add it to your PATH.

### Authentication Failed

```
Error: Authentication failed
```

**Solution**: Run `claude` and follow the login prompts.

### Session Expired

```
Error: No session to continue
```

**Solution**: Start a new conversation with `send()` before using `continue()`.

## See Also

- [Authentication Guide](./AUTHENTICATION.md) - Setup tokens and profiles
- [Claude Code Documentation](https://code.claude.com/docs) - Official CLI docs
- [Configuration Reference](../config.example.yaml) - Full config options
