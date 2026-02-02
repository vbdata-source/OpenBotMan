# Architecture Documentation

Visual and detailed architecture documentation for OpenBotMan.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     USER / CLIENT                            │
│  (Interactive CLI, REST API, Python Import, Antigravity)    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               ORCHESTRATOR LAYER                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  MultiAgentOrchestrator (src/orchestrator.py)        │ │
│  │  • Claude Opus via Anthropic API                     │ │
│  │  • Agentic loop with tool use                        │ │
│  │  • Conversation state management                     │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   TOOLS LAYER                                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  OrchestratorTools (src/tools.py)                    │ │
│  │  • call_agent(agent_id, role, task)                  │ │
│  │  • create_consensus(agents, topic)                   │ │
│  │  • run_workflow(workflow_name, data)                 │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               CLI EXECUTION LAYER                            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  CLIRunner (src/cli_runners.py)                      │ │
│  │  • Subprocess management                             │ │
│  │  • Session ID tracking                               │ │
│  │  • JSON output parsing                               │ │
│  │  • Error handling & retries                          │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   Claude    │ │   Gemini    │ │    GPT-4    │
    │   Code CLI  │ │     CLI     │ │     CLI     │
    └─────────────┘ └─────────────┘ └─────────────┘
```

---

## Data Flow

### Simple Task Flow

```
1. USER INPUT
   "Implement binary search in Python"
   │
   ▼
2. ORCHESTRATOR RECEIVES
   messages.append({role: "user", content: "..."})
   │
   ▼
3. ANTHROPIC API CALL
   client.messages.create(
     model="claude-opus-4",
     messages=[...],
     tools=[call_agent, create_consensus, run_workflow]
   )
   │
   ▼
4. ORCHESTRATOR DECIDES
   "I'll use call_agent to delegate to claude_code"
   │
   ▼
5. TOOL USE
   {
     type: "tool_use",
     name: "call_agent",
     input: {
       agent_id: "claude_code",
       role: "coder",
       task: "Implement binary search in Python"
     }
   }
   │
   ▼
6. TOOL EXECUTION
   OrchestratorTools.call_agent(...)
     ↓
   CLIRunner.run_cli("claude_code", "Implement...", system_prompt)
     ↓
   subprocess.run(["claude", "-p", "--json", "Implement..."])
     ↓
   Parse JSON: {message: {content: "def binary_search..."}}
     ↓
   Return: {agent: "claude_code", response: "def binary_search..."}
   │
   ▼
7. TOOL RESULT
   {
     type: "tool_result",
     tool_use_id: "...",
     content: '{"agent": "claude_code", "response": "..."}'
   }
   │
   ▼
8. ORCHESTRATOR CONTINUES
   messages.append({role: "user", content: [tool_result]})
   │
   ▼
9. FINAL RESPONSE
   stop_reason: "end_turn"
   content: "Here's the binary search implementation: ..."
   │
   ▼
10. USER RECEIVES
    "Here's the binary search implementation: ..."
```

---

## Component Interactions

### Orchestrator ↔ Tools

```python
# Orchestrator (src/orchestrator.py)
response = self.client.messages.create(
    model="claude-opus-4",
    tools=self.tools.get_tool_definitions(),  # ← Get tool schemas
    messages=self.messages
)

if response.stop_reason == "tool_use":
    for block in response.content:
        if block.type == "tool_use":
            result = self.tools.execute_tool(  # ← Execute tool
                block.name,
                block.input
            )
```

### Tools ↔ CLI Runner

```python
# Tools (src/tools.py)
def call_agent(self, agent_id, role, task):
    system_prompt = self._build_role_prompt(agent_id, role)

    response = self.cli.run_cli(  # ← Call CLI Runner
        agent_id=agent_id,
        prompt=task,
        system_prompt=system_prompt
    )

    return {
        "agent": agent_id,
        "response": response.text
    }
```

### CLI Runner ↔ Subprocess

```python
# CLI Runner (src/cli_runners.py)
def run_cli(self, agent_id, prompt, system_prompt):
    cmd = [
        self.config['agents'][agent_id]['cli'],
        *self.config['agents'][agent_id]['args'],
        "--session-id", self.sessions[agent_id],
        prompt
    ]

    result = subprocess.run(  # ← Execute subprocess
        cmd,
        capture_output=True,
        text=True,
        timeout=120
    )

    return self._parse_response(result.stdout)
```

---

## Session Management

### Session Lifecycle

```
1. FIRST CALL
   user → orchestrator → tools → cli_runner
   │
   ├─ No session exists
   ├─ Generate UUID: "abc-123-def"
   ├─ Store: sessions["claude_code"] = "abc-123-def"
   └─ Pass to CLI: ["claude", "--session-id", "abc-123-def", ...]
   │
   ▼
