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
```

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
