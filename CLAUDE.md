# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OpenBotMan** is a lightweight Multi-Agent Orchestrator that coordinates multiple LLM command-line interfaces (Claude Code CLI, Gemini CLI, GPT-4 CLI) to accomplish complex tasks through collaborative workflows.

**Core Concept:**
- **One orchestrator agent** (Claude Opus) coordinates **multiple sub-agents** (different LLM CLIs)
- Sub-agents have **specialized roles** (planner, coder, reviewer, tester)
- Uses **Anthropic's Tool Use pattern** for delegation
- Designed to be **simple, standalone, and easily integrable** with other systems (especially Antigravity)

**Key Difference from OpenClaw:**
- OpenClaw = Full messaging platform (WhatsApp/Telegram/etc.) with complex Gateway architecture
- OpenBotMan = Focused CLI orchestrator, minimal dependencies, easy integration
- OpenBotMan has ~20 files vs OpenClaw's 100+ files

---

## Architecture

```
User Input
    ↓
Orchestrator Agent (Claude Opus via Anthropic API)
    ↓
  Tools (Anthropic Tool Use):
  • call_agent(agent_id, role, task)
  • create_consensus(agents, topic)
  • run_workflow(workflow_name, data)
    ↓
CLI Runners (Subprocess execution)
  ↓
┌──────────┬──────────┬──────────┐
│ Claude   │  Gemini  │  GPT-4   │
│ Code CLI │   CLI    │   CLI    │
└──────────┴──────────┴──────────┘
```

### Core Components

1. **Orchestrator (`src/orchestrator.py`)**
   - Main agent that receives user requests
   - Uses Anthropic API with tool use
   - Coordinates sub-agents via tools
   - Maintains conversation state

2. **CLI Runners (`src/cli_runners.py`)**
   - Executes LLM CLIs as subprocesses
   - Parses JSON output from CLIs
   - Manages session IDs per agent
   - Handles timeouts and errors

3. **Tools (`src/tools.py`)**
   - Tool definitions for Anthropic API
   - Tool execution logic
   - Role-based system prompt building
   - Conversation history tracking

4. **Entry Points**
   - `orchestrator.py` - Interactive CLI mode
   - `api_server.py` - REST API server (FastAPI)

---

## File Structure

```
OpenBotMan/
├── src/
│   ├── __init__.py           # Package exports
│   ├── orchestrator.py       # Main orchestrator agent
│   ├── cli_runners.py        # CLI subprocess handlers
│   └── tools.py              # Tool definitions & execution
│
├── Entry Points:
│   ├── orchestrator.py       # Interactive CLI
│   └── api_server.py         # REST API
│
├── Config & Setup:
│   ├── config.example.yaml   # Example configuration
│   ├── .env.example          # Example environment vars
│   ├── requirements.txt      # Python dependencies
│   └── setup.bat             # Windows setup script
│
├── Examples:
│   ├── examples/simple_task.py
│   ├── examples/workflow_example.py
│   └── examples/consensus_example.py
│
├── Tests:
│   ├── tests/test_cli_runners.py
│   └── tests/test_tools.py
│
└── Docs:
    ├── README.md             # Main documentation
    ├── QUICKSTART.md         # 5-minute setup guide
    ├── CLAUDE.md             # This file
    └── DEVELOPMENT.md        # Development guidelines
```

---

## Key Concepts

### 1. The Orchestrator Pattern

The orchestrator is itself an LLM agent (Claude Opus) that has **tools** to call other agents:

```python
# User asks: "Implement feature X with review"

# Orchestrator thinks:
# "I'll use claude_code to plan, gemini to review, claude_code to code"

# Orchestrator calls tools:
call_agent(agent_id="claude_code", role="planner", task="Create plan for X")
call_agent(agent_id="gemini", role="reviewer", task="Review this plan: ...")
call_agent(agent_id="claude_code", role="coder", task="Implement: ...")
```

### 2. CLI as Subprocess Pattern

We don't use SDKs directly. Instead, we call CLIs as subprocesses:

```python
# Instead of:
from anthropic import Anthropic
client.messages.create(...)

# We do:
subprocess.run(["claude", "-p", "--output-format", "json", "prompt"])
```

