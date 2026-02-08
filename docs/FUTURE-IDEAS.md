# 🚀 Future Ideas & Roadmap

*Ideen für zukünftige Features - noch nicht implementiert!*

---

## 🎯 Kurzfristig (Geplant)

### Settings Web-UI
- [ ] Graphischer Agent-Editor
- [ ] Team-Editor
- [ ] Config speichern → config.yaml

### WebSockets
- [ ] Real-time Updates statt Polling
- [ ] Live Agent-Status

### Web-Recherche
- [ ] Pre-Discussion Search (Brave/Tavily API)
- [ ] Fakten-Check vor Diskussion

---

## 🔮 Mittelfristig (Ideen)

### Globales CLI
```bash
# Statt pnpm cli discuss:
openbotman discuss "Thema"
openbotman chat
openbotman agents
```
**Requires:** npm publish, global install

### Knowledge Base
- Vector DB (Qdrant/ChromaDB)
- Auto-Learning aus Diskussionen
- Cross-Agent Memory

### Channels Integration
- Microsoft Teams Bot
- Telegram Bot
- Discord Bot
- Slack Integration

---

## 🌟 Langfristig (Vision)

### Docker Deployment
```bash
docker run -d ghcr.io/vbdata-source/openbotman:latest
```

### Kubernetes / Helm Charts
- Scalable deployment
- Multi-tenant support

### Security Features
- OAuth2/JWT Authentication
- Role-Based Access Control (RBAC)
- Audit Logging
- Sandbox Execution

### AICP Protocol
- Binary protocol (70% kleiner als JSON)
- Shorthand notation: `@ARCH>CODER:TASK:impl_auth:P1`

---

## 💡 Ursprung

Diese Ideen stammen aus der ursprünglichen Vision von OpenBotMan.
Sie werden implementiert wenn Zeit und Bedarf da sind.

**Prinzip:** MVP first, dann iterativ erweitern.

---

*Zuletzt aktualisiert: 2026-02-08*
