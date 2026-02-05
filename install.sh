#!/bin/bash
echo "============================================"
echo "  OpenBotMan Installation Script (Unix)"
echo "============================================"
echo ""

# Check Node.js
echo "[1/5] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found!"
    echo "Please install Node.js v20+ from https://nodejs.org"
    exit 1
fi
NODE_VER=$(node --version)
echo "      Found Node.js $NODE_VER"

# Check/Install pnpm
echo "[2/5] Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "      Installing pnpm..."
    npm install -g pnpm
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install pnpm"
        exit 1
    fi
fi
PNPM_VER=$(pnpm --version)
echo "      Found pnpm $PNPM_VER"

# Install dependencies
echo "[3/5] Installing dependencies..."
pnpm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi
echo "      Dependencies installed"

# Build
echo "[4/5] Building project..."
pnpm build
if [ $? -ne 0 ]; then
    echo "ERROR: Build failed"
    exit 1
fi
echo "      Build complete"

# Check Claude CLI
echo "[5/5] Checking Claude CLI..."
if ! command -v claude &> /dev/null; then
    echo ""
    echo "WARNING: Claude CLI not found!"
    echo "To use OpenBotMan with Claude, install Claude CLI:"
    echo "  npm install -g @anthropic-ai/claude-code"
    echo "  OR download from https://claude.ai/download"
    echo "Then run: claude setup-token"
    echo ""
else
    CLAUDE_VER=$(claude --version 2>/dev/null | head -1)
    echo "      Found Claude CLI"
fi

echo ""
echo "============================================"
echo "  Installation Complete!"
echo "============================================"
echo ""
echo "To start a discussion:"
echo "  pnpm cli discuss \"Your topic\" --agents 3 --max-rounds 4"
echo ""
echo "For help:"
echo "  pnpm cli discuss --help"
echo ""
