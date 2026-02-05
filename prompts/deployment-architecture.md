# OpenBotMan Deployment-Architektur: Cloud vs Lokal

## Kontext
- **AJBot** (KI-Assistent) läuft auf einem Hetzner Cloud Server (16GB RAM, 8 vCPUs, Docker/Coolify)
- **OpenBotMan** ist aktuell nur lokal auf Juergens Windows PC installiert
- **Ziel:** AJBot soll OpenBotMan direkt aufrufen können (HTTP API)

## Das Problem
AJBot kann den lokalen PC nicht erreichen:
```
Cloud Server (AJBot) ──X──> Juergens PC (OpenBotMan)
                           │
                           └── Hinter NAT/Firewall, nicht erreichbar
```

## Zu analysierende Optionen

### Option A: OpenBotMan auf Cloud Server
```
Hetzner Server
├── OpenClaw/AJBot (Docker)
└── OpenBotMan API (Docker oder direkt)
    └── Claude CLI (authentifiziert)
```

**Pro:**
- Alles an einem Ort
- AJBot kann localhost aufrufen
- 24/7 verfügbar

**Contra:**
- Claude CLI auf Server authentifizieren (wie?)
- Server-Ressourcen teilen
- Kosten für API-Calls?

### Option B: Tunnel von lokalem PC
```
Juergens PC ──cloudflare tunnel──> Internet ──> AJBot
     │
     └── OpenBotMan API läuft lokal
```

**Pro:**
- Nutzt existierende lokale Installation
- Juergens Claude CLI Subscription

**Contra:**
- PC muss laufen
- Tunnel-Setup & Maintenance
- Security-Risiko (PC im Internet exponiert)
- Latenz

### Option C: Hybrid - Entwicklung lokal, Production Cloud
```
Entwicklung: Juergens PC (lokal)
Production:  Hetzner Server (deployed)
```

**Pro:**
- Beste beider Welten
- Lokale Entwicklung schneller
- Production stabil

**Contra:**
- Zwei Umgebungen synchron halten
- Doppelte Claude CLI Auth

### Option D: GitHub Actions als Runner
```
AJBot → GitHub Webhook → GitHub Action → Commit Result → AJBot liest
```

**Pro:**
- Keine eigene Infrastruktur
- GitHub's Ressourcen nutzen

**Contra:**
- Langsam (Action startup)
- Komplexer Workflow
- GitHub Secrets für Claude API

### Option E: OpenBotMan als SaaS (Zukunft)
```
openbotman.cloud
└── Multi-Tenant API
    └── Juergen's Workspace
```

**Pro:**
- Skalierbar
- Monetarisierbar
- Keine lokale Installation nötig

**Contra:**
- Viel Aufwand
- Noch kein Business Case

## Fragen zur Analyse

1. **Claude CLI Auth:** Wie authentifiziert man Claude CLI auf einem Server ohne Browser?
2. **Ressourcen:** Reichen 16GB RAM für OpenClaw + OpenBotMan + mehrere Claude Agents?
3. **Kosten:** Claude Pro/Max vs API - was macht auf Server Sinn?
4. **Security:** Wie schützen wir die Claude Credentials auf dem Server?
5. **Entwickler-Experience:** Wie testet Juergen lokal wenn Production auf Server läuft?

## Constraints
- Budget: Möglichst günstig (Hetzner Server ist schon bezahlt)
- Komplexität: KISS - so einfach wie möglich
- Verfügbarkeit: AJBot soll jederzeit OpenBotMan nutzen können

## Erwartetes Ergebnis
- Empfohlene Deployment-Architektur
- Schritt-für-Schritt Setup-Plan
- Security-Überlegungen
- Fallback-Strategie
