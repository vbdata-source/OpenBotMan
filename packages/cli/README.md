# @openbotman/cli

Command-line interface for OpenBotMan - Multi-Agent Orchestration Platform.

## Installation

```bash
# From the monorepo root
pnpm install

# Build all packages
pnpm build

# Or install globally (after publishing)
npm install -g @openbotman/cli
```

## Usage

### Interactive Chat

Start an interactive chat session with the orchestrator:

```bash
# Using the CLI directly
openbotman chat

# Or with a custom config file
openbotman chat --config /path/to/config.yaml

# Alias
obm chat
```

During the chat session, you can use these commands:
- `exit` / `quit` - Exit the chat
- `status` - Show orchestrator status (agents, tasks, tokens)
- `reset` - Reset conversation history
- `agents` - List available agents
- `help` - Show available commands
- `clear` - Clear the screen

### Run a Single Task

Execute a single task without entering interactive mode:

```bash
openbotman run "Create a React component for a user profile"

# With a specific agent
openbotman run "Review this code" --agent reviewer

# Run a workflow
openbotman run "Feature request" --workflow feature_development
```

### List Agents

Show all configured agents:

```bash
openbotman agents
```

### List Workflows

Show all configured workflows:

```bash
openbotman workflows
```

### Initialize Configuration

Create a new configuration file:

```bash
openbotman init
```

This creates a `config.yaml` file from the example template.

### Start API Server

Start the REST API server (coming soon):

```bash
openbotman serve --port 8080
```

## Configuration

The CLI reads configuration from `config.yaml` by default. You can specify a different path with `--config`.

### Minimal Configuration

```yaml
orchestrator:
  model: claude-sonnet-4-20250514
  maxIterations: 10

knowledgeBase:
  enabled: true
  storagePath: ./data/knowledge
  autoLearn: true

agents:
  - id: claude_code
    name: Claude Code
    role: coder
    provider: anthropic
    model: claude-sonnet-4-20250514
    enabled: true
    systemPrompt: |
      You are an expert software developer.
      Write clean, well-documented code.
    capabilities:
      code: true
      review: true
      filesystem: true
      shell: true
      discussion: true
      decisions: true

workflows: []
qualityGates: []
```

### Environment Variables

Set your API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

For other providers:
```bash
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=...
```

## Example Session

```
$ openbotman chat

╔═══════════════════════════════════════════════════════════╗
║  OPEN BOTMAN                                              ║
║  Multi-Agent Orchestration Platform                       ║
║  v2.0.0-alpha.1                                           ║
╚═══════════════════════════════════════════════════════════╝

✓ Orchestrator ready!
Type "help" for commands, "exit" to quit

You: Create a simple hello world function in Python

⠋ Thinking...

OpenBotMan:
Here's a simple hello world function:

```python
def hello_world():
    """Print a greeting to the console."""
    print("Hello, World!")

if __name__ == "__main__":
    hello_world()
```

You: status

📊 Orchestrator Status
────────────────────────────────────────
Uptime: 0h 0m 42s
Tokens used: 156
Tasks: 1 total | 0 active | 0 pending
Active discussions: 0

Agents:
  ● claude_code (coder) - 1 tasks
────────────────────────────────────────

You: exit

👋 Goodbye!
```

## Architecture

The CLI connects to the orchestrator which manages multiple AI agents:

```
┌─────────────────────────────────────────────────────────┐
│  CLI (openbotman chat)                                  │
├─────────────────────────────────────────────────────────┤
│  Orchestrator                                           │
│  ├── Agent Runner (manages agent instances)             │
│  ├── Discussion Engine (multi-agent consensus)          │
│  └── Knowledge Base (shared memory)                     │
├─────────────────────────────────────────────────────────┤
│  Agents                                                 │
│  ├── Claude Code (coder)                                │
│  ├── Gemini (reviewer)                                  │
│  ├── GPT-4 (tester)                                     │
│  └── Ollama (local)                                     │
└─────────────────────────────────────────────────────────┘
```

## Development

### Building

```bash
cd packages/cli
pnpm build
```

### Testing

```bash
pnpm test
```

### Running in Development

```bash
pnpm dev  # Watch mode
node dist/cli.js chat
```

## API

The CLI exports utilities that can be used programmatically:

```typescript
import { loadConfig, createDefaultConfig } from '@openbotman/cli';

// Load a config file
const config = loadConfig('./config.yaml');

// Create a default config
const defaultConfig = createDefaultConfig();
```

## License

MIT
