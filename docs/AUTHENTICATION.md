# OpenBotMan Authentication Guide

OpenBotMan supports multiple authentication methods for Claude API access.

## Authentication Methods

### 1. API Key (Traditional)

Set the `ANTHROPIC_API_KEY` environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

This is the standard approach that works with any Anthropic API key.

### 2. Setup Token (Claude Pro Subscription)

If you have a Claude Pro subscription, you can use your subscription for API access instead of purchasing separate API credits.

#### How to get a Setup Token

1. Install Claude Code CLI:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. Generate a setup token:
   ```bash
   claude setup-token
   ```

3. Copy the generated token (starts with `sk-ant-oat01-`)

#### Using Setup Token with OpenBotMan

**Option A: Import via CLI**
```bash
openbotman auth setup-token
# Follow the prompts to paste your token
```

**Option B: Environment Variable**
```bash
export CLAUDE_SETUP_TOKEN=sk-ant-oat01-xxxxx
```

**Option C: Via ANTHROPIC_API_KEY**
```bash
# Setup tokens are auto-detected when used in ANTHROPIC_API_KEY
export ANTHROPIC_API_KEY=sk-ant-oat01-xxxxx
```

## Auth Commands

### Check Status
```bash
openbotman auth status
```

Shows:
- Current authentication method
- Active profile (if any)
- Token preview (masked)
- Expiration (if known)

### List Profiles
```bash
openbotman auth list
```

Lists all saved authentication profiles.

### Import Setup Token
```bash
# Interactive
openbotman auth setup-token

# Non-interactive
openbotman auth setup-token --token sk-ant-oat01-xxxxx --name my-profile --yes
```

### Set Default Profile
```bash
openbotman auth default my-profile
```

### Remove Profile
```bash
openbotman auth remove my-profile
```

## Authentication Priority

OpenBotMan checks for credentials in this order:

1. **Saved setup-token profiles** (if `preferSetupToken` is true, which is default)
2. **CLAUDE_SETUP_TOKEN** environment variable
3. **ANTHROPIC_API_KEY** environment variable
4. **Claude CLI credentials** (~/.claude/.credentials.json)
5. **Fallback to setup-token profiles** (if `preferSetupToken` is false)

## Programmatic Usage

```typescript
import { ClaudeAuthProvider, createAuthProvider } from '@openbotman/orchestrator';

// Create auth provider
const auth = createAuthProvider({
  storagePath: '~/.openbotman',  // Optional: custom storage path
  preferSetupToken: true,         // Optional: prefer setup-token over API key
});

// Check status
const status = auth.getStatus();
console.log(status.authenticated);  // true/false
console.log(status.method);          // 'api_key' | 'setup_token' | 'oauth'

// Get API key/token for direct use
const apiKey = auth.getApiKey();

// Create Anthropic client directly
const client = auth.createClient();

// Import setup token programmatically
auth.importSetupToken('sk-ant-oat01-xxxxx', 'my-profile');

// List profiles
const profiles = auth.listProfiles();
```

## Security Notes

- Setup tokens are stored locally in `~/.openbotman/auth-profiles.json`
- Tokens are never logged or displayed in full
- Token previews show only first 8 and last 4 characters
- Use separate profiles for different projects/environments

## Troubleshooting

### "No authentication method available"
- Check if `ANTHROPIC_API_KEY` is set
- Run `openbotman auth setup-token` to import a token
- Verify token format (API keys start with `sk-ant-api`, setup tokens with `sk-ant-oat01-`)

### Token Expired
- Setup tokens from Claude CLI may expire
- Re-run `claude setup-token` to generate a new one
- Import the new token with `openbotman auth setup-token`

### Can't create Anthropic client
- Verify your token is valid
- Check for network connectivity
- Ensure you have an active Claude subscription (for setup tokens)

## Token Formats

| Type | Prefix | Description |
|------|--------|-------------|
| API Key | `sk-ant-api03-` | Traditional API key |
| Setup Token | `sk-ant-oat01-` | Claude Code CLI token (Pro subscription) |
| OAuth Token | Varies | Browser-based OAuth (advanced) |
