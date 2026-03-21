# OpenBotMan Web-UI Roadmap v2.1

> **CREDO:** "Einfache Bedienung mit höchstem Komfort und voller Funktionalität!"

---

## Experten-Konsens (2026-02-03)

**Teilnehmer:**
- 🎯 Strategic Planner (Gemini)
- 💻 Senior Developer (Claude)
- 🔍 Security Expert (Claude)

**Status:** ✅ KONSENS ERREICHT

---

## Timeline (Realistisch)

| Phase | Features | Zeitaufwand |
|-------|----------|-------------|
| **MVP (Phase 1)** | Kernfunktionalität | 4-5 Monate |
| **Phase 2** | Erweiterte Features | 3-4 Monate |
| **Phase 3** | Enterprise | 4-5 Monate |
| **Gesamt** | Komplett | **11-14 Monate** |

---

## Phase 1: MVP (4-5 Monate)

### Konfiguration
- [ ] Agent-Editor (Name, Provider, Model, System-Prompt)
- [ ] Rollen-Editor (Coder, Reviewer, Architect)
- [ ] Zuweisung Rolle → Agent (Drag & Drop)
- [ ] Profile speichern

### Live-Diskussion Visualisierung
- [ ] Wer spricht gerade (Avatar/Icon hervorgehoben)
- [ ] Aktuelle Runde (Round 2/5)
- [ ] Position-Badges pro Agent (✅ ⚠️ ❌)
- [ ] Echtzeit-Typing-Indicator ("Coder analysiert...")

### Model-Management
- [ ] Model-Dropdown pro Agent (initiale Liste)

### Ergebnis-Darstellung
- [ ] MD-File grafisch aufbereitet (Syntax-Highlighting)
- [ ] Ein-Klick Copy to Clipboard
- [ ] Export: MD

### UX-Komfort
- [ ] Dark Mode / Light Mode
- [ ] Responsive Design (Mobile-friendly)

### Security Foundation (MANDATORY)
- [ ] Zero-Trust Architecture
- [ ] API-Key Encryption (Backend-only, AES-256)
- [ ] Auth0/Keycloak Integration
- [ ] CORS + CSP Setup
- [ ] Rate-Limiting: 5 Requests/Minute/User
- [ ] Hard-Limits: max 10 Iterationen, max 5 Agenten

---

## Phase 2: Erweiterte Features (3-4 Monate)

### Konfiguration
- [ ] Profile kopieren & umbenennen
- [ ] Profile exportieren/importieren (JSON/YAML)

### Live-Diskussion
- [ ] Konsens-Balken (visuelle Darstellung)

### Model-Management
- [ ] Automatische Model-Liste von Providern

### Kosten-Tracking
- [ ] Token-Zähler pro Diskussion (Input/Output)
- [ ] Kosten-Berechnung in Echtzeit ("$0.42")
- [ ] Cost-Fallback-Chain: haiku → sonnet → opus

### Export
- [ ] PDF, HTML Export
- [ ] Teilen-Link (read-only)

### UX
- [ ] Keyboard-Shortcuts (Ctrl+Enter, Escape)
- [ ] Auto-Save von Drafts

---

## Phase 3: Enterprise (4-5 Monate)

### Kosten-Tracking Advanced
- [ ] Kosten pro Agent sichtbar
- [ ] Kosten-Historie (Tag/Woche/Monat)
- [ ] Budget-Limits mit Warnung
- [ ] Circuit Breaker bei $100/Tag
- [ ] Export für Buchhaltung (CSV)

### Model-Management
- [ ] Model-Preise hinterlegen
- [ ] Favoriten-Modelle

### Security & Enterprise
- [ ] Web-UI komplett deaktivierbar
- [ ] Rollen-basierte Zugriffskontrolle (RBAC)
- [ ] Immutable Audit-Logs
- [ ] GDPR/SOX Compliance

### UX
- [ ] Undo/Redo für Config-Änderungen
- [ ] Onboarding-Tutorial

### History & Analytics
- [ ] Vergangene Diskussionen durchsuchen
- [ ] Konsens-Statistiken
- [ ] Provider-Verbrauch
- [ ] Konsens-Visualisierung (Diagramme)

---

## Tech-Stack

### Frontend
- **Framework:** React/Next.js + TypeScript
- **State:** Zustand + React Query (nicht Redux)
- **UI Components:** Material UI / Chakra UI
- **Validation:** zod

### Backend
- **Framework:** FastAPI (Python)
- **Server:** Uvicorn
- **ORM:** SQLAlchemy
- **Async:** komplett async/await

### Datenbank
- **Primary:** PostgreSQL
- **Cache:** Redis
- **Time-Series:** InfluxDB (für Cost-Metrics)

### Security
- **Auth:** Auth0 / Keycloak
- **Secrets:** HashiCorp Vault
- **API Gateway:** Kong

### Infrastructure
- **Container:** Docker
- **Monitoring:** Sentry + Prometheus + Grafana
- **Tests:** Jest + pytest

---

## Kritische Architektur-Entscheidungen

### 1. Subprocess → Async SDK
```python
# ALT (blockierend):
result = subprocess.run(['claude', prompt])

# NEU (async):
async with anthropic.AsyncClient() as client:
    stream = await client.messages.create(stream=True, ...)
```

### 2. WebSocket mit Reconnection
- Heartbeat-System für Agent-Status
- Automatische Reconnection bei Disconnect
- Graceful Handling bei Browser-Crash

### 3. Cost-Fallback-Chain
```python
agents = [
    "claude_haiku",   # $0.0025 (erst versuchen)
    "claude_sonnet",  # $0.30 (bei Komplexität)
    "claude_opus"     # $0.60 (nur bei Bedarf)
]
```

### 4. API-Key Security
- Backend-only Storage
- AES-256 Encryption
- Session-bound temporary tokens
- Key-Rotation alle 30 Tage

---

## Risiken & Mitigationen

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Cost Bombing Attack | $50k Schaden | Hard-Limits + Circuit Breaker |
| API-Key Leak | Vollzugriff | Backend-only + Encryption |
| Blocking UI | Unusable UX | WebSocket + Async |
| State Chaos | Race Conditions | Single Source of Truth |
| Monolith | Unmaintainable | Klare API-Grenzen |

---

## Aufwand-Detail (1 Entwickler)

| Komponente | Stunden |
|------------|---------|
| Backend Refactoring | 80h |
| WebSocket Integration | 60h |
| API Endpoints | 40h |
| Auth/Session | 30h |
| Component Library | 20h |
| Live UI Components | 60h |
| Config Editors | 50h |
| Integration | 40h |
| Unit Tests | 40h |
| Integration Tests | 30h |
| Docker Setup | 15h |
| **TOTAL** | **~465h** |

---

## Experten-Bedingungen (Release-Blocker)

### Senior Developer:
- ✅ Zeitschätzung +40% einkalkuliert
- ✅ WebSocket-Architektur vor Entwicklung finalisieren
- ✅ subprocess → async refactoring

### Security Expert:
- ✅ Zero-Trust Architecture
- ✅ API-Key Encryption (Backend-only)
- ✅ Auth0/Keycloak (nicht selbst bauen!)
- ✅ Rate-Limiting + Hard-Limits
- ✅ Security von Tag 1, nicht nachträglich

---

*Generiert durch OpenBotMan Multi-Agent Discussion am 2026-02-03*
