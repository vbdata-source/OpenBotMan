# Agent-Gruppen Konzept

## Übersicht

Agent-Gruppen ermöglichen die flexible Zusammenstellung von Experten-Teams für verschiedene Aufgabentypen.

## Architektur

### Agent-Definition

```yaml
agents:
  # Einzelner Agent
  security_expert:
    name: "Security Expert"
    role: "Security-Spezialist"
    emoji: "🔒"
    systemPrompt: |
      Du bist ein erfahrener Security-Experte mit Fokus auf:
      - OWASP Top 10
      - Sichere Coding-Praktiken
      - Penetration Testing
    model: "claude-sonnet-4-20250514"
    provider: "claude-cli"
    
  performance_expert:
    name: "Performance Expert"
    role: "Performance-Spezialist"
    emoji: "⚡"
    systemPrompt: |
      Du bist ein Performance-Experte mit Fokus auf:
      - Algorithmen-Optimierung
      - Caching-Strategien
      - Profiling
    model: "claude-sonnet-4-20250514"
    provider: "claude-cli"
```

### Agent-Gruppen

```yaml
agentGroups:
  # Standard-Gruppe
  default:
    name: "Standard-Team"
    description: "Allgemeine Code-Analyse"
    agents:
      - analyst
      - architect
      - pragmatist
      
  # Security-fokussiert
  security_review:
    name: "Security-Team"
    description: "Sicherheits-Analyse und Penetration Testing"
    agents:
      - security_expert
      - architect
      - pragmatist
      
  # Performance-fokussiert
  performance_review:
    name: "Performance-Team"
    description: "Performance-Analyse und Optimierung"
    agents:
      - performance_expert
      - architect
      - pragmatist
      
  # Vollständige Analyse
  full_review:
    name: "Vollständiges Team"
    description: "Umfassende Analyse mit allen Experten"
    agents:
      - analyst
      - security_expert
      - performance_expert
      - architect
      - pragmatist
```

## VSCode Integration

### Setting für Standard-Gruppe

```json
{
  "openbotman.defaultAgentGroup": "default"
}
```

### Auswahl bei Befehlsausführung

Bei "Experten fragen" oder "Projekt analysieren":

```
Welche Experten-Gruppe soll verwendet werden?

> 🔍 Standard-Team (Analyst, Architect, Pragmatist)
  🔒 Security-Team (Security Expert, Architect, Pragmatist)
  ⚡ Performance-Team (Performance Expert, Architect, Pragmatist)
  📊 Vollständiges Team (5 Experten)
  ⚙️ Eigene Auswahl...
```

## API Erweiterung

### Neue Endpoints

```
GET /api/v1/agents
GET /api/v1/agent-groups
POST /api/v1/discuss
  { 
    "topic": "...",
    "agentGroup": "security_review"  // NEU
    // oder
    "agents": ["security_expert", "architect"]  // Explizite Auswahl
  }
```

### Job Response (erweitert)

```json
{
  "id": "job-123",
  "agents": [
    {
      "name": "Security Expert",
      "role": "Security-Spezialist",
      "model": "claude-sonnet-4-20250514",  // NEU
      "provider": "claude-cli",              // NEU
      "status": "complete",
      "tokensUsed": 2500,                    // NEU
      "estimatedCost": 0.0075                // NEU (USD)
    }
  ]
}
```

## Kosten-Tracking

### Token-Zählung

```typescript
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

interface AgentResult {
  name: string;
  model: string;
  usage: TokenUsage;
  response: string;
}
```

### Kosten-Kalkulation

| Model | Input ($/1M) | Output ($/1M) |
|-------|--------------|---------------|
| claude-opus-4 | $15 | $75 |
| claude-sonnet-4 | $3 | $15 |
| claude-haiku | $0.25 | $1.25 |
| gpt-4 | $30 | $60 |

### Ausgabe in VSCode

```
============================================================
🔍 Code Review - server.ts
============================================================

✅ Security Expert (claude-sonnet-4) - 2.5k tokens, ~$0.01
────────────────────────────────────────
[Analyse...]

✅ Architect (claude-sonnet-4) - 3.1k tokens, ~$0.01
────────────────────────────────────────
[Analyse...]

────────────────────────────────────────
📊 Gesamt: 8.2k tokens, ~$0.03, 45s
```

## Implementierungs-Phasen

### Phase 1: Model-Transparenz (sofort)
- [x] Model in Agent-Output anzeigen
- [ ] Token-Zählung (wenn Provider unterstützt)
- [ ] Kosten-Schätzung

### Phase 2: Agent-Konfiguration
- [ ] agents.yaml Datei-Format
- [ ] Agent-Gruppen Definition
- [ ] API Endpoints für Agents/Groups

### Phase 3: VSCode Integration
- [ ] Gruppen-Auswahl bei Befehlen
- [ ] Setting für Default-Gruppe
- [ ] Kosten-Anzeige in Output

### Phase 4: Web-UI
- [ ] Agent-Editor
- [ ] Gruppen-Verwaltung
- [ ] Kosten-Dashboard
- [ ] Token-Budget-Limits

## Beispiel: Eigenen Agent erstellen

```yaml
# config/agents.yaml

agents:
  mein_experte:
    name: "Mein Domain-Experte"
    role: "Experte für Finanz-Software"
    emoji: "💰"
    systemPrompt: |
      Du bist ein Experte für Finanz-Software mit Fokus auf:
      - Regulatorische Compliance (MiFID II, PSD2)
      - Transaktions-Sicherheit
      - Audit-Logging
      Analysiere Code immer unter diesen Aspekten.
    model: "claude-sonnet-4-20250514"
    provider: "claude-cli"
```

Dann in Gruppe einbinden:

```yaml
agentGroups:
  finanz_review:
    name: "Finanz-Team"
    agents:
      - mein_experte
      - security_expert
      - pragmatist
```
