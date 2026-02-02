# Development Guide

Complete guide for developing, extending, and maintaining OpenBotMan.

---

## Table of Contents

1. [Architecture Deep Dive](#architecture-deep-dive)
2. [Code Walkthrough](#code-walkthrough)
3. [Extension Patterns](#extension-patterns)
4. [Advanced Workflows](#advanced-workflows)
5. [Debugging Guide](#debugging-guide)
6. [Performance Optimization](#performance-optimization)
7. [Production Deployment](#production-deployment)

---

## Architecture Deep Dive

### The Orchestrator-Agent Pattern

OpenBotMan uses a **hierarchical agent architecture**:

```
Level 1: Orchestrator (Claude Opus)
  ↓ Has tools to call:
Level 2: Sub-Agents (Claude Code, Gemini, GPT-4)
  ↓ Execute via:
Level 3: CLI Subprocesses
```

**Why this works:**
- Orchestrator has **strategic intelligence** (Opus-level reasoning)
- Sub-agents have **specialized skills** (coding, review, testing)
- CLIs provide **isolation** (crashes don't propagate)

### Tool Use Flow

```python
1. User: "Implement feature X with review"

2. Orchestrator receives message
   → Anthropic API call with tools

3. Orchestic responds with tool_use:
   {
     "type": "tool_use",
     "name": "call_agent",
     "input": {
       "agent_id": "claude_code",
       "role": "planner",
       "task": "Create plan for feature X"
     }
   }

4. OpenBotMan executes tool:
   → CLIRunner.run_cli("claude_code", "Create plan...")
   → subprocess.run(["claude", "-p", "--json", "Create plan..."])
   → Parse JSON response

5. Tool result returned to Orchestrator:
   {
     "type": "tool_result",
     "content": "{\"response\": \"Plan: ...\"}"
   }

6. Orchestrator decides next step:
   → Call another agent? → Return final answer? → Iterate?

7. Loop until stop_reason == "end_turn"
```

### Session Management

Each agent maintains its own session via CLI session IDs:

```python
# CLIRunner manages sessions
self.sessions = {
    "claude_code": "session-abc-123",
    "gemini": "session-def-456",
    "gpt4": "session-ghi-789"
}

# When calling agent:
cmd = ["claude", "--session-id", "session-abc-123", "-p", "Next prompt"]

# CLI loads previous context automatically
# → No need to pass full history each time
```

---

## Code Walkthrough

### src/orchestrator.py

**Key methods:**

```python
class MultiAgentOrchestrator:
    def __init__(self, config_path):
        # Load config.yaml
        # Initialize CLI runners
        # Initialize tools
        # Create Anthropic client
        # Build system prompt

    def chat(self, user_message: str) -> str:
        # Main agentic loop
        # 1. Add user message to conversation
        # 2. Call Anthropic API with tools
        # 3. If tool_use: execute tools
        # 4. Add tool results to conversation
        # 5. Repeat until end_turn
        # 6. Return final answer

    def _build_system_prompt(self) -> str:
        # Build orchestrator's system prompt
        # Include: available agents, tools, workflows

    def reset(self):
        # Clear conversation state
        # Reset all agent sessions
```

**Important:** The agentic loop can iterate up to `max_iterations` times. If orchestrator keeps calling tools, it will eventually hit the limit.

### src/cli_runners.py

**Key methods:**

```python
class CLIRunner:
    def run_cli(self, agent_id, prompt, system_prompt, model, timeout):
        # 1. Get agent config
        # 2. Build command: [cli, args, --model, --session-id, prompt]
        # 3. Execute subprocess
        # 4. Parse JSON output
        # 5. Return CLIResponse

    def _parse_response(self, output, agent_id):
        # Parse JSON from CLI stdout
        # Extract: text, session_id, usage
        # Handle different JSON structures
```

**Important:** Different CLIs have different JSON structures. We handle:
- Claude CLI: `{message: {content: "..."}}`
- Gemini CLI: `{content: "..."}`
- GPT CLI: `{text: "..."}`

### src/tools.py

**Key methods:**

```python
class OrchestratorTools:
    def get_tool_definitions(self):
        # Return Anthropic-style tool schemas
        # - call_agent
        # - create_consensus
        # - run_workflow

    def call_agent(self, agent_id, role, task, context):
        # 1. Build role-specific system prompt
        # 2. Execute CLI via CLIRunner
        # 3. Add to conversation history
        # 4. Return result

    def create_consensus(self, agents, topic, min_agreement):
        # 1. Call each agent with same topic
        # 2. Parse votes (APPROVE/REJECT)
        # 3. Calculate agreement ratio
        # 4. Return consensus result

    def run_workflow(self, workflow_name, input_data):
        # 1. Get workflow from config
        # 2. Execute steps sequentially
        # 3. Pass output as context to next step
        # 4. Handle max_iterations for refinement
        # 5. Return final output

    def _build_role_prompt(self, agent_id, role):
        # Build system prompt based on role
        # Add agent-specific traits
```

---

## Extension Patterns

### Pattern 1: Adding a New Tool

```python
# 1. Add to src/tools.py
def get_tool_definitions(self):
    return [
        # ... existing tools ...
        {
            "name": "my_new_tool",
            "description": "What this tool does",
            "input_schema": {
                "type": "object",
                "properties": {
                    "param1": {"type": "string"},
                    "param2": {"type": "number"}
                },
                "required": ["param1"]
            }
        }
    ]

# 2. Add execution method
def my_new_tool(self, param1: str, param2: float = 1.0):
    # Tool logic
    result = do_something(param1, param2)
    return {"result": result}

# 3. Add to execute_tool()
def execute_tool(self, tool_name, tool_input):
    if tool_name == "my_new_tool":
        return self.my_new_tool(**tool_input)
    # ... rest
```

### Pattern 2: Custom Agent Behavior

```python
# src/tools.py, in _build_role_prompt()

def _build_role_prompt(self, agent_id, role):
    base_prompt = role_prompts.get(role)

    # Add agent-specific customization
    if agent_id == "gemini":
        if role == "reviewer":
            base_prompt += "\n\nFocus on creative alternatives and edge cases."

    elif agent_id == "claude_code":
        if role == "coder":
            base_prompt += "\n\nPrefer functional programming patterns."

    return base_prompt
```

### Pattern 3: Parallel Agent Execution

```python
# Currently sequential. For parallel:

import asyncio

async def call_agent_async(self, agent_id, role, task):
    # Async version of call_agent
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        self.cli.run_cli,
        agent_id, task, ...
    )
    return result

async def parallel_consensus(self, agents, topic):
    # Call all agents in parallel
    tasks = [
        self.call_agent_async(agent, "reviewer", topic)
        for agent in agents
    ]
    results = await asyncio.gather(*tasks)
    # Aggregate results
    return aggregate(results)
```

### Pattern 4: Workflow Validation Steps

```yaml
# config.yaml
workflows:
  validated_workflow:
    steps:
      - agent: claude_code
        role: coder
        task: "Implement feature"
        validators:
          - agent: gemini
            min_score: 0.8
            feedback_prompt: "Score 0-1 and suggest improvements"
```

```python
# In src/tools.py, run_workflow():

for step in workflow['steps']:
    result = self.call_agent(...)

    # Validation
    if 'validators' in step:
        for validator in step['validators']:
            score = self._validate_result(
                result['response'],
                validator
            )
            if score < validator['min_score']:
                # Retry with feedback
                result = self._refine_result(...)
```

---

## Advanced Workflows

### Multi-Phase Workflow

```yaml
workflows:
  full_development_cycle:
    phases:
      - name: requirements
        steps:
          - agent: claude_code
            role: planner
            task: "Analyze requirements"
          - agent: gemini
            role: critic
            task: "Challenge assumptions"

      - name: implementation
        steps:
          - agent: claude_code
            role: architect
            task: "Design system"
          - agent: claude_code
            role: coder
            task: "Implement"

      - name: validation
        type: consensus
        agents: [claude_code, gemini, gpt4]
        task: "Review implementation"
        min_agreement: 0.8
```

### Iterative Refinement Workflow

```yaml
workflows:
  iterative_design:
    steps:
      - agent: claude_code
        role: architect
        task: "Initial design"

      - agent: gemini
        role: critic
        task: "Critique design"
        max_iterations: 5
        convergence_criteria: "APPROVED"
```

### Debate Workflow

```python
# Custom debate tool
def run_debate(self, topic, agents, rounds):
    opinions = {agent: [] for agent in agents}

    for round in range(rounds):
        for agent in agents:
            # Gather other agents' opinions
            other_opinions = [
                f"{a}: {opinions[a][-1]}"
                for a in agents if a != agent and opinions[a]
            ]

            # Agent responds
            prompt = f"Round {round+1}:\n{topic}\n\nOthers say:\n" + \
                     "\n".join(other_opinions) + "\n\nYour position?"

            response = self.call_agent(agent, "critic", prompt)
            opinions[agent].append(response['response'])

    # Synthesis
    summary = self.call_agent(
        "claude_code",
        "planner",
        f"Synthesize debate:\n{json.dumps(opinions, indent=2)}"
    )

    return summary
```

---

## Debugging Guide

### Enable Verbose Logging

```python
# In config.yaml
behavior:
  verbose: true

# Or in code
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Inspect Conversation State

```python
orchestrator = MultiAgentOrchestrator()
orchestrator.chat("Test")

# View messages
print(json.dumps(orchestrator.messages, indent=2))

# View agent call history
print(json.dumps(orchestrator.get_history(), indent=2))
```

### Test CLI Manually

```bash
# Test Claude Code CLI
claude -p --output-format json --model opus "Hello world"

# Test with session
claude -p --output-format json --session-id test-123 "Message 1"
claude -p --output-format json --session-id test-123 "Message 2"
# Should remember context
```

### Debug Tool Execution

```python
# In src/tools.py, add logging
def execute_tool(self, tool_name, tool_input):
    print(f"[DEBUG] Tool: {tool_name}")
    print(f"[DEBUG] Input: {json.dumps(tool_input, indent=2)}")

    result = # ... execute tool ...

    print(f"[DEBUG] Output: {json.dumps(result, indent=2)}")
    return result
```

### Common Issues

**Issue 1: Orchestrator loops forever**
```python
# Cause: Tool keeps returning partial results
# Fix: Ensure tools return clear completion signals
# Or: Reduce max_iterations in config
```

**Issue 2: CLI returns non-JSON**
```bash
# Debug: Run CLI manually
claude -p --output-format json "Test"

# Fix: Ensure --output-format json in args
```

**Issue 3: Session not persisted**
```python
# Debug: Check session IDs
print(cli_runner.sessions)

# Fix: Ensure session_arg is configured
```

---

## Performance Optimization

### Reduce Token Usage

```python
# 1. Use cheaper models for sub-agents
agents:
  claude_code:
    default_model: "sonnet"  # Instead of opus

  gemini:
    default_model: "gemini-flash"  # Instead of pro

# 2. Use concise system prompts
# 3. Set max_iterations conservatively
```

### Parallel Execution

```python
# For independent tasks, execute in parallel
import concurrent.futures

def parallel_call_agents(self, tasks):
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [
            executor.submit(self.call_agent, **task)
            for task in tasks
        ]
        results = [f.result() for f in futures]
    return results
```

### Caching

```python
# Cache tool results
class OrchestratorTools:
    def __init__(self, ...):
        self.cache = {}

    def call_agent(self, agent_id, role, task, context):
        cache_key = f"{agent_id}:{role}:{hash(task)}"

        if cache_key in self.cache:
            print("[CACHE HIT]")
            return self.cache[cache_key]

        result = # ... execute ...
        self.cache[cache_key] = result
        return result
```

---

## Production Deployment

### Environment Setup

```bash
# Use production-grade WSGI server
pip install gunicorn

# Run API server
gunicorn -w 4 -k uvicorn.workers.UvicornWorker api_server:app
```

### Configuration Management

```yaml
# config.production.yaml
orchestrator:
  model: claude-opus-4
  max_iterations: 5  # Lower for prod

behavior:
  cli_timeout: 60  # Shorter timeout
  verbose: false   # Disable debug logging

# Load via
orchestrator = MultiAgentOrchestrator("config.production.yaml")
```

### Monitoring

```python
# Add metrics
import time

class MetricsCollector:
    def __init__(self):
        self.metrics = {
            "total_requests": 0,
            "total_agent_calls": 0,
            "total_tokens": 0,
            "avg_duration": 0
        }

    def record_request(self, duration, agent_calls, tokens):
        self.metrics["total_requests"] += 1
        self.metrics["total_agent_calls"] += agent_calls
        self.metrics["total_tokens"] += tokens
        # Update avg_duration
```

### Error Handling

```python
# Implement retry logic
from tenacity import retry, stop_after_attempt, wait_exponential

class RobustCLIRunner(CLIRunner):
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    def run_cli(self, *args, **kwargs):
        return super().run_cli(*args, **kwargs)
```

---

## Best Practices

1. **Always test CLIs manually first** before configuring
2. **Use workflows for repeated patterns** instead of ad-hoc instructions
3. **Set reasonable timeouts** to avoid hanging
4. **Use consensus for important decisions** (80%+ agreement)
5. **Monitor token usage** and optimize expensive calls
6. **Version your config.yaml** for reproducibility
7. **Keep system prompts focused** on role, not implementation
8. **Use examples/** to document common patterns
9. **Test with cheap models first** (Sonnet, Flash) before Opus
10. **Implement logging/monitoring** for production use

---

## Troubleshooting Checklist

- [ ] CLIs installed and in PATH?
- [ ] API keys in .env?
- [ ] config.yaml syntax valid?
- [ ] CLIs return JSON?
- [ ] Session args configured?
- [ ] Timeouts reasonable?
- [ ] Python 3.8+?
- [ ] Dependencies installed?
- [ ] No firewall blocking subprocess?
- [ ] Sufficient disk space for logs?

---

## Resources

- **Anthropic Tool Use**: https://docs.anthropic.com/claude/docs/tool-use
- **Subprocess Module**: https://docs.python.org/3/library/subprocess.html
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **YAML Spec**: https://yaml.org/spec/

---

## Contributing

When contributing:
1. Follow existing code style
2. Add tests for new features
3. Update CLAUDE.md if architecture changes
4. Add examples for new patterns
5. Document in DEVELOPMENT.md
