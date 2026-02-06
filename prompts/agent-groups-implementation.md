# Experten-Gruppen Feature für OpenBotMan

## Kontext
OpenBotMan ist ein Multi-Agent Orchestrator. Aktuell sind die Agents (Analyst, Architect, Pragmatist) hardcoded.

## Anforderung
Wir wollen ein flexibles System für Agent-Gruppen implementieren:

1. **Agent-Definition**: Eigene Agents mit Name, Role, SystemPrompt, Model
2. **Agent-Gruppen**: Vordefinierte Teams für verschiedene Aufgaben (Security-Team, Performance-Team, etc.)
3. **Auswahl**: User soll bei Anfrage die passende Gruppe wählen können
4. **Verwaltung**: Später Web-UI zum Erstellen/Bearbeiten von Agents und Gruppen

## Fragen an die Experten
1. Wie sollte die Konfiguration aussehen? (YAML, JSON, DB?)
2. Wo speichern wir Agent-Definitionen? (Datei, DB, API?)
3. Wie integrieren wir das in VSCode Extension?
4. Wie handhaben wir unterschiedliche Models pro Agent?
5. Sollen Gruppen dynamisch zur Laufzeit änderbar sein?
6. Wie tracken wir Token-Verbrauch pro Agent?

## Technischer Kontext
- TypeScript Monorepo (pnpm)
- Packages: api-server, orchestrator, cli, ide-vscode
- Provider: claude-cli, claude-api
- Aktuell: Agents in server.ts hardcoded

Bitte analysiert und gebt konkrete Implementierungsempfehlungen.
