# 🤖 OpenBotMan

**Multi-Agent Orchestrator for coordinating LLM CLIs**

OpenBotMan is a lightweight orchestrator that coordinates multiple LLM command-line interfaces (Claude Code, Gemini, GPT-4, etc.) to accomplish complex tasks through collaborative workflows.

## 🎯 Features

- **Multi-Agent Coordination**: Orchestrate Claude Code CLI, Gemini CLI, GPT-4 CLI, and more
- **Role-Based Delegation**: Assign specialized roles (planner, coder, reviewer, tester)
- **Consensus Building**: Get agreement from multiple agents on decisions
- **Workflow Engine**: Define and execute multi-step agent workflows
- **Tool-Based Architecture**: Uses Anthropic's tool use pattern for orchestration
- **Session Management**: Persistent conversations with each agent
- **Integration Ready**: MCP Server, REST API, or direct Python integration

## 🚀 Quick Start

### Installation

```bash
# Clone or navigate to project
cd C:\Sources\OpenBotMan

# Install dependencies
pip install -r requirements.txt

# Configure agents
cp config.example.yaml config.yaml
# Edit config.yaml with your settings
```

### Prerequisites

You need the following CLIs installed:
- **Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`
- **Gemini CLI** (optional): Install from Google
- **GPT-4 CLI** (optional): `pip install openai-cli`

### Basic Usage

```bash
# Interactive mode
python orchestrator.py

# API server mode
python api_server.py

# MCP server mode
python mcp_server.py
```

### Example Session

```
You: Implement a binary search function with comprehensive tests

Orchestrator: I'll coordinate this with multiple agents...
[Orchestrator] Calling claude_code (coder role)...
[Orchestrator] Calling gemini (reviewer role)...
[Orchestrator] Calling gpt4 (tester role)...

Orchestrator: Complete! Here's the implementation with review and tests.
[Shows code, review feedback, and test suite]
```

## 📦 Architecture

```
User/Antigravity
      ↓
Orchestrator Agent (Claude Opus)
      ↓
   Tools:
   • call_agent
   • create_consensus
   • run_workflow
      ↓
   ┌──────┬──────┬──────┐
   │Claude│Gemini│ GPT4 │
   │ CLI  │ CLI  │ CLI  │
   └──────┴──────┴──────┘
```

## 🔧 Configuration

Edit `config.yaml`:

```yaml
orchestrator:
  model: claude-opus-4
  max_iterations: 10

agents:
  claude_code:
    cli: "claude"
    default_model: "opus"
    roles: [planner, coder, architect]

  gemini:
    cli: "gemini"
    default_model: "gemini-2.0-flash-thinking-exp"
    roles: [reviewer, critic, optimizer]
```

## 📖 Documentation

- [Usage Guide](docs/usage.md)
- [Workflow System](docs/workflows.md)
- [API Reference](docs/api.md)
- [Integration Guide](docs/integration.md)

## 🛠️ Development

```bash
# Run tests
pytest tests/

# Format code
black .

# Type check
mypy .
```

## 🔗 Integration

### With Antigravity (MCP)

```python
from mcp import Server
from orchestrator import MultiAgentOrchestrator

server = Server("openbotman")
orchestrator = MultiAgentOrchestrator()

@server.tool()
async def coordinate(task: str) -> str:
    return orchestrator.chat(task)
```

### REST API

```bash
# Start API server
python api_server.py

# Use from any client
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test", "message": "Implement feature X"}'
```

## 📝 License

MIT License - see [LICENSE](LICENSE)

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

## 💡 Examples

See [examples/](examples/) for:
- Code review workflows
- Consensus-based decisions
- Multi-agent debates
- Custom tool definitions