2. SECOND CALL (SAME AGENT)
   user → orchestrator → tools → cli_runner
   │
   ├─ Session exists
   ├─ Retrieve: sessions["claude_code"] = "abc-123-def"
   └─ Pass to CLI: ["claude", "--session-id", "abc-123-def", ...]
   │
   ▼
3. CLI MAINTAINS CONTEXT
   Claude CLI loads conversation history for "abc-123-def"
   → Previous messages available
   → Continuity maintained
   │
   ▼
4. RESET (IF NEEDED)
   orchestrator.reset()
   ├─ Clear orchestrator messages
   ├─ Clear tools conversation_history
   └─ Delete sessions["claude_code"]
```

### Multi-Agent Sessions

```
User Session: "user-123"
│
├─ Orchestrator Session: Anthropic API maintains
│  (via messages array)
│
└─ Sub-Agent Sessions: CLI Runner maintains
   │
   ├─ claude_code: "session-abc-123"
   ├─ gemini: "session-def-456"
   └─ gpt4: "session-ghi-789"
```

Each sub-agent has its own isolated session with continuity.

---

## Configuration Architecture

### Config Loading Hierarchy

```
1. config.yaml (Primary)
   ↓
2. Environment variables (.env)
   ↓
3. Default values (in code)
```

### Config Structure

```yaml
# Orchestrator config
orchestrator:
  model: claude-opus-4
  max_iterations: 10

# Agent definitions
agents:
  agent_id:
    cli: "binary_name"
    args: [...]
    model_arg: "--flag"
    default_model: "model_name"
    session_arg: "--session-flag"
    roles: [role1, role2]

# Workflow definitions
workflows:
  workflow_name:
    steps:
      - agent: agent_id
        role: role_name
        task: "task_template"
        max_iterations: 3

# Behavior settings
behavior:
  cli_timeout: 120
  verbose: false
```

### Runtime Config Access

```python
# Orchestrator
self.config['orchestrator']['model']  # → "claude-opus-4"

# CLI Runner
agent_config = self.config['agents'][agent_id]
cli = agent_config['cli']  # → "claude"

# Tools
workflow = self.config['workflows'][workflow_name]
steps = workflow['steps']  # → [...]
```

---

## Tool Execution Architecture

### Tool Definition

```python
{
    "name": "call_agent",
    "description": "Call a sub-agent with role and task",
    "input_schema": {
        "type": "object",
        "properties": {
            "agent_id": {"type": "string", "enum": ["claude_code", ...]},
            "role": {"type": "string", "enum": ["planner", ...]},
            "task": {"type": "string"}
        },
        "required": ["agent_id", "role", "task"]
    }
}
```

### Tool Execution Flow

```
Orchestrator:
  ↓ Decides to use tool
  ↓ Returns tool_use block
  ↓
Tools.execute_tool():
  ↓ Route to specific tool method
  ↓
Tools.call_agent():
  ↓ Build role prompt
  ↓ Call CLI Runner
  ↓ Add to history
  ↓ Return result
  ↓
Tool Result:
  ↓ Format as JSON
  ↓ Return to Orchestrator
  ↓
Orchestrator:
  ↓ Add to messages
  ↓ Continue loop
```

---

## Workflow Execution Architecture

### Workflow Definition

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
        max_iterations: 3

      - agent: claude_code
        role: coder
        task: "Implement approved plan"
```

### Workflow Execution Flow

```
run_workflow("code_review", "Implement OAuth2")
│
├─ Load workflow from config
├─ Initialize: current_context = "Implement OAuth2"
│
├─ Step 1: claude_code (planner)
│  ├─ task = "Create implementation plan\n\nInput:\nImplement OAuth2"
│  ├─ call_agent("claude_code", "planner", task)
│  ├─ result = "Plan: 1. Setup routes, 2. ..."
│  └─ current_context = result
│
├─ Step 2: gemini (reviewer) with max_iterations=3
│  ├─ Iteration 1:
│  │  ├─ task = "Review plan\n\nInput:\nPlan: 1. Setup routes..."
│  │  ├─ call_agent("gemini", "reviewer", task)
│  │  ├─ result = "Add PKCE flow"
│  │  ├─ Feedback check: "APPROVED" in result? → No
│  │  └─ Continue
│  ├─ Iteration 2:
│  │  ├─ task = "Improve based on:\nAdd PKCE flow\n\nOriginal:..."
│  │  ├─ result = "Updated plan with PKCE"
│  │  ├─ Feedback check: "APPROVED" in result? → No
│  │  └─ Continue
│  ├─ Iteration 3:
│  │  ├─ result = "APPROVED"
│  │  └─ Break (approved)
│  └─ current_context = final result
│
├─ Step 3: claude_code (coder)
│  ├─ task = "Implement approved plan\n\nInput:\n[approved plan]"
│  ├─ call_agent("claude_code", "coder", task)
│  └─ current_context = implementation code
│
└─ Return: {workflow: "code_review", final_output: "[code]"}
```