**Why?**
- **Isolation**: CLI crashes don't crash orchestrator
- **Official support**: Vendors maintain their CLIs
- **Flexibility**: Easy to swap/add CLIs
- **Session management**: CLIs handle their own sessions

### 3. Role-Based System Prompts

Each agent can take different **roles** with specialized prompts:

```python
roles = {
    "planner": "You are a strategic planner...",
    "coder": "You are an expert coder...",
    "reviewer": "You are a critical reviewer...",
    "tester": "You are a QA engineer..."
}

# Same CLI, different behavior based on role
call_agent("claude_code", role="planner", ...)  # Strategic thinking
call_agent("claude_code", role="coder", ...)    # Code implementation
```

### 4. Workflows = Predefined Agent Sequences

Workflows define multi-step agent collaborations:

```yaml
workflows:
  code_review:
    steps:
      - agent: claude_code
        role: planner
        task: "Create implementation plan"

      - agent: gemini
        role: reviewer
        task: "Review plan for issues"
        max_iterations: 3  # Can iterate!

      - agent: claude_code
        role: coder
        task: "Implement approved plan"
```

### 5. Consensus Building

Get multiple agents to agree on decisions:

```python
create_consensus(
    agents=["claude_code", "gemini", "gpt4"],
    topic="Should we use PostgreSQL or MongoDB?",
    min_agreement=0.7  # 70% must agree
)

# Returns: {consensus: true/false, votes: {...}, responses: [...]}
```

---

## Configuration (`config.yaml`)

### Agent Configuration

```yaml
agents:
  claude_code:
    cli: "claude"                          # CLI binary name
    args: ["-p", "--output-format", "json"] # Default args
    model_arg: "--model"                   # Flag for model selection
    default_model: "opus"                  # Default model
    session_arg: "--session-id"            # Flag for session ID
    system_prompt_arg: "--append-system-prompt"
    roles: [planner, coder, architect]     # Available roles
```

**Important fields:**
- `cli`: The command to execute (must be in PATH)
- `args`: Base arguments always passed
- `model_arg`: How to specify model (e.g., `--model`)
- `session_arg`: How to specify session ID for continuity
- `roles`: Which roles this agent can take

### Workflow Configuration

```yaml
workflows:
  workflow_name:
    description: "What this workflow does"
    steps:
      - agent: agent_id
        role: role_name
        task: "Task description"
        max_iterations: 3  # Optional: allow refinement
```

**Workflow execution:**
- Steps run sequentially
- Output of step N becomes context for step N+1
- `max_iterations` allows agent to refine based on feedback

---

## Common Development Tasks

### Adding a New CLI Agent

1. **Ensure CLI is installed and in PATH**
   ```bash
   # Example: Gemini CLI
   which gemini  # or: where gemini (Windows)
   ```

2. **Add to `config.yaml`**
   ```yaml
   agents:
     gemini:
       cli: "gemini"
       args: ["chat", "--json"]
       model_arg: "--model"
       default_model: "gemini-2.0-flash-thinking-exp"
       session_arg: "--session"
       system_prompt_arg: "--system"
       roles: [reviewer, critic, optimizer]
   ```

3. **Test manually first**
   ```bash
   gemini chat --json --model gemini-2.0-flash "Hello"
   # Verify it returns JSON
   ```

4. **Update tool definitions in `src/tools.py`**
   - Add agent to `enum` in `call_agent` tool
   - Add agent-specific traits in `_build_role_prompt()` if needed

### Creating a New Workflow

1. **Define in `config.yaml`**
   ```yaml
   workflows:
     my_workflow:
       description: "My custom workflow"
       steps:
         - agent: claude_code
           role: planner
           task: "Create plan"

         - agent: gemini
           role: reviewer
           task: "Review plan"
   ```

2. **Use it**
   ```python
   orchestrator.chat("Run my_workflow for implementing feature X")
   # Orchestrator will use run_workflow tool
   ```

### Testing Changes

```bash
# Unit tests
pytest tests/

# Integration test (requires real CLIs)
python examples/simple_task.py

# Interactive test
python orchestrator.py
```

