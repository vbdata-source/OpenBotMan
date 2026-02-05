# VSCode Integration für OpenBotMan

## Setup

### 1. API Server muss laufen

```cmd
C:\Sources\OpenBotMan\start-api.bat
```

### 2. Tasks kopieren

Kopiere `tasks.json` in dein Projekt:
```
C:\Sources\DeinProjekt\.vscode\tasks.json
```

Oder global für alle Projekte:
```
%APPDATA%\Code\User\tasks.json
```

### 3. Keybindings (optional)

Öffne VSCode → `Ctrl+K Ctrl+S` → Oben rechts "Open Keyboard Shortcuts (JSON)"

Füge die Einträge aus `keybindings.json` hinzu.

## Verwendung

### Via Command Palette (Ctrl+Shift+P)

1. `Tasks: Run Task`
2. Wähle:
   - **OpenBotMan: Start API Server** - Startet den Server
   - **OpenBotMan: Discuss Current File** - Analysiert die aktuelle Datei
   - **OpenBotMan: Discuss Workspace** - Analysiert das ganze Projekt

### Via Keyboard Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `Ctrl+Shift+O` | Aktuelle Datei diskutieren |
| `Ctrl+Shift+Alt+O` | Ganzes Workspace diskutieren |

## Anpassen

Editiere `tasks.json` um:
- Andere Include-Patterns zu setzen
- Den Topic-Text anzupassen
- Timeout zu ändern

Beispiel für TypeScript-Projekt:
```json
"include": ["src/**/*.ts", "tests/**/*.ts"]
```

Beispiel für Python-Projekt:
```json
"include": ["**/*.py", "requirements.txt"]
```
