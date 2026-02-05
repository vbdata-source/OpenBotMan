# OpenBotMan Provider Guide

> **Stand:** 2026-02-05

OpenBotMan unterstützt mehrere LLM-Provider für maximale Flexibilität.

---

## Übersicht

| Provider | Beschreibung | Auth | Kosten |
|----------|--------------|------|--------|
| `claude-cli` | Claude Code CLI | Pro/Max Abo | Inklusive im Abo |
| `claude-api` | Anthropic SDK direkt | API Key | Per Token |
| `openai` | OpenAI API | API Key | Per Token |
| `google` | Google Gemini API | API Key | Per Token |
| `ollama` | Lokale LLMs | Keine | Kostenlos |
| `mock` | Test-Provider | Keine | Kostenlos |

---

## Claude CLI (`claude-cli`)

Verwendet die [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) als Subprocess.

### Wann verwenden?
- ✅ Lokale Entwicklung
- ✅ Du hast Claude Pro/Max
- ✅ Interaktive Sessions möglich

### Setup

```bash
# 1. Claude CLI installieren
npm install -g @anthropic-ai/claude-cli

# 2. Einloggen (öffnet Browser)
claude auth login

# oder mit Token
claude setup-token
```

### Config

```yaml
discussion:
  agents:
    - id: my_agent
      provider: claude-cli
      model: claude-sonnet-4-20250514
```

### Besonderheiten
- Nutzt dein Pro/Max Abo (keine zusätzlichen Kosten)
- Rate-Limits sind großzügiger als API
- Braucht CLI-Installation und Browser-Auth

---

## Claude API (`claude-api`)

Verwendet das [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-js) direkt.

### Wann verwenden?
- ✅ Server ohne GUI
- ✅ Docker/Container
- ✅ CI/CD Pipelines
- ✅ Production Deployments

### Setup

```bash
# API Key von https://console.anthropic.com/
export ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### Config

```yaml
discussion:
  agents:
    - id: my_agent
      provider: claude-api
      model: claude-sonnet-4-20250514
      apiKey: ${ANTHROPIC_API_KEY}
```

### Kosten (Stand 2025)

| Model | Input | Output |
|-------|-------|--------|
| Claude Opus | $15/1M tokens | $75/1M tokens |
| Claude Sonnet | $3/1M tokens | $15/1M tokens |
| Claude Haiku | $0.25/1M tokens | $1.25/1M tokens |

### Besonderheiten
- Keine CLI-Installation nötig
- Funktioniert überall mit Internet
- Kosten pro Token (kann teuer werden bei viel Nutzung)

---

## OpenAI (`openai`)

Verwendet die [OpenAI API](https://platform.openai.com/).

### Setup

```bash
export OPENAI_API_KEY=sk-xxxxx
```

### Config

```yaml
discussion:
  agents:
    - id: my_agent
      provider: openai
      model: gpt-4-turbo
      apiKey: ${OPENAI_API_KEY}
```

### Unterstützte Modelle
- `gpt-4-turbo`
- `gpt-4`
- `gpt-3.5-turbo`

---

## Google Gemini (`google`)

Verwendet die [Google Generative AI API](https://ai.google.dev/).

### Setup

```bash
export GOOGLE_API_KEY=xxxxx
```

### Config

```yaml
discussion:
  agents:
    - id: my_agent
      provider: google
      model: gemini-2.0-flash
      apiKey: ${GOOGLE_API_KEY}
```

### Unterstützte Modelle
- `gemini-2.0-flash`
- `gemini-1.5-pro`
- `gemini-1.5-flash`

---

## Ollama (`ollama`)

Verwendet lokale LLMs über [Ollama](https://ollama.ai/).

### Setup

```bash
# Ollama installieren
curl -fsSL https://ollama.ai/install.sh | sh

# Model herunterladen
ollama pull codellama:13b
```

### Config

```yaml
agents:
  - id: local_llm
    provider: ollama
    model: codellama:13b
    api:
      baseUrl: http://localhost:11434
```

### Besonderheiten
- Komplett kostenlos
- Läuft offline
- Braucht GPU für gute Performance

---

## Mock Provider (`mock`)

Für Tests und Entwicklung.

### Config

```yaml
discussion:
  agents:
    - id: test_agent
      provider: mock
      model: mock-model
```

---

## Multi-Provider Setup

Du kannst verschiedene Provider für verschiedene Agents verwenden:

```yaml
discussion:
  agents:
    # Claude für Architektur (beste Qualität)
    - id: planner
      provider: claude-cli
      model: claude-sonnet-4-20250514
    
    # Gemini für Reviews (schnell & günstig)
    - id: reviewer
      provider: google
      model: gemini-2.0-flash
      apiKey: ${GOOGLE_API_KEY}
    
    # Lokales LLM für schnelle Iterationen
    - id: assistant
      provider: ollama
      model: codellama:13b
```

---

## Deployment-Szenarien

### Szenario 1: Lokale Entwicklung

```yaml
# Alle Agents nutzen Claude CLI (dein Pro Abo)
discussion:
  agents:
    - id: planner
      provider: claude-cli
    - id: coder
      provider: claude-cli
    - id: reviewer
      provider: claude-cli
```

### Szenario 2: Cloud Server

```yaml
# Alle Agents nutzen Claude API
discussion:
  agents:
    - id: planner
      provider: claude-api
      apiKey: ${ANTHROPIC_API_KEY}
    - id: coder
      provider: claude-api
      apiKey: ${ANTHROPIC_API_KEY}
    - id: reviewer
      provider: claude-api
      apiKey: ${ANTHROPIC_API_KEY}
```

### Szenario 3: Hybrid (Kosten-optimiert)

```yaml
# Claude API für wichtige Agents, Gemini für schnelle Reviews
discussion:
  agents:
    - id: planner
      provider: claude-api
      apiKey: ${ANTHROPIC_API_KEY}
    - id: coder
      provider: claude-api
      apiKey: ${ANTHROPIC_API_KEY}
    - id: reviewer
      provider: google  # Günstiger für Reviews
      apiKey: ${GOOGLE_API_KEY}
```

---

## Troubleshooting

### "Invalid API key"
- Prüfe ob der Key korrekt gesetzt ist: `echo $ANTHROPIC_API_KEY`
- Bei `claude-cli`: `claude auth status`

### "Provider not found"
- Prüfe die Schreibweise: `claude-cli`, `claude-api`, `openai`, `google`

### "Rate limit exceeded"
- Erhöhe `rateLimitDelayMs` in der Config
- Wechsle zu einem anderen Provider

### "Model not found"
- Prüfe den Model-Namen in der Provider-Dokumentation
- Claude: `claude-sonnet-4-20250514`, nicht `claude-3-sonnet`

---

## Provider Abstraction

OpenBotMan nutzt ein Provider-Interface für alle LLMs:

```typescript
interface LLMProvider {
  send(prompt: string, options?: ProviderOptions): Promise<ProviderResponse>;
  isAvailable(): Promise<boolean>;
  getName(): string;
  getModel(): string;
}
```

Das ermöglicht:
- Einfaches Wechseln zwischen Providern
- Fallback-Strategien
- Multi-Provider Diskussionen
- Einheitliches Error-Handling

---

*Erstellt von AJBot am 2026-02-05*
