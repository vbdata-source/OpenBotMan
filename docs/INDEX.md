# OpenBotMan Documentation Index

Complete documentation for OpenBotMan Multi-Agent Orchestrator.

---

## 📚 Documentation Overview

### For New Users

1. **[README.md](../README.md)** ⭐ START HERE
   - What is OpenBotMan?
   - Features overview
   - Quick start guide
   - Installation instructions

2. **[QUICKSTART.md](../QUICKSTART.md)** ⚡ 5-MINUTE SETUP
   - Step-by-step setup (5 minutes)
   - First test run
   - Common issues & solutions
   - Next steps

### For Developers

3. **[CLAUDE.md](../CLAUDE.md)** 🤖 FOR CLAUDE CODE
   - Complete project overview
   - Architecture explanation
   - Key concepts
   - Development tasks
   - Code conventions
   - Quick reference

4. **[DEVELOPMENT.md](../DEVELOPMENT.md)** 🔧 DEVELOPER GUIDE
   - Architecture deep dive
   - Code walkthrough
   - Extension patterns
   - Advanced workflows
   - Debugging guide
   - Performance optimization
   - Production deployment

5. **[AGENTS.md](../AGENTS.md)** 📋 DEVELOPMENT GUIDELINES
   - Core principles
   - Code style guidelines
   - Anti-patterns
   - Testing guidelines
   - Git workflow
   - Integration guidelines
   - Common mistakes

6. **[ARCHITECTURE.md](../ARCHITECTURE.md)** 🏗️ SYSTEM ARCHITECTURE
   - Visual architecture diagrams
   - Data flow diagrams
   - Component interactions
   - Session management
   - Configuration architecture
   - Security architecture
   - Testing architecture

### Examples & Tutorials

7. **[examples/](../examples/)** 💡 CODE EXAMPLES
   - `simple_task.py` - Basic agent delegation
   - `workflow_example.py` - Workflow execution
   - `consensus_example.py` - Consensus building

---

## 📖 Documentation by Topic

