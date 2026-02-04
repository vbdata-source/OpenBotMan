# OpenBotMan Implementation Roadmap

> **Erstellt:** 2026-02-04
> **Basiert auf:** Multi-Agent Diskussionen vom 2026-02-04
> **Autor:** AJBot + Juergen

---

## 🎯 Vision & Motto

**"Einfachheit kombiniert mit absoluter Leistung und Bedienerfreundlichkeit"**

---

## 📋 Implementierungs-Übersicht

### Phase 1: Core Stability (Woche 1-2)
Fokus: Rate-Limiting & Error-Handling

### Phase 2: Web-UI Foundation (Woche 3-4)
Fokus: TypeScript Backend + React Frontend MVP

### Phase 3: Config Features (Woche 5-6)
Fokus: Agent-Verwaltung, Team-Builder, Settings

### Phase 4: Polish & Deploy (Woche 7-8)
Fokus: Testing, Docker, Documentation

---

## 🔧 Phase 1: Core Stability

### 1.1 Rate-Limiting Implementation

**Quelle:** `discussions/2026-02-04_18-21_anfrage-rate-limiting-strategie-für-claude-cli-pro.md`

#### TODO:
- [ ] `bottleneck` Library installieren
- [ ] Provider-spezifische Delays konfigurieren
  ```typescript
  const PROVIDER_DELAYS = {
    'claude-cli': 1000,  // 1 req/sec
    'openai': 200,
    'gemini': 100,
  };
  ```
- [ ] Sequential Processing implementieren (statt Promise.all)
- [ ] Exponential Backoff mit Jitter
  ```typescript
  const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
  const jitter = Math.random() * 0.1 * delay;
  ```
- [ ] Max-Retry-Counter (3 Versuche)
- [ ] Instance-basierter RateLimiter (kein Static State!)
- [ ] Logging für Rate-Limit-Events

#### Code-Struktur:
```
packages/orchestrator/src/
├── rate-limiter/
│   ├── index.ts
│   ├── provider-config.ts
│   └── bottleneck-wrapper.ts
```

---

### 1.2 Error-Handling Implementation

**Quelle:** `discussions/2026-02-04_18-30_anfrage-error-handling-für-fehlgeschlagene-experte.md`

#### TODO:
- [ ] Error-Classification enum
  ```typescript
  enum ErrorType {
    RETRYABLE,     // CLI timeout, network
    FATAL,         // Auth, config
    RATE_LIMITED   // Rate limits
  }
  ```
- [ ] Single Retry mit 2s Delay
- [ ] FailedQuestion Interface
- [ ] FailedQuestionTracker mit MAX_FAILED=50 Limit
- [ ] Transparente Ausgabe im Discussion Result
- [ ] Quality Warnings bei fehlenden Experten
- [ ] Consensus Confidence Score

#### Code-Struktur:
```
packages/orchestrator/src/
├── error-handling/
│   ├── index.ts
│   ├── error-classifier.ts
│   ├── failed-question-tracker.ts
│   └── retry-manager.ts
```

#### Output-Format:
```markdown
### Failed Questions (n)
| Expert | Error | Question Preview |
|--------|-------|------------------|
| ... | ... | ... |

⚠️ Quality Impact: X expert(s) unreachable
**Recommendation:** Re-run or manually consult
```

---

## 🖥️ Phase 2: Web-UI Foundation

**Quelle:** `discussions/2026-02-04_17-44_anfrage-nächster-schritt-für-web-ui-kontext-openbo.md`

### 2.1 Backend (TypeScript/Next.js)

#### TODO:
- [ ] Next.js Projekt Setup in `packages/web-ui`
- [ ] API Routes für:
  - [ ] `POST /api/chat` — Single message
  - [ ] `POST /api/discuss` — Start discussion
  - [ ] `GET /api/agents` — List agents
  - [ ] `GET /api/status` — System status
- [ ] WebSocket Setup (Socket.io)
- [ ] Orchestrator Integration
- [ ] Session Management
- [ ] JWT Auth (Basic)

#### Code-Struktur:
```
packages/web-ui/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts
│   │   │   ├── discuss/route.ts
│   │   │   └── agents/route.ts
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── components/
│   ├── hooks/
│   └── lib/
├── package.json
└── tsconfig.json
```

### 2.2 Frontend (React)

#### TODO:
- [ ] Dark Mode / Light Mode
- [ ] Responsive Layout (Desktop-First)
- [ ] Chat Interface
- [ ] Agent Status Sidebar
- [ ] Live Discussion View
- [ ] WebSocket Integration