### Debugging

**Enable verbose logging:**
```yaml
# config.yaml
behavior:
  verbose: true
```

**Check CLI execution:**
```python
# In src/cli_runners.py, line ~88
print(f"[CLI] Executing: {' '.join(cmd)}")  # Already there
```

**View conversation history:**
```python
orchestrator = MultiAgentOrchestrator()
orchestrator.chat("Test")
print(orchestrator.get_history())  # Shows all agent calls
```

---

## Integration Patterns

### With Antigravity (Direct Python)

```python
# In Antigravity code
import sys
sys.path.insert(0, "C:/Sources/OpenBotMan/src")

from orchestrator import MultiAgentOrchestrator

class AntigravityAgent:
    def __init__(self):
        self.orchestrator = MultiAgentOrchestrator(
            config_path="C:/Sources/OpenBotMan/config.yaml"
        )

    def handle_complex_task(self, task: str) -> str:
        return self.orchestrator.chat(task)
```

### With Antigravity (REST API)

```python
# Start OpenBotMan API server
# In OpenBotMan: python api_server.py

# In Antigravity
import requests

def call_openbotman(task: str) -> str:
    response = requests.post(
        "http://localhost:8000/chat",
        json={"session_id": "antigravity-1", "message": task}
    )
    return response.json()["response"]
```

### With MCP (Future)

```python
# Coming soon: MCP server integration
# mcp_server.py will provide MCP-compatible interface
```

---

## Important Design Decisions

### Why Subprocess Instead of SDK?

**Decision:** Use CLI as subprocess, not direct SDK integration

**Reasoning:**
1. **Isolation**: CLI crash doesn't crash orchestrator
2. **Official support**: Vendors maintain CLIs
3. **Flexibility**: Easy to add new CLIs without code changes
4. **Session management**: CLIs handle their own session persistence

**Tradeoff:** Slightly slower (subprocess overhead) but more robust

### Why Single Orchestrator Agent?

**Decision:** One "meta-agent" coordinates, instead of peer-to-peer

**Reasoning:**
1. **Clear coordination**: One brain makes decisions
2. **Easier debugging**: Linear flow, not mesh network
3. **Tool use pattern**: Anthropic's recommended pattern
4. **Simpler state management**: One conversation state

**Tradeoff:** Orchestrator is single point of failure (but can retry)

### Why YAML Config Instead of Code?

**Decision:** Configuration in YAML, not Python code

**Reasoning:**
1. **No code changes needed**: Add agents/workflows via config
2. **User-friendly**: Non-programmers can customize
3. **Version control**: Config changes tracked separately
4. **Runtime changes**: Reload config without restart

---

## Code Conventions

### File Organization

- **`src/`**: Core library code (importable)
- **Root level**: Entry points (orchestrator.py, api_server.py)
- **`examples/`**: Usage examples (not tests)
- **`tests/`**: Unit/integration tests

### Naming

- **Files**: `snake_case.py`
- **Classes**: `PascalCase`
- **Functions/methods**: `snake_case()`
- **Constants**: `UPPER_SNAKE_CASE`

### Error Handling

```python
# Always provide context in errors
raise ValueError(
    f"Unknown agent: {agent_id}\n"
    f"Available agents: {list(self.config['agents'].keys())}"
)

# Catch specific exceptions
try:
    result = subprocess.run(...)
except subprocess.TimeoutExpired:
    raise RuntimeError(f"CLI timeout after {timeout}s")
except FileNotFoundError:
    raise RuntimeError(f"CLI not found: {cmd[0]}")
```

### Logging

```python
# Use print() for user-facing messages
print(f"[Orchestrator] Executing tool: {tool_name}")

# Use print() with prefixes for debugging
print(f"[CLI] Executing: {cmd}")
print(f"[Tool] Input: {json.dumps(input, indent=2)}")
```

---

## Testing Strategy

### Unit Tests

```python
# tests/test_*.py
# Test individual components in isolation
# Mock external dependencies (CLIs, API calls)
```

### Integration Tests

```python
# examples/*.py
# Test full workflows with real CLIs
# Requires API keys and installed CLIs
```

