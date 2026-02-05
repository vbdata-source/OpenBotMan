# @openbotman/api-server

HTTP REST API for OpenBotMan multi-agent discussions.

## Quick Start

```bash
# Set required environment variables
export OPENBOTMAN_API_KEYS=my-secret-key
export ANTHROPIC_API_KEY=sk-ant-xxxxx  # For claude-api provider

# Start server
pnpm start
```

## Endpoints

### `GET /health`

Health check endpoint. No authentication required.

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "version": "2.0.0-alpha.1",
  "uptime": 123,
  "providers": [
    { "name": "claude-api", "available": true }
  ]
}
```

### `POST /api/v1/discuss`

Start a multi-agent discussion. Requires API key.

```bash
curl -X POST http://localhost:8080/api/v1/discuss \
  -H "Authorization: Bearer my-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Sollen wir React oder Vue für unser Projekt verwenden?",
    "agents": 3,
    "maxRounds": 5
  }'
```

Request body:
```json
{
  "topic": "string (required)",
  "agents": 3,           // 1-5, default: 3
  "maxRounds": 5,        // 1-20, default: 5
  "timeout": 60,         // seconds per agent, default: 60
  "model": "string",     // optional, override default model
  "maxContext": 100      // KB, default: 100
}
```

Response:
```json
{
  "id": "uuid",
  "status": "complete",
  "consensus": true,
  "result": "## Analyse\n...",
  "actionItems": ["Item 1", "Item 2"],
  "rounds": 3,
  "durationMs": 15000
}
```

## Authentication

All endpoints except `/health` require an API key.

Pass the key via:
- `Authorization: Bearer <key>` header
- `X-API-Key: <key>` header

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENBOTMAN_API_KEYS` | ✅ | Comma-separated API keys |
| `ANTHROPIC_API_KEY` | For claude-api | Anthropic API key |
| `PORT` | No | Server port (default: 8080) |
| `HOST` | No | Server host (default: 0.0.0.0) |

### CLI Options

```bash
openbotman-api [options]

Options:
  --port <number>      Server port
  --host <string>      Server host
  --provider <name>    claude-cli, claude-api, openai, google
  --model <name>       Model name
  --help               Show help
```

## Providers

| Provider | Auth | Use Case |
|----------|------|----------|
| `claude-cli` | Claude Pro | Local development |
| `claude-api` | API Key | Server deployments |
| `openai` | API Key | Alternative |
| `google` | API Key | Alternative |

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build

ENV PORT=8080
ENV HOST=0.0.0.0
EXPOSE 8080

CMD ["node", "packages/api-server/dist/cli.js"]
```

```bash
docker run -d \
  -p 8080:8080 \
  -e OPENBOTMAN_API_KEYS=my-key \
  -e ANTHROPIC_API_KEY=sk-ant-xxx \
  openbotman-api --provider claude-api
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode (with hot reload)
cd packages/api-server
pnpm dev

# Build
pnpm build

# Start production
pnpm start
```