### Getting Started
- [Installation](../README.md#installation)
- [Quick Start](../QUICKSTART.md)
- [First Steps](../QUICKSTART.md#test-run)

### Core Concepts
- [Architecture Overview](../CLAUDE.md#architecture)
- [Orchestrator Pattern](../DEVELOPMENT.md#the-orchestrator-agent-pattern)
- [CLI Subprocess Pattern](../CLAUDE.md#key-concepts)
- [Tool Use Flow](../ARCHITECTURE.md#tool-use-flow)

### Configuration
- [Agent Configuration](../CLAUDE.md#agent-configuration)
- [Workflow Configuration](../CLAUDE.md#workflow-configuration)
- [Environment Variables](../.env.example)

### Development
- [Adding New Agents](../CLAUDE.md#adding-a-new-cli-agent)
- [Creating Workflows](../CLAUDE.md#creating-a-new-workflow)
- [Extension Patterns](../DEVELOPMENT.md#extension-patterns)
- [Testing](../DEVELOPMENT.md#testing-strategy)

### Integration
- [With Antigravity](../CLAUDE.md#integration-patterns)
- [REST API](../api_server.py)
- [Direct Python Import](../DEVELOPMENT.md#integration-patterns)

### Advanced Topics
- [Advanced Workflows](../DEVELOPMENT.md#advanced-workflows)
- [Performance Optimization](../DEVELOPMENT.md#performance-optimization)
- [Production Deployment](../DEVELOPMENT.md#production-deployment)
- [Security](../ARCHITECTURE.md#security-architecture)

### Troubleshooting
- [Common Issues](../QUICKSTART.md#common-issues)
- [Debugging Guide](../DEVELOPMENT.md#debugging-guide)
- [Common Mistakes](../AGENTS.md#common-mistakes--solutions)

---

## 🎯 Quick Links by Task

### I want to...

**...get started quickly**
→ [QUICKSTART.md](../QUICKSTART.md)

**...understand the architecture**
→ [ARCHITECTURE.md](../ARCHITECTURE.md)

**...add a new CLI agent**
→ [CLAUDE.md - Adding New Agent](../CLAUDE.md#adding-a-new-cli-agent)

**...create a custom workflow**
→ [CLAUDE.md - Creating Workflow](../CLAUDE.md#creating-a-new-workflow)

**...integrate with Antigravity**
→ [CLAUDE.md - Integration](../CLAUDE.md#integration-patterns)

**...debug an issue**
→ [DEVELOPMENT.md - Debugging](../DEVELOPMENT.md#debugging-guide)

**...deploy to production**
→ [DEVELOPMENT.md - Deployment](../DEVELOPMENT.md#production-deployment)

**...contribute code**
→ [AGENTS.md](../AGENTS.md)

---

## 📝 Documentation Map

```
OpenBotMan/
│
├── 📄 README.md              Main documentation & overview
├── ⚡ QUICKSTART.md          5-minute setup guide
│
├── For Claude Code:
│   ├── 🤖 CLAUDE.md          Project overview & reference
│   ├── 🔧 DEVELOPMENT.md     Deep dive & advanced topics
│   ├── 📋 AGENTS.md          Development guidelines
│   └── 🏗️ ARCHITECTURE.md   System architecture
│
├── Examples:
│   └── examples/             Code examples & tutorials
│
└── Reference:
    ├── config.example.yaml   Configuration reference
    ├── .env.example          Environment variables
    └── requirements.txt      Dependencies
```

---

## 🔍 Search by Keyword

### Architecture
- [Architecture Overview](../CLAUDE.md#architecture)
- [System Diagrams](../ARCHITECTURE.md)
- [Component Interactions](../ARCHITECTURE.md#component-interactions)

### CLI
- [CLI Subprocess Pattern](../CLAUDE.md#cli-as-subprocess-pattern)
- [CLI Runner Code](../src/cli_runners.py)
- [Adding CLI Agent](../CLAUDE.md#adding-a-new-cli-agent)

### Tools
- [Tool Use Pattern](../CLAUDE.md#the-orchestrator-pattern)
- [Tool Definitions](../src/tools.py)
- [Adding New Tool](../DEVELOPMENT.md#pattern-1-adding-a-new-tool)

### Workflows
- [Workflow Concept](../CLAUDE.md#workflows--predefined-agent-sequences)
- [Workflow Configuration](../CLAUDE.md#workflow-configuration)
- [Advanced Workflows](../DEVELOPMENT.md#advanced-workflows)

### Session Management
- [Session Lifecycle](../ARCHITECTURE.md#session-lifecycle)
- [Multi-Agent Sessions](../ARCHITECTURE.md#multi-agent-sessions)

### Configuration
- [Config Structure](../CLAUDE.md#configuration-configyaml)
- [Environment Setup](../.env.example)
- [Agent Config](../CLAUDE.md#agent-configuration)

### Testing
- [Testing Strategy](../DEVELOPMENT.md#testing-strategy)
- [Unit Tests](../tests/)
- [Examples](../examples/)

### Integration
- [Antigravity Integration](../CLAUDE.md#with-antigravity-direct-python)
- [REST API](../api_server.py)
- [Direct Import](../CLAUDE.md#integration-patterns)

---

## 💬 Getting Help

1. **Check documentation** - Most questions answered here
2. **Run examples** - See working code
3. **Check logs** - Enable verbose mode
4. **Read error messages** - They're designed to be helpful

---

## 🔄 Documentation Updates

This documentation is living and evolving. When making changes:

1. **Update relevant .md files**
2. **Add examples if new pattern**
3. **Update this index**
4. **Keep docs in sync**

---

## 📚 External Resources

- **Anthropic Tool Use**: https://docs.anthropic.com/claude/docs/tool-use
- **Python Subprocess**: https://docs.python.org/3/library/subprocess.html
- **FastAPI**: https://fastapi.tiangolo.com/
- **YAML**: https://yaml.org/spec/

---

Last updated: 2026-02-02
