# Contributing to OpenBotMan

Thank you for your interest in contributing to OpenBotMan! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Style Guide](#style-guide)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- No harassment or discrimination
- Focus on constructive feedback
- Help others learn and grow

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Git
- An Anthropic API key (for running tests)

### Development Setup

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/OpenBotMan.git
cd OpenBotMan

# Install dependencies
pnpm install

# Copy config
cp config.example.yaml config.yaml
# Edit config.yaml with your API key

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Project Structure

```
openbotman/
├── packages/
│   ├── protocol/          # AICP protocol implementation
│   ├── knowledge-base/    # Vector DB + document store
│   ├── orchestrator/      # Main orchestration engine
│   ├── cli/               # Command-line interface
│   ├── mcp-server/        # MCP integration
│   ├── ide-vscode/        # VS Code extension
│   └── channels/          # Communication channels
│       ├── teams/
│       ├── telegram/
│       ├── discord/
│       └── slack/
├── docker/                # Docker configurations
├── docs/                  # Documentation
└── examples/              # Example projects
```

### Package Descriptions

| Package | Description |
|---------|-------------|
| `@openbotman/protocol` | AICP binary protocol for agent communication |
| `@openbotman/knowledge-base` | Shared knowledge storage with vector search |
| `@openbotman/orchestrator` | Main orchestration logic and agent coordination |
| `@openbotman/cli` | Command-line interface |
| `@openbotman/mcp-server` | Model Context Protocol server |
| `openbotman-vscode` | VS Code extension |
| `@openbotman/channel-*` | Channel integrations |

## Making Changes

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

Example: `feature/ollama-integration`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code restructuring
- `test` - Tests
- `chore` - Maintenance

Examples:
```
feat(orchestrator): add Ollama provider support
fix(protocol): correct message encoding for Unicode
docs(readme): update installation instructions
```

### Development Workflow

```bash
# Create a branch
git checkout -b feature/my-feature

# Make changes
# ...

# Run linting
pnpm lint

# Run tests
pnpm test

# Build
pnpm build

# Commit
git add .
git commit -m "feat(scope): description"

# Push
git push origin feature/my-feature
```

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @openbotman/orchestrator test

# Watch mode
pnpm test -- --watch

# Coverage
pnpm test -- --coverage
```

### Writing Tests

We use [Vitest](https://vitest.dev/) for testing:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeBase } from '../src/knowledge-base.js';

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;
  
  beforeEach(() => {
    kb = new KnowledgeBase({ storagePath: ':memory:' });
  });
  
  it('should add knowledge', async () => {
    const knowledge = await kb.add('learning', 'Test', 'Content');
    expect(knowledge.id).toBeDefined();
    expect(knowledge.title).toBe('Test');
  });
  
  it('should search knowledge', async () => {
    await kb.add('learning', 'OAuth2 Best Practices', 'Use PKCE...');
    const results = await kb.search({ query: 'OAuth' });
    expect(results.length).toBeGreaterThan(0);
  });
});
```

### Test Categories

1. **Unit Tests** - Test individual functions/classes
2. **Integration Tests** - Test package interactions
3. **E2E Tests** - Test full workflows

## Submitting Changes

### Pull Request Process

1. Update documentation if needed
2. Add/update tests
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Create Pull Request

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How did you test these changes?

## Checklist
- [ ] Tests pass
- [ ] Linting passes
- [ ] Documentation updated
- [ ] CHANGELOG updated
```

## Style Guide

### TypeScript

- Use strict mode
- Explicit types (no implicit any)
- Prefer `interface` over `type` for objects
- Use `const` over `let` when possible
- Document public APIs with JSDoc

```typescript
/**
 * Delegate a task to an agent.
 * 
 * @param agentId - The agent to delegate to
 * @param task - Task description
 * @returns The agent's response
 */
async delegateTask(agentId: string, task: string): Promise<AgentResponse> {
  // implementation
}
```

### File Structure

```typescript
// 1. Imports (external, then internal)
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';

import type { AgentConfig } from './types.js';
import { validateConfig } from './utils.js';

// 2. Types/Interfaces
interface Options {
  timeout?: number;
}

// 3. Constants
const DEFAULT_TIMEOUT = 30000;

// 4. Class/Functions
export class MyClass {
  // ...
}

// 5. Default export (if any)
export default MyClass;
```

### Naming Conventions

- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case.ts`
- Interfaces: `PascalCase` (no `I` prefix)

### Comments

```typescript
// Single-line comment for simple explanations

/*
 * Multi-line comment for
 * more complex explanations
 */

/**
 * JSDoc for public API documentation.
 * 
 * @param param - Parameter description
 * @returns Return value description
 */
```

## Questions?

- Open an issue for bugs/features
- Start a discussion for questions
- Join our Discord community

Thank you for contributing! 🙏