---

## Error Handling Architecture

### Error Propagation

```
CLI Subprocess Error
  ↓
CLIRunner catches
  ↓ Checks return code ≠ 0
  ↓ Raises RuntimeError
  ↓
Tools catches
  ↓ Returns error in tool_result
  ↓
Orchestrator receives error
  ↓ Decides: retry? fallback? abort?
  ↓
User receives error or fallback result
```

### Timeout Handling

```
CLI Subprocess
  ↓ subprocess.run(timeout=120)
  ↓
After 120s: TimeoutExpired
  ↓
CLIRunner catches
  ↓ Raises RuntimeError("CLI timeout")
  ↓
Tools catches
  ↓ Returns error to orchestrator
  ↓
Orchestrator may retry with different agent
```

---

## Integration Architecture

### REST API Integration

```
External Client (Antigravity)
  ↓ HTTP POST /chat
  ↓
FastAPI (api_server.py)
  ↓ Create/Get orchestrator for session
  ↓
MultiAgentOrchestrator.chat(message)
  ↓ [Full orchestration process]
  ↓
Return JSON: {response: "...", history: [...]}
  ↓
External Client receives result
```

### Direct Python Integration

```
Antigravity Python Code
  ↓ from src.orchestrator import MultiAgentOrchestrator
  ↓
orchestrator = MultiAgentOrchestrator()
  ↓
result = orchestrator.chat("Task")
  ↓ [Full orchestration process]
  ↓
Antigravity uses result
```

---

## Scalability Considerations

### Current Limitations

1. **Sequential execution**: Steps run one after another
2. **Single orchestrator**: One Opus call at a time
3. **No caching**: Every call hits CLI
4. **Session storage**: In-memory only

### Potential Improvements

1. **Parallel execution**: Independent tasks run concurrently
2. **Multiple orchestrators**: Pool of orchestrators
3. **Result caching**: Cache tool results
4. **Persistent sessions**: Save to disk/database

---

## Security Architecture

### API Key Management

```
.env file
  ↓ ANTHROPIC_API_KEY=...
  ↓
load_dotenv()
  ↓
os.getenv('ANTHROPIC_API_KEY')
  ↓
Anthropic(api_key=...)
```

### Subprocess Safety

```python
# Safe: No shell interpolation
subprocess.run([cmd, arg1, arg2], shell=False)

# Unsafe (NOT USED)
subprocess.run(f"{cmd} {arg1}", shell=True)  # DANGEROUS
```

### Input Validation

```python
# Agent ID validation
if agent_id not in self.config['agents']:
    raise ValueError(f"Unknown agent: {agent_id}")

# Role validation
if role not in valid_roles:
    raise ValueError(f"Unknown role: {role}")
```

---

## Testing Architecture

### Test Layers

```
1. Unit Tests (tests/test_*.py)
   ↓ Test individual components
   ↓ Mock external dependencies
   ↓
2. Integration Tests (examples/*.py)
   ↓ Test full workflows
   ↓ Use real CLIs (optional)
   ↓
3. Manual Tests (orchestrator.py)
   ↓ Interactive testing
   ↓ Real API calls
```

### Test Data Flow

```
Test
  ↓ Mock config.yaml
  ↓
Component under test
  ↓ Mock CLIRunner (unit tests)
  ↓ OR Real CLIRunner (integration)
  ↓
Assert results
```

---

## Deployment Architecture

### Development

```
Local Machine
  ↓ python orchestrator.py
  ↓ Interactive mode
```

### API Server

```
Server
  ↓ python api_server.py
  ↓ OR gunicorn api_server:app
  ↓
Listens on port 8000
  ↓
Clients connect via HTTP
```

### Production

```
Load Balancer
  ↓
Multiple API Server Instances
  ↓ Each with own orchestrator pool
  ↓
Shared Config (env vars)
  ↓
Centralized Logging
```

---

## Summary

OpenBotMan's architecture is designed for:
- **Simplicity**: Minimal layers, clear flow
- **Isolation**: CLI subprocess pattern
- **Flexibility**: Config-driven, easy to extend
- **Integration**: Multiple entry points (CLI, API, import)

The orchestrator-tools-cli_runner pattern provides clear separation of concerns while maintaining simplicity.