#### UI-Konzept:
```
┌─────────────────────────────────────────────┐
│ OpenBotMan Web                         ⚙️🔗│
├─────────────────────────────────────────────┤
│ 💬 Chat                     👥 Agents       │
│ ┌─────────────────┐         ┌─────────────┐ │
│ │ > Hello         │         │ 🤖 Claude   │ │
│ │ < Hi there!     │         │ 🧠 GPT-4    │ │
│ │ > Discuss: ...  │         │ ⭐ Gemini   │ │
│ └─────────────────┘         └─────────────┘ │
│                                             │
│ 🔄 Active Discussions                       │
│ ┌─────────────────────────────────────────┐ │
│ │ "Topic..."                              │ │
│ │ 🤖 Claude: Support | 🧠 GPT-4: Concern  │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## ⚙️ Phase 3: Config Features

**Quelle:** `discussions/2026-02-04_17-54_anfrage-web-ui-konfigurations-und-verwaltungs-feat.md`

### 3.1 Agent-Verwaltung

#### TODO:
- [ ] Agent CRUD (Create/Read/Update/Delete)
- [ ] Statische Model-Liste pro Provider
- [ ] Agent-Editor: Name, Rolle, Provider, Model, System-Prompt
- [ ] Enable/Disable Toggle
- [ ] Zustand Store: `useAgentsStore()`

### 3.2 Team-Builder

#### TODO:
- [ ] Checkbox-basierte Team-Auswahl (kein Drag&Drop im MVP!)
- [ ] Konsens-Schwelle Slider (60-90%)
- [ ] Team speichern unter Namen
- [ ] 3-Klick-Flow: Button → Checkboxen → Fertig
- [ ] Zustand Store: `useTeamsStore()`

#### UI-Konzept:
```
[Neues Team]
┌─────────────────────┐
│ ☑ Claude (Architect) │
│ ☑ GPT-4 (Coder)     │
│ ☐ Gemini (Reviewer) │
├─────────────────────┤
│ Konsens: ████░ 80%  │
│ [Team erstellen]    │
└─────────────────────┘
```

### 3.3 Team-Templates

#### TODO:
- [ ] Vordefinierte Templates:
  - Security Review Team
  - Architecture Design Team
  - Code Review Team
  - Quick Fix Team
- [ ] Import/Export als JSON
- [ ] Template-Auswahl bei neuer Diskussion

### 3.4 API-Key Management

#### TODO:
- [ ] Pro Provider ein Key-Feld
- [ ] Web Crypto API Verschlüsselung
- [ ] Connection-Test Button
- [ ] Keys in IndexedDB (nicht LocalStorage!)
- [ ] Zustand Store: `useSettingsStore()`

### 3.5 Kosten-Tracking

#### TODO:
- [ ] Token-Counter pro Session
- [ ] Statische Preisliste (Config-Datei)
- [ ] Warnung bei >$5 pro Session
- [ ] Basis-Dashboard

---

## 🚀 Phase 4: Polish & Deploy

### 4.1 Testing

#### TODO:
- [ ] Unit Tests für Rate-Limiter
- [ ] Unit Tests für Error-Handler
- [ ] Integration Tests für API Routes
- [ ] E2E Tests für kritische Flows

### 4.2 Docker

#### TODO:
- [ ] Dockerfile für Web-UI
- [ ] docker-compose.yml
- [ ] Multi-stage Build
- [ ] Health Checks

### 4.3 Documentation

#### TODO:
- [ ] README.md aktualisieren
- [ ] API Documentation
- [ ] Deployment Guide
- [ ] User Guide erweitern

---

## 📊 Aufwandsschätzung

| Phase | Aufwand | Priorität |
|-------|---------|-----------|
| 1.1 Rate-Limiting | 2-3 Tage | 🔴 HOCH |
| 1.2 Error-Handling | 2-3 Tage | 🔴 HOCH |
| 2.1 Backend | 5-7 Tage | 🔴 HOCH |
| 2.2 Frontend | 5-7 Tage | 🔴 HOCH |
| 3.1 Agent-Verwaltung | 3-4 Tage | 🟡 MITTEL |
| 3.2 Team-Builder | 3-4 Tage | 🟡 MITTEL |
| 3.3 Templates | 1-2 Tage | 🟢 NIEDRIG |
| 3.4 API-Keys | 2-3 Tage | 🟡 MITTEL |
| 3.5 Kosten-Tracking | 2-3 Tage | 🟢 NIEDRIG |
| 4.x Polish & Deploy | 3-5 Tage | 🟡 MITTEL |

**Gesamt: ~30-40 Tage** (6-8 Wochen bei einem Entwickler)

---

## 🔗 Referenzen

- `discussions/2026-02-04_17-44_anfrage-nächster-schritt-für-web-ui-kontext-openbo.md`
- `discussions/2026-02-04_17-54_anfrage-web-ui-konfigurations-und-verwaltungs-feat.md`
- `discussions/2026-02-04_18-21_anfrage-rate-limiting-strategie-für-claude-cli-pro.md`
- `discussions/2026-02-04_18-30_anfrage-error-handling-für-fehlgeschlagene-experte.md`
- `WEBUI-ROADMAP.md`
- `ARCHITECTURE.md`

---

## 📝 Änderungshistorie

| Datum | Änderung | Autor |
|-------|----------|-------|
| 2026-02-04 | Initial Version | AJBot |

---

*Dieses Dokument wird kontinuierlich aktualisiert basierend auf neuen Erkenntnissen und Diskussionen.*
