# OpenBotMan VSCode Extension

Die VSCode Extension integriert Multi-Agent-Diskussionen direkt in deine IDE.

## Installation

### Aus VSIX installieren

1. Extension bauen:
   ```cmd
   cd packages/ide-vscode
   pnpm run compile
   npx vsce package --no-dependencies
   ```

2. In VSCode installieren:
   - `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
   - Die generierte `.vsix` Datei auswählen

## Befehle

| Befehl | Shortcut | Beschreibung |
|--------|----------|--------------|
| **Experten fragen** | `Ctrl+Shift+O` | Freie Frage an die Agents |
| **Code Review** | `Ctrl+Shift+R` | Review der aktuellen Datei/Auswahl |
| **Projekt analysieren** | `Ctrl+Shift+Alt+O` | Umfassende Projekt-Analyse |
| **Status prüfen** | Statusbar klicken | Server-Verbindung prüfen |
| **Server starten** | - | API Server starten |

## Konfiguration

In VSCode Settings (`Ctrl+,`):

| Setting | Default | Beschreibung |
|---------|---------|--------------|
| `openbotman.apiUrl` | `http://localhost:8080` | API Server URL |
| `openbotman.apiKey` | - | API Key (muss mit Server übereinstimmen) |
| `openbotman.timeoutMinutes` | 60 | Max. Wartezeit für Jobs (1-180) |
| `openbotman.pollIntervalSeconds` | 3 | Abfrage-Intervall (1-30) |
| `openbotman.verboseLevel` | 1 | Live-Ausgabe Detail-Level (0-2) |

### Verbose Level erklärt

- **Level 0**: Nur das Endergebnis nach Abschluss
- **Level 1**: Agent-Zusammenfassungen live während der Arbeit (empfohlen)
- **Level 2**: Zusätzlich "Agent X denkt nach..." Meldungen

## Sidebar: Aktive Jobs

Die Sidebar zeigt laufende Diskussionen mit Echtzeit-Status:

```
📦 OPENBOTMAN: AKTIVE JOBS
└── 🔄 Code Review für server.ts    Runde 2/5, 45s
    ├── ✅ Analyst                   12s
    ├── 🔄 Architect                 denkt nach...
    └── ⭕ Pragmatist                wartet
```

### Status-Icons

| Icon | Bedeutung |
|------|-----------|
| 🔄 | Läuft / Denkt nach |
| ✅ | Abgeschlossen |
| ⭕ | Wartet |
| ❌ | Fehler |
| 🚫 | Abgebrochen |

## Server Auto-Start

Wenn du einen Befehl ausführst und der Server nicht läuft:

1. Dialog erscheint: "OpenBotMan Server läuft nicht!"
2. Klick auf "Server starten"
3. Terminal öffnet sich und startet den Server
4. Nach 5 Sekunden wird die Verbindung geprüft

## Projekt-Analyse

Die Projekt-Analyse bietet verschiedene Fokus-Bereiche:

| Analyse-Typ | Beschreibung |
|-------------|--------------|
| 🔍 Vollständige Analyse | Architektur, Code-Qualität, Security, Performance |
| 🛡️ Security Review | Sicherheitslücken, Best Practices |
| ⚡ Performance | Performance-Probleme, Optimierungen |
| 🧹 Code-Qualität | DRY, SOLID, Code Smells |
| 🏗️ Architektur | Design Patterns, Modularität |

## Multi-Runden Konsens

Die Agents diskutieren in mehreren Runden bis zum Konsens:

### Runde 1
- **Analyst**: Erstellt erste Analyse [PROPOSAL]
- **Architect**: Reagiert, gibt Position ab [SUPPORT/CONCERN/OBJECTION]
- **Pragmatist**: Fasst zusammen, gibt Position ab

### Weitere Runden (bei Einwänden)
- Agents reagieren auf Objections
- Versuchen Kompromisse zu finden
- Neue Positionen werden abgegeben

### Konsens erreicht wenn:
- Keine OBJECTION Stimmen
- Alle Agents SUPPORT oder SUPPORT_WITH_CONDITIONS

## Fehlerbehebung

### "Server läuft nicht"
1. Prüfe ob `start-api.bat` korrekt ausgeführt wird
2. Prüfe die Konsole auf Fehler
3. Stelle sicher, dass Port 8080 frei ist

### "Timeout nach X Minuten"
1. Erhöhe `openbotman.timeoutMinutes` in den Settings
2. Prüfe die Server-Konsole auf Fehler
3. Bei Claude CLI: Prüfe `claude --version` und `claude auth status`

### "401 Unauthorized"
1. Prüfe `openbotman.apiKey` in den Settings
2. Muss mit `OPENBOTMAN_API_KEYS` im Server übereinstimmen

## Tipps

1. **Verbose Level 1** zeigt dir den Fortschritt ohne zu viel Output
2. **Code Review** funktioniert auch mit markiertem Text
3. **Projekt-Analyse** lädt alle relevanten Dateien automatisch
4. Bei langen Analysen: Sidebar zeigt dir immer den aktuellen Stand
