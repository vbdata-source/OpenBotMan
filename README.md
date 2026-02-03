# 🤖 OpenBotMan v2.0

<div align="center">

![OpenBotMan Logo](docs/assets/logo.png)

**Multi-Agent Orchestration Platform**

*Autonomous AI Development Teams*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Architecture](#-architecture)

</div>

---

## 🎯 What is OpenBotMan?

OpenBotMan is an **autonomous multi-agent orchestration platform** that coordinates multiple AI models (Claude, GPT-4, Gemini, Ollama) to work together as a development team.

```
You: "Implement user authentication with OAuth2"

OpenBotMan: "I'll coordinate the team..."

┌─────────────────────────────────────────────────────┐
│  🏗️  ARCHITECT: "Designing OAuth2 flow with PKCE"   │
│  🔒 SECURITY:  "Adding rate limiting & OWASP"       │
│  💻 CODER:     "Implementing Passport.js..."        │
│  📋 TESTER:    "Writing 42 test cases..."           │
│  ✅ REVIEWER:  "LGTM! Code approved."               │
└─────────────────────────────────────────────────────┘

OpenBotMan: "Done! Auth system ready with 95% coverage."
```

## ✨ Features

### 🧠 Multi-LLM Orchestration
- **Claude** (Anthropic) - Architecture & coding
- **GPT-4** (OpenAI) - Testing & documentation
- **Gemini** (Google) - Review & research
- **Ollama** - Fast local queries (free!)

### 💬 Agent Communication Protocol (AICP)
- **Compact binary protocol** - 70% smaller than JSON
- **Shorthand notation** - `@ARCH>CODER:TASK:impl_auth:P1`
- **Human-readable on demand** - Full transparency

### 🧠 Shared Knowledge Base
- **Vector search** - Semantic knowledge retrieval
- **Auto-learning** - Extracts learnings from tasks
- **Cross-agent memory** - All agents share knowledge

### 🔐 Security First
- **OAuth2/JWT** authentication
- **RBAC** - Role-based access control
- **Audit logging** - Complete action history
- **Sandbox execution** - Isolated agent environments

### 📱 Multi-Channel Support
- **Microsoft Teams** - Full integration
- **Telegram** - Bot API
- **Discord** - Slash commands
- **Slack** - Bolt SDK
- **REST API** - Universal access

### 🐳 Deployment Ready
- **Docker** - One-line deployment
- **Docker Compose** - Full stack
- **Kubernetes** - Helm charts
- **Cloud** - Railway, Coolify, Fly.io

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+
- API keys for at least one LLM

### Installation

```bash
# Clone
git clone https://github.com/vbdata-source/OpenBotMan.git
cd OpenBotMan

# Install
pnpm install

# Configure
cp config.example.yaml config.yaml
# Edit config.yaml with your API keys

# Run
pnpm start
```

### Docker (Recommended)

```bash
# Quick start
docker run -d -p 8080:8080 \
  -e ANTHROPIC_API_KEY=your_key \
  ghcr.io/vbdata-source/openbotman:latest

# Full stack
docker-compose up -d
```

### CLI Usage

```bash
# Interactive chat
openbotman chat

# Run a task
openbotman run "Create a REST API for users"

# Run a workflow
openbotman run --workflow code_review "Review my auth.ts"

# List agents
openbotman agents

# List workflows
openbotman workflows

# Run demo (mock multi-agent discussion)
openbotman demo discussion
openbotman demo discussion --topic "Sollen wir React oder Vue verwenden?"

# 🆕 REAL Multi-Agent Discussion (uses actual Claude CLI!)
openbotman discuss "Wie implementiere ich Caching für diese App?"

# With specific files for context
openbotman discuss "Review diese Implementierung" --files src/auth.ts,src/users.ts

# With fewer agents (faster)
openbotman discuss "Schnelle Frage zu Patterns" --agents 2
```

### 🎭 Demo: Multi-Agent Code Review

Watch AI agents analyze and review the OpenBotMan project itself:

```bash
openbotman demo discussion
```

This demonstrates:
- **Code Analysis** - Alice examines code quality and patterns
- **Test Review** - Bob evaluates test coverage and documentation
- **Architecture Review** - Charlie assesses design decisions
- **Discussion** - Agents discuss findings and improvements
- **Consensus** - Final quality rating is agreed upon

Output example:
```
🎭 Multi-Agent Code Review: OpenBotMan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project: OpenBotMan v2.0.0-alpha.1
Packages: 8 | Tests: 408 | Source Files: 42
Reviewers: Alice (Coder), Bob (Reviewer), Charlie (Architect)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Alice] 🔍 ANALYSIS: Die Monorepo-Struktur ist sauber...
[Bob] 📋 REVIEW: 408 Tests - beeindruckend für Alpha!
[Charlie] 🔍 ANALYSIS: Event-driven Design ist gut...

📊 Voting: Gesamtbewertung des Projekts...
[Alice] ✅ VOTE [Rating: B+]: Solide Basis...
[Bob] ✅ VOTE [Rating: B+]: Test-Abdeckung beeindruckend...
[Charlie] ✅ VOTE [Rating: B+]: Architektur erweiterbar...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 CONSENSUS REACHED: Project Rating B+ (Gut)
   (3/3 reviewers agree)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The demo showcases how agents can collaboratively review code, discuss quality issues, and reach consensus - demonstrating OpenBotMan's multi-agent discussion capabilities.

Options:
- `--delay 2000` - Slower animation (2 seconds between messages)
- `--no-animation` - Instant output (for CI/testing)

### 🆕 Real Multi-Agent Discussions with Consensus

Unlike the demo, the `discuss` command runs **real multi-agent discussions with iterative consensus-finding**:

```bash
# Start a consensus discussion
openbotman discuss "Wie sollen wir das Caching implementieren?"

# Include specific files for context
openbotman discuss "Review diese Files" --files src/api.ts,src/db.ts

# Limit consensus rounds
openbotman discuss "API Design" --max-rounds 5

# Custom output directory
openbotman discuss "Feature Planning" --output ./decisions/

# Mix providers (requires API keys)
openbotman discuss "Architecture Review" \
  --planner gemini \
  --coder claude-cli \
  --reviewer openai
```

**Consensus Protocol:**

Each agent must end their response with a position:
- `[POSITION: SUPPORT]` - Full agreement
- `[POSITION: SUPPORT_WITH_CONDITIONS]` - Agree with conditions
- `[POSITION: CONCERN]` - Has concerns but no veto
- `[POSITION: OBJECTION]` - Blocks consensus, requires revision

**Consensus is reached when:**
- All agents vote SUPPORT or SUPPORT_WITH_CONDITIONS
- No OBJECTION votes
- CONCERN counts as "proceed but note"

**Example Output:**
```
🔄 Round 1/10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)
──────────────────────────────────────────────────────────
  Ich schlage vor, Redis für Caching zu verwenden...
  💡 Position: PROPOSAL

[Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)
──────────────────────────────────────────────────────────
  Der Ansatz ist solide. Bedenken bei Memory-Limits...
  ⚠️ Position: CONCERN - Memory-Limits definieren

[Reviewer] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)
──────────────────────────────────────────────────────────
  Sicherheitsbedenken bei der Cache-Invalidierung...
  🚫 Position: OBJECTION - Security-Risiko

📊 Status: 1 CONCERN, 1 OBJECTION → No consensus

🔄 Round 2/10 ...

✅ KONSENS ERREICHT!
📝 Discussion saved to: discussions/2026-02-03_17-30_caching-implementieren.md
```

**Markdown Export:**

Every discussion is automatically saved as Markdown:
```markdown
# Discussion: Wie sollen wir das Caching implementieren?
Date: 2026-02-03 17:30
Participants: Planner (claude-sonnet), Coder (claude-sonnet), Reviewer (gpt-4)
Rounds: 3
Status: ✅ CONSENSUS REACHED

## Round 1
### [Planner] 🎯 ARCHITECT (claude-sonnet-4-20250514 via CLI)
[Content...]
**Position:** 💡 PROPOSAL
...

## Final Consensus
[Summary of final solution]

## Action Items
- [ ] Task 1 (assigned: Coder)
- [ ] Task 2 (assigned: Reviewer)