### Manual Testing

```python
# Interactive mode
python orchestrator.py

# API mode
python api_server.py
# Then use curl/Postman
```

---

## Common Pitfalls & Solutions

### Pitfall 1: CLI Not Found

**Error:** `FileNotFoundError: CLI not found: claude`

**Solution:**
```bash
# Ensure CLI is in PATH
which claude  # or: where claude (Windows)

# If not found, install it
npm install -g @anthropic-ai/claude-code

# Or specify full path in config.yaml
cli: "/full/path/to/claude"
```

### Pitfall 2: API Key Missing

**Error:** `ANTHROPIC_API_KEY not found in environment`

**Solution:**
```bash
# Create .env file
cp .env.example .env

# Edit .env and add key
ANTHROPIC_API_KEY=your_key_here

# Load .env (done automatically by orchestrator)
```

### Pitfall 3: CLI Output Not JSON

**Error:** `JSONDecodeError: Expecting value`

**Solution:**
```yaml
# Ensure --output-format json in args
agents:
  claude_code:
    args: ["-p", "--output-format", "json"]  # ← Important!
```

### Pitfall 4: Session Not Persisted

**Issue:** Agent forgets previous conversation

**Solution:**
```yaml
# Ensure session_arg is configured
agents:
  claude_code:
    session_arg: "--session-id"  # ← Important!

# CLI Runner manages session IDs automatically
```

---

## Performance & Costs

### Token Usage

- **Orchestrator**: Uses Opus for coordination (expensive but smart)
- **Sub-agents**: Can use cheaper models (Sonnet, Haiku, Gemini Flash)

**Optimization tips:**
1. Use cheaper models for simple tasks
2. Use workflows to batch operations
3. Set reasonable `max_iterations` to avoid loops

### Timeouts

```yaml
# config.yaml
behavior:
  cli_timeout: 120  # Seconds per CLI call
```

**Typical durations:**
- Simple task: 10-30s
- Complex task: 30-120s
- Workflow (4 steps): 2-5 minutes

---

## Future Enhancements

**Planned:**
- [ ] MCP server integration
- [ ] Streaming support for real-time updates
- [ ] State persistence (save/load sessions)
- [ ] Parallel agent execution (where possible)
- [ ] Cost tracking per agent
- [ ] Agent performance metrics

**Consider if needed:**
- Web UI for orchestrator
- Agent marketplace (shareable workflows)
- Multi-orchestrator federation
- Hybrid local/API agents

---

## When to Use OpenBotMan vs OpenClaw

### Use OpenBotMan when:
- ✅ You need multi-agent collaboration for code tasks
- ✅ You want to integrate with Antigravity or custom systems
- ✅ You want minimal dependencies and simple setup
- ✅ You're working with CLI-based LLMs
- ✅ You need flexible agent coordination

### Use OpenClaw when:
- ✅ You need a full messaging platform (WhatsApp/Telegram/etc.)
- ✅ You want built-in channel integrations
- ✅ You need WebSocket gateway for multiple clients
- ✅ You want platform apps (macOS/iOS/Android)
- ✅ You need production-grade messaging infrastructure

### Use both:
- ✅ OpenClaw as messaging platform
- ✅ OpenBotMan as backend orchestrator
- ✅ OpenClaw routes complex tasks to OpenBotMan

---

## Quick Reference

### Start Interactive Mode
```bash
python orchestrator.py
```

### Start API Server
```bash
python api_server.py
```

### Run Example
```bash
python examples/simple_task.py
```

### Run Tests
```bash
pytest tests/
```

### Add New Agent
1. Edit `config.yaml` → add to `agents:`
2. Update `src/tools.py` → add to enum
3. Test: `python orchestrator.py`

### Add New Workflow
1. Edit `config.yaml` → add to `workflows:`
2. Test: `python orchestrator.py`
3. Run: `orchestrator.chat("Run workflow_name for X")`

---

## Support

- **Documentation**: See README.md and QUICKSTART.md
- **Examples**: Check examples/ directory
- **Issues**: Report on GitHub (when published)
- **Questions**: Check DEVELOPMENT.md for detailed guides
