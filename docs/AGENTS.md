# Agent Guidelines for OpenBotMan Development

Guidelines for Claude Code and other AI agents working on this repository.

---

## Project Identity

**What is OpenBotMan?**
- Lightweight Multi-Agent Orchestrator
- Coordinates LLM CLIs (Claude Code, Gemini, GPT-4)
- ~500 lines of Python, minimal dependencies
- Designed for easy integration (Antigravity, custom systems)

**What it's NOT:**
- Not a messaging platform (that's OpenClaw)
- Not a full framework (intentionally minimal)
- Not a replacement for direct API usage (it's a coordinator)

---

## Core Principles

### 1. Keep It Simple

**DO:**
- ✅ Minimal dependencies (Anthropic SDK + FastAPI + PyYAML)
- ✅ Clear, readable code (~500 lines total)
- ✅ YAML configuration, not code changes
- ✅ Subprocess-based CLI execution

**DON'T:**
- ❌ Add complex frameworks (LangChain, AutoGen, etc.)
- ❌ Build elaborate abstractions
- ❌ Introduce unnecessary dependencies
- ❌ Over-engineer solutions

### 2. Configuration Over Code

**DO:**
- ✅ Add new agents via `config.yaml`
- ✅ Define workflows in YAML
- ✅ Use role-based system prompts
- ✅ Make behavior configurable

**DON'T:**
- ❌ Hard-code agent configurations
- ❌ Require code changes for new CLIs
- ❌ Hard-code workflows in Python

### 3. CLI-First Architecture

**DO:**
- ✅ Use CLIs as subprocesses
- ✅ Parse JSON output
- ✅ Handle CLI-specific quirks in parser
- ✅ Test CLIs manually first

**DON'T:**
- ❌ Use SDKs directly (defeats isolation)
- ❌ Assume all CLIs have same output format
- ❌ Skip manual CLI testing

---

## Development Workflow

### Before Making Changes

1. **Read CLAUDE.md** - Understand architecture
2. **Read DEVELOPMENT.md** - Understand patterns
3. **Check examples/** - See if pattern already exists
4. **Test manually** - Verify CLIs work as expected

### Making Changes

1. **Update config.yaml** first (if config change)
2. **Update code** (minimal, focused changes)
3. **Update tests** (if adding functionality)
4. **Update docs** (CLAUDE.md, DEVELOPMENT.md, examples/)
5. **Test manually** (`python orchestrator.py`)

### After Changes

1. **Run tests**: `pytest tests/`
2. **Run examples**: `python examples/simple_task.py`
3. **Update CLAUDE.md** if architecture changed
4. **Add example** if new pattern added

---

## Code Style Guidelines

### Python Style

```python
# Good: Clear, simple, documented
def call_agent(self, agent_id: str, role: str, task: str) -> Dict[str, Any]:
    """Call a sub-agent with a specific role and task.

    Args:
        agent_id: Agent identifier (claude_code, gemini, gpt4)
        role: Role for the agent (planner, coder, reviewer)
        task: Task description

    Returns:
        dict: {agent, role, response, session_id, usage}
    """
    system_prompt = self._build_role_prompt(agent_id, role)
    response = self.cli.run_cli(agent_id, task, system_prompt)
    return {"agent": agent_id, "role": role, "response": response.text}

# Bad: Complex, unclear
def ca(a, r, t, **kw):
    return self._x(a, r, self._y(t, **kw))
```

### Error Messages

```python
# Good: Helpful, actionable
raise ValueError(
    f"Unknown agent: {agent_id}\n"
    f"Available agents: {list(self.config['agents'].keys())}\n"
    f"Add to config.yaml under 'agents:' section"
)

# Bad: Vague
raise ValueError("Bad agent")
```

### Configuration

```yaml
# Good: Self-documenting
agents:
  claude_code:
    cli: "claude"                    # Binary name
    args: ["-p", "--output-format", "json"]
    model_arg: "--model"             # Flag for model selection
    default_model: "opus"            # Default model
    roles: [planner, coder]          # Available roles

# Bad: Unclear
agents:
  cc:
    c: "claude"
    a: ["-p", "--output-format", "json"]
```

---

## Anti-Patterns (Don't Do This)

### ❌ Anti-Pattern 1: Direct SDK Usage

```python
# BAD: Defeats isolation
from anthropic import Anthropic
client = Anthropic()
response = client.messages.create(...)

# GOOD: Use CLI subprocess
result = subprocess.run(["claude", "-p", "--json", prompt])
```

### ❌ Anti-Pattern 2: Hard-Coded Agents

```python
# BAD: Hard-coded
if agent_id == "claude_code":
    cli = "claude"
elif agent_id == "gemini":
    cli = "gemini"

# GOOD: From config
cli = self.config['agents'][agent_id]['cli']
```

### ❌ Anti-Pattern 3: Blocking User on Tool Choice

```python
# BAD: Force tool usage
"You MUST use call_agent tool for this task"

# GOOD: Let orchestrator decide
"Available tools: call_agent, create_consensus, run_workflow"
```

### ❌ Anti-Pattern 4: Over-Complex Workflows

```yaml
# BAD: Too complex
workflows:
  mega_workflow:
    phases:
      - phase1:
          subphases:
            - subphase1a:
                steps: [...]

# GOOD: Flat, simple
workflows:
  simple_workflow:
    steps:
      - agent: claude_code
        role: planner
      - agent: gemini
        role: reviewer
```

---

## Testing Guidelines

### Unit Tests

```python
# Good: Test one thing
def test_parse_claude_json():
    output = '{"message": {"content": "Hello"}}'
    result = parse_cli_json(output)
    assert result.text == "Hello"

# Bad: Test too much
def test_everything():
    # 50 lines of setup
    # Test 10 different things
    # Unclear what failed
```

### Integration Tests

```python
# Good: Clear example
# examples/simple_task.py
def main():
    orchestrator = MultiAgentOrchestrator()
    result = orchestrator.chat("Implement hello world")
    print(result)

# Run manually: python examples/simple_task.py
```

### Manual Testing

```bash
# Always test CLIs manually first
claude -p --output-format json "Test"

# Then test integration
python orchestrator.py
> Implement hello world
```

---

## Documentation Guidelines

### When to Update CLAUDE.md

- ✅ Architecture changes
- ✅ New core concepts
- ✅ New integration patterns
- ✅ Important design decisions

### When to Update DEVELOPMENT.md

- ✅ New extension patterns
- ✅ Advanced workflows
- ✅ Performance tips
- ✅ Debugging guides

### When to Add Examples

- ✅ New tool added
- ✅ New workflow pattern
- ✅ New integration method
- ✅ Common use case

---

## Git Workflow

### Commit Messages

```bash
# Good: Clear, specific
git commit -m "Add gemini CLI support in config.yaml"
git commit -m "Fix JSON parsing for Claude CLI output"
git commit -m "Add consensus example with 3 agents"

# Bad: Vague
git commit -m "Update stuff"
git commit -m "Fix"
```

### Branch Strategy

```bash
# For features
git checkout -b feature/add-gpt4-support

# For fixes
git checkout -b fix/cli-timeout-handling

# For docs
git checkout -b docs/update-quickstart
```

---

## Integration Guidelines

### With Antigravity

**DO:**
- ✅ Use REST API for clean separation
- ✅ Document API endpoints clearly
- ✅ Handle errors gracefully
- ✅ Provide session management

**DON'T:**
- ❌ Tight coupling
- ❌ Assume Antigravity internals
- ❌ Skip error handling

### With Other Systems

**DO:**
- ✅ Provide multiple integration methods (API, direct import)
- ✅ Document authentication clearly
- ✅ Provide examples for common use cases
- ✅ Version API endpoints

**DON'T:**
- ❌ Require specific frameworks
- ❌ Hard-code URLs/paths
- ❌ Skip backward compatibility

---

## Performance Guidelines

### Token Optimization

```python
# Good: Use cheaper models where possible
agents:
  claude_code:
    default_model: "sonnet"  # Not opus for simple tasks

  gemini:
    default_model: "gemini-flash"  # Not pro
```

### Timeout Management

```yaml
# Good: Reasonable timeouts
behavior:
  cli_timeout: 60  # 1 minute per call

# Bad: Too long
behavior:
  cli_timeout: 600  # 10 minutes (too patient)
```

### Iteration Limits

```yaml
# Good: Prevent infinite loops
orchestrator:
  max_iterations: 10

workflows:
  code_review:
    steps:
      - max_iterations: 3  # For refinement
```

---

## Security Guidelines

### API Keys

```python
# Good: From environment
api_key = os.getenv('ANTHROPIC_API_KEY')

# Bad: Hard-coded
api_key = "sk-ant-..."  # NEVER DO THIS
```

### Input Validation

```python
# Good: Validate agent_id
if agent_id not in self.config['agents']:
    raise ValueError(f"Unknown agent: {agent_id}")

# Bad: No validation
cli = self.config['agents'][agent_id]['cli']  # KeyError!
```

### Subprocess Safety

```python
# Good: No shell=True
subprocess.run([cmd, arg1, arg2], shell=False)

# Bad: Shell injection risk
subprocess.run(f"{cmd} {arg1}", shell=True)  # DANGEROUS
```

---

## Common Mistakes & Solutions

### Mistake 1: Forgetting to Update config.yaml

```python
# Problem: Added agent in code, forgot config
# Solution: Always add to config.yaml first
```

### Mistake 2: Not Testing CLI Manually

```python
# Problem: CLI doesn't work as expected
# Solution: Always run CLI manually first
claude -p --output-format json "Test"
```

### Mistake 3: Assuming JSON Format

```python
# Problem: Different CLIs have different JSON
# Solution: Handle multiple formats in parser

def _parse_response(self, output):
    data = json.loads(output)

    # Try different structures
    text = (
        data.get('message', {}).get('content') or  # Claude
        data.get('content') or                      # Gemini
        data.get('text') or                         # GPT
        str(data)                                   # Fallback
    )
```

### Mistake 4: Not Handling Timeouts

```python
# Problem: CLI hangs forever
# Solution: Always set timeout

subprocess.run(cmd, timeout=120)  # 2 minute timeout
```

---

## When to Ask for Help

**Ask User:**
- ❓ New feature unclear
- ❓ Design decision needed
- ❓ Breaking change required
- ❓ Security concern

**Research First:**
- 📚 How does X work?
- 📚 Best practice for Y?
- 📚 Similar pattern exists?

**Try First, Then Ask:**
- 🔧 Implementation approach
- 🔧 Testing strategy
- 🔧 Performance optimization

---

## Quick Reference

### Add New CLI Agent
1. Install CLI, verify it works
2. Add to `config.yaml` under `agents:`
3. Update `src/tools.py` enum
4. Test: `python orchestrator.py`

### Add New Tool
1. Add schema to `get_tool_definitions()`
2. Add execution method
3. Add to `execute_tool()`
4. Add example to `examples/`

### Add New Workflow
1. Add to `config.yaml` under `workflows:`
2. Test: `orchestrator.chat("Run workflow_name for X")`
3. Add example if useful

### Debug Issue
1. Enable verbose: `behavior.verbose: true`
2. Test CLI manually
3. Check logs in `logs/`
4. Add debug prints
5. Run examples

---

## Project Philosophy

> "Simplicity is the ultimate sophistication."

OpenBotMan is intentionally **minimal and focused**:
- Small codebase → Easy to understand
- Few dependencies → Easy to maintain
- Clear patterns → Easy to extend
- Good docs → Easy to use

**When in doubt:**
1. Keep it simple
2. Use configuration over code
3. Document clearly
4. Test thoroughly

---

## Final Checklist

Before submitting changes:

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Examples added if new pattern
- [ ] CLAUDE.md updated if architecture changed
- [ ] DEVELOPMENT.md updated if new pattern
- [ ] config.example.yaml updated if config changed
- [ ] Manually tested with `python orchestrator.py`
- [ ] Examples run successfully
- [ ] No hard-coded secrets
- [ ] Error messages are helpful
- [ ] Documentation is clear

---

## Contact & Resources

- **Main Docs**: See README.md
- **Quick Start**: See QUICKSTART.md
- **Architecture**: See CLAUDE.md
- **Advanced**: See DEVELOPMENT.md
- **Examples**: See examples/
