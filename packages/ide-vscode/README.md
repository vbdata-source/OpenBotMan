# OpenBotMan VSCode Extension

Multi-Agent AI Orchestration direkt in VS Code.

## Features

### 🔍 Projekt analysieren (`Ctrl+Shift+Alt+O`)
- Vollständige Code-Analyse
- Security Review
- Performance-Analyse
- Code-Qualität prüfen
- Architektur bewerten

### 💬 Experten fragen (`Ctrl+Shift+O`)
- Freie Fragen an OpenBotMan Experten
- Optional: Projektdateien einbeziehen

### 📝 Code Review
- Aktuelle Datei oder Selektion reviewen lassen

## Installation

### Voraussetzung: API Server

Der OpenBotMan API Server muss laufen:
```cmd
C:\Sources\OpenBotMan\start-api.bat
```

### Extension installieren

```cmd
cd C:\Sources\OpenBotMan\packages\ide-vscode
npm install
npm run compile
```

Dann in VSCode:
1. `Ctrl+Shift+P` → "Developer: Install Extension from Location..."
2. Pfad: `C:\Sources\OpenBotMan\packages\ide-vscode`

Oder als VSIX:
```cmd
npm run package
# Installiert openbotman-vscode-2.0.0.vsix
```

## Verwendung

### Schnellzugriff

| Shortcut | Aktion |
|----------|--------|
| `Ctrl+Shift+O` | Experten fragen |
| `Ctrl+Shift+Alt+O` | Projekt analysieren |

### Command Palette

`Ctrl+Shift+P` und dann:
- "OpenBotMan: Experten fragen"
- "OpenBotMan: Projekt analysieren"
- "OpenBotMan: Code Review"

### Status Bar

Klick auf 🤖 OpenBotMan in der Status Bar zeigt den Server-Status.

## Konfiguration

In VSCode Settings (`Ctrl+,`):

```json
{
  "openbotman.apiUrl": "http://localhost:8080",
  "openbotman.apiKey": "local-dev-key"
}
```

## Workflow

1. API Server starten (einmalig)
2. `Ctrl+Shift+Alt+O` für Projekt-Analyse
3. Analyse-Typ wählen
4. Warten auf Experten-Ergebnis
5. Ergebnis im Output Panel

## Analyse-Typen

| Typ | Fokus |
|-----|-------|
| 🔍 Vollständig | Alles: Architektur, Quality, Security, Performance |
| 🛡️ Security | SQL Injection, XSS, Auth-Probleme |
| ⚡ Performance | N+1 Queries, Caching, Memory |
| 🧹 Code-Qualität | DRY, SOLID, Clean Code |
| 🏗️ Architektur | Patterns, Struktur, Modularität |

## Troubleshooting

**"Connection refused"**
→ API Server starten: `start-api.bat`

**"Timeout"**
→ Große Projekte brauchen länger. Warte oder reduziere `include` Patterns.

**Extension nicht sichtbar**
→ VSCode neu starten nach Installation
