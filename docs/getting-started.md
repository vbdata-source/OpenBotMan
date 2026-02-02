# Getting Started with OpenBotMan

Welcome to OpenBotMan! This guide will help you set up your own multi-agent AI development team.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [First Run](#first-run)
5. [Basic Usage](#basic-usage)
6. [IDE Integration](#ide-integration)
7. [Next Steps](#next-steps)

---

## Prerequisites

### Required
- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 8+** - Install: `npm install -g pnpm`
- **API Key** for at least one LLM:
  - [Anthropic (Claude)](https://console.anthropic.com/) - Recommended
  - [OpenAI (GPT-4)](https://platform.openai.com/)
  - [Google (Gemini)](https://ai.google.dev/)

### Optional
- **Docker** - For containerized deployment
- **Ollama** - For free local LLMs

---

## Installation

### Option 1: From Source

```bash
# Clone the repository
git clone https://github.com/vbdata-source/OpenBotMan.git
cd OpenBotMan

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Option 2: Docker

```bash
# Pull the image
docker pull ghcr.io/vbdata-source/openbotman:latest

# Or build locally
docker build -t openbotman .
```

### Option 3: npm (Coming Soon)

```bash
npm install -g @openbotman/cli
```

---

## Configuration

### 1. Create Configuration File

```bash
cp config.example.yaml config.yaml
```

### 2. Set Your API Keys

Edit `config.yaml` or use environment variables:

```yaml
# config.yaml - Minimal configuration
orchestrator:
  model: claude-sonnet-4-20250514

agents:
  - id: claude_code
    name: Claude Code
    role: coder
    provider: anthropic
    model: claude-sonnet-4-20250514
    enabled: true
```

Or use environment variables:

```bash
# .env file
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
```

### 3. Configure Agents

Each agent needs:
- **id**: Unique identifier
- **role**: coder, reviewer, tester, architect, etc.
- **provider**: anthropic, openai, google, ollama
- **model**: The specific model to use
- **enabled**: Whether this agent is active

Example multi-agent configuration:

```yaml
agents:
  # Main coder - Claude Sonnet
  - id: claude_code
    name: Claude Code
    role: coder
    provider: anthropic
    model: claude-sonnet-4-20250514
    enabled: true
    systemPrompt: |
      You are an expert software developer.
      Write clean, efficient, well-documented code.
    capabilities:
      code: true
      review: true
      filesystem: true
      shell: true
  
  # Reviewer - Gemini (different perspective)
  - id: gemini_review
    name: Gemini Reviewer
    role: reviewer
    provider: google
    model: gemini-2.0-flash
    enabled: true
    systemPrompt: |
      You are a critical code reviewer.
      Find bugs, security issues, and suggest improvements.
    capabilities:
      code: false
      review: true
  
  # Tester - GPT-4
  - id: gpt_tester
    name: GPT-4 Tester
    role: tester
    provider: openai
    model: gpt-4-turbo-preview
    enabled: true
    systemPrompt: |
      You are a testing expert.
      Write comprehensive tests with edge cases.
    capabilities:
      code: true
      review: false
  
  # Local LLM for quick queries (free!)
  - id: ollama_quick
    name: Local Assistant
    role: research
    provider: ollama
    model: codellama:13b
    enabled: false  # Enable when Ollama is running
    api:
      baseUrl: http://localhost:11434
```

---

## First Run

### CLI Interactive Mode

```bash
# Start interactive chat
pnpm start

# Or use the CLI directly
openbotman chat
```

You'll see:
```
╔═══════════════════════════════════════════════════════════╗
║   ██████╗ ██████╗ ███████╗███╗   ██╗                     ║
║  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║                     ║
║  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║                     ║
║  ... BOTMAN ...                                           ║
╚═══════════════════════════════════════════════════════════╝

✔ Orchestrator ready!

Type your message (or "exit" to quit, "status" for status)

You:
```

### API Server Mode

```bash
# Start API server
openbotman serve

# Or with Docker
docker run -p 8080:8080 -e ANTHROPIC_API_KEY=... openbotman
```

The API will be available at `http://localhost:8080`.

---

## Basic Usage

### Simple Chat

```
You: Explain what this regex does: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

OpenBotMan: This is an email validation regex. Let me break it down...
```

### Task Orchestration

```
You: Implement a REST API for user management with CRUD operations

OpenBotMan: I'll coordinate the team for this task...

[Orchestrator] Delegating to claude_code (architect role)...
[AICP] @ORCH>ARCH:TASK:design_api:P2
[Architect] Designing REST API structure...

[Orchestrator] Delegating to claude_code (coder role)...
[AICP] @ORCH>CODE:TASK:impl_api:P2
[Coder] Implementing endpoints...

[Orchestrator] Delegating to gemini_review (reviewer role)...
[AICP] @ORCH>REV:TASK:review_api:P2
[Reviewer] Reviewing implementation...

OpenBotMan: ✅ Task complete! Here's the implementation:
[Shows code with review feedback incorporated]
```

### Running Workflows

```
You: Run the code_review workflow on auth.ts

OpenBotMan: Starting code_review workflow...

Step 1: Analyze Code
[Coder] Analyzing code structure...

Step 2: Security Review
[Reviewer] Checking for security issues...

Step 3: Generate Tests
[Tester] Creating test cases...

✅ Workflow complete!
[Shows comprehensive review with tests]
```

### Agent Discussion

```
You: Start a discussion: Should we use JWT or session-based auth?

OpenBotMan: Starting discussion with 3 agents...

--- Round 1 ---
@ARCH [support JWT]: "JWT is stateless, scales better..."
@SEC [oppose]: "Session-based is more secure for sensitive apps..."
@CODE [neutral]: "Depends on use case. What's the priority?"

--- Round 2 ---
@ARCH: "Good point. For a SaaS, I'd still prefer JWT with short expiry"
@SEC: "If we add token refresh and blacklist, JWT is acceptable"
@CODE: "I can implement either. JWT is simpler."

--- Voting ---
@ARCH: JWT
@SEC: JWT (with security measures)
@CODE: JWT

✅ Consensus reached: JWT with short expiry and refresh tokens
```

---

## IDE Integration

### VS Code Extension

1. Install from VS Code:
   - Open Extensions (Ctrl+Shift+X)
   - Search "OpenBotMan"
   - Click Install

2. Configure:
   ```json
   // settings.json
   {
     "openbotman.apiUrl": "http://localhost:8080",
     "openbotman.apiKey": "your-api-key"
   }
   ```

3. Use:
   - `Ctrl+Shift+P` → "OpenBotMan: Chat"
   - Right-click code → "OpenBotMan: Review"
   - View panel → Agents, Tasks, Knowledge

### MCP Integration (Claude Desktop, etc.)

Add to your MCP config:

```json
{
  "mcpServers": {
    "openbotman": {
      "command": "npx",
      "args": ["@openbotman/mcp-server"]
    }
  }
}
```

Then use in Claude:
```
Use the orchestrate tool to implement user authentication
```

---

## Next Steps

### 1. Explore Workflows

Check out the predefined workflows:
```bash
openbotman workflows
```

### 2. Build Your Knowledge Base

Store learnings for future use:
```
You: Add to knowledge: OAuth2 PKCE flow is required for mobile apps

OpenBotMan: ✅ Knowledge added: "OAuth2 PKCE flow is required..."
```

### 3. Customize Agents

Create specialized agents:
- Security expert
- Performance optimizer
- Documentation writer
- DevOps specialist

### 4. Connect Channels

Enable chat through:
- Microsoft Teams
- Telegram
- Discord
- Slack

See [Configuration Guide](configuration.md) for details.

### 5. Deploy to Production

```bash
# Docker Compose for full stack
docker-compose up -d
```

See [Deployment Guide](deployment.md) for production setup.

---

## Troubleshooting

### "Agent not responding"
- Check API key is valid
- Verify agent is enabled in config
- Check network connectivity

### "Rate limit exceeded"
- Wait a few minutes
- Consider using local Ollama for quick queries
- Enable multiple providers for load balancing

### "Unknown tool"
- Update to latest version
- Check MCP server is running

### Need Help?

- [Documentation](https://docs.openbotman.dev)
- [GitHub Issues](https://github.com/vbdata-source/OpenBotMan/issues)
- [Discord Community](https://discord.gg/openbotman)

---

**Happy orchestrating!** 🤖🎉
