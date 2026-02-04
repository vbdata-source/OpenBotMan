# Anfrage: Nächster Schritt für Web-UI

## Kontext

OpenBotMan v2.0-alpha.1 ist ein Multi-Agent Orchestration System.
Der Kern existiert bereits:
- Orchestrator mit Claude-Integration
- AICP Protocol (Binary Message Format)
- Discussion Engine mit Konsens-Findung
- CLI mit discuss Command
- Knowledge Base Grundstruktur

Laut WEBUI-ROADMAP.md ist eine Web-UI geplant:
- Frontend: React/Next.js + TypeScript
- Backend: FastAPI (Python) mit WebSocket
- Auth: Auth0/Keycloak
- Geschätzter Aufwand: ~465h

## Frage

Was sollte der **erste konkrete Implementierungsschritt** für die Web-UI sein?

## Optionen

1. **FastAPI Backend-Skeleton** mit WebSocket-Support für Live-Diskussionen
2. **React Frontend** mit Grundlayout (Dark Mode, Responsive, Agent-Visualisierung)
3. **Integration-Layer**: Bestehenden TypeScript-Code als API wrappen
4. **Auth-Setup** (Auth0/Keycloak) zuerst für Security-Foundation

## Bitte analysiert

- Welche Option hat die beste "Return on Investment" für einen MVP?
- Was sind die Abhängigkeiten zwischen den Optionen?
- Gibt es eine bessere Reihenfolge die ich übersehe?
- Sollten wir bei Python/FastAPI bleiben oder alles in TypeScript machen?

## Randbedingungen

- Ein Entwickler (Juergen + AJBot als Coding-Partner)
- Bestehender Code ist TypeScript/Node.js
- Soll in Docker laufen
- MVP zuerst, dann iterativ erweitern