## Conditions & Concerns
- Memory limits must be defined
- Cache TTL strategy needed
```

**Multi-Provider Support:**

Mix different LLM providers per agent in `config.yaml`:
```yaml
discussion:
  agents:
    - id: planner
      provider: google        # Gemini API
      model: gemini-2.0-flash
      apiKey: ${GOOGLE_API_KEY}
    - id: coder
      provider: claude-cli    # Claude CLI (Pro subscription)
      model: claude-sonnet-4-20250514
    - id: reviewer
      provider: openai        # OpenAI API
      model: gpt-4-turbo
      apiKey: ${OPENAI_API_KEY}
```

**Requirements:**
- Claude CLI installed and authenticated (`npm install -g @anthropic-ai/claude-cli && claude auth`)
- For non-Claude providers: Set API keys in environment or config

**Options:**
- `--files <list>` - Specific files to include (comma-separated)
- `--agents <1-3>` - Number of agents (default: 3)
- `--max-rounds <n>` - Maximum consensus rounds (default: 10)
- `--timeout <sec>` - Timeout per agent (default: 60s)
- `--model <model>` - Model for all agents (default: claude-sonnet-4-20250514)
- `--output <path>` - Output directory for markdown export
- `--planner <provider>` - Provider for planner (e.g., gemini, openai:gpt-4)
- `--coder <provider>` - Provider for coder
- `--reviewer <provider>` - Provider for reviewer
- `--verbose` - Show detailed output

## 📖 Documentation

- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [AICP Protocol](docs/protocol.md)
- [Security](docs/security.md)
- [API Reference](docs/api.md)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Human (PM/Dev)                        │
│              "Build feature X"                           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               ORCHESTRATOR (Claude Opus)                 │
│  • Coordinates agents                                   │
│  • Manages tasks & workflows                            │
│  • Maintains knowledge base                             │
└────────────────────────┬────────────────────────────────┘
                         │ AICP Protocol
          ┌──────────────┼──────────────┬──────────────┐
          │              │              │              │
          ▼              ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ ARCHITECT│  │  CODER   │  │ REVIEWER │  │  TESTER  │
    │ (Claude) │  │ (Claude) │  │ (Gemini) │  │  (GPT-4) │
    └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
         │             │             │             │
         └─────────────┴──────┬──────┴─────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│               SHARED KNOWLEDGE BASE                      │
│  • Vector DB (Qdrant/ChromaDB)                         │
│  • Document store (PostgreSQL)                          │
│  • Auto-learning & linking                              │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Configuration

```yaml
# config.yaml
orchestrator:
  model: claude-sonnet-4-20250514
  maxIterations: 10

agents:
  - id: claude_code
    role: coder
    provider: anthropic
    model: claude-sonnet-4-20250514
    enabled: true

  - id: gemini
    role: reviewer
    provider: google
    model: gemini-2.0-flash
    enabled: true

knowledgeBase:
  enabled: true
  autoLearn: true
  vectorDb: qdrant

channels:
  teams:
    enabled: true
    appId: ${TEAMS_APP_ID}
  telegram:
    enabled: true
    botToken: ${TELEGRAM_BOT_TOKEN}
```

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📜 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) - Claude API
- [OpenAI](https://openai.com) - GPT-4 API
- [Google](https://ai.google.dev) - Gemini API
- [Ollama](https://ollama.ai) - Local LLMs
- [OpenClaw](https://openclaw.ai) - Inspiration & architecture

---

<div align="center">

**Built with ❤️ by [vb-data e.U.](https://vb-data.at)**

*"The future of software development is autonomous AI teams."*

</div>
