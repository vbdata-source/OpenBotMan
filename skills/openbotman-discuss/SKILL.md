# OpenBotMan Expert Discussion Skill

Starte Multi-Agent Experten-Diskussionen über die lokale OpenBotMan API.

## Voraussetzungen

Der OpenBotMan API Server muss laufen:
```cmd
C:\Sources\OpenBotMan\start-api.bat
```

## Trigger Phrases

Der Skill wird aktiviert bei:
- "Frag die OpenBotMan Experten..."
- "Ask the OpenBotMan experts..."
- "Multi-Agent Diskussion über..."
- "Experten-Analyse von..."
- "OpenBotMan soll analysieren..."

## Verwendung

### Einfache Frage
```
Frag die OpenBotMan Experten: Was sind Best Practices für Error Handling?
```

### Mit Workspace (Dateien analysieren)
```
Analysiere mit OpenBotMan den Code in C:\Sources\MeinProjekt
```

### Spezifische Dateien
```
Frag die Experten: Analysiere nur die TypeScript-Dateien in C:\Sources\MeinProjekt\src
```

## Script Parameter

| Parameter | Default | Beschreibung |
|-----------|---------|--------------|
| -Topic | (required) | Die Frage/das Thema |
| -Workspace | "" | Projekt-Pfad für Datei-Analyse |
| -Include | "" | Glob-Patterns, komma-getrennt |
| -Timeout | 600 | Max. Wartezeit in Sekunden |
| -ApiUrl | http://localhost:8080 | API Server URL |
| -ApiKey | local-dev-key | API Authentifizierung |

## Beispiel-Aufrufe

```powershell
# Einfache Frage
.\discuss.ps1 -Topic "Was sind Vorteile von TypeScript?"

# Mit Workspace
.\discuss.ps1 -Topic "Review diesen Code" -Workspace "C:\Sources\MeinProjekt" -Include "src/**/*.ts"

# Längerer Timeout für komplexe Analysen
.\discuss.ps1 -Topic "Architektur-Review" -Workspace "C:\Sources\GroßesProjekt" -Timeout 900
```

## Installation

### Global (für alle Projekte)
```cmd
xcopy /E /I C:\Sources\OpenBotMan\skills\openbotman-discuss %USERPROFILE%\.claude\skills\openbotman-discuss
```

### Per Projekt
Skill liegt dann in `.claude/skills/openbotman-discuss/` im Projekt.

## Wie es funktioniert

1. Script sendet async Request an OpenBotMan API
2. Server startet Job und gibt Job-ID zurück
3. Script pollt alle 5 Sekunden den Job-Status
4. Bei Completion wird das Ergebnis ausgegeben
5. Bei Timeout oder Error wird abgebrochen

## Troubleshooting

**"Connection refused"**
→ API Server starten: `start-api.bat`

**"Timeout"**
→ `-Timeout 900` für längere Analysen

**"Job not found"**
→ Server wurde neugestartet, Job existiert nicht mehr
