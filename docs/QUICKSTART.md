# 🚀 OpenBotMan Quick Start

## 1. Setup (5 minutes)

```bash
# Navigate to project
cd C:\Sources\OpenBotMan

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## 2. Configuration

```bash
# Copy example config
copy config.example.yaml config.yaml

# Copy example env
copy .env.example .env

# Edit .env and add your API key
notepad .env
# Set: ANTHROPIC_API_KEY=your_key_here

# Edit config.yaml if needed
notepad config.yaml
```

## 3. Verify CLI Tools

Make sure you have the required CLIs installed:

```bash
# Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Verify
claude --version

# Optional: Gemini CLI (if you want to use it)
# Install according to Google's instructions

# Optional: GPT-4 CLI (if you want to use it)
# pip install openai-cli
```

## 4. Test Run

```bash
# Interactive mode
python orchestrator.py

# Try a simple request
You: Implement a hello world function in Python

# The orchestrator will coordinate agents to fulfill your request
```

## 5. Try Examples

```bash
# Simple task
python examples/simple_task.py

# Workflow
python examples/workflow_example.py

# Consensus
python examples/consensus_example.py
```

## 6. API Server (Optional)

```bash
# Start API server
python api_server.py

# In another terminal, test it
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"test\", \"message\": \"Hello\"}"

# View API docs
# Open browser: http://localhost:8000/docs
```

## Common Issues

### "Config file not found"
```bash
cp config.example.yaml config.yaml
```

### "ANTHROPIC_API_KEY not found"
```bash
cp .env.example .env
# Edit .env and add your key
```

### "CLI failed"
- Check that the CLI is installed: `claude --version`
- Check that the CLI binary name matches config.yaml
- Try running the CLI manually first

### "Agent timeout"
- Increase timeout in config.yaml under `behavior.cli_timeout`
- Or reduce task complexity

## Next Steps

1. Read [README.md](README.md) for full documentation
2. Explore [examples/](examples/) for more use cases
3. Customize workflows in `config.yaml`
4. Integrate with Antigravity (see README)

## Need Help?

- Check logs in `logs/` directory
- Enable verbose mode in config.yaml: `behavior.verbose: true`
- Open an issue on GitHub
