# OpenBotMan Expert Discussion Skill

Starte Multi-Agent Experten-Diskussionen über die lokale OpenBotMan API.

## Voraussetzungen

1. **OpenBotMan API Server läuft:**
   ```bash
   cd C:\Sources\OpenBotMan\packages\api-server
   set OPENBOTMAN_API_KEYS=local-dev-key
   pnpm start
   ```

2. **API URL:** `http://localhost:8080`
3. **API Key:** `local-dev-key` (oder wie konfiguriert)

## Verwendung

### Einfache Frage an Experten

Wenn du eine komplexe technische Frage hast, die von mehreren Perspektiven analysiert werden sollte:

```bash
curl -X POST http://localhost:8080/api/v1/discuss \
  -H "Authorization: Bearer local-dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "DEINE FRAGE HIER",
    "agents": 3,
    "maxRounds": 5,
    "timeout": 120
  }'
```

### Frage mit Projekt-Kontext (Dateien analysieren)

Wenn du Dateien aus einem Projekt analysieren lassen willst:

```bash
curl -X POST http://localhost:8080/api/v1/discuss \
  -H "Authorization: Bearer local-dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "DEINE FRAGE ZU DEN DATEIEN",
    "workspace": "C:\\Pfad\\Zum\\Projekt",
    "include": ["**/*.config", "**/*.xml", "**/*.json"],
    "maxContext": 200,
    "agents": 3,
    "timeout": 180
  }'
```

### Mit Prompt-Datei

```bash
curl -X POST http://localhost:8080/api/v1/discuss \
  -H "Authorization: Bearer local-dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "promptFile": "C:\\Sources\\OpenBotMan\\prompts\\meine-frage.md",
    "workspace": "C:\\Pfad\\Zum\\Projekt",
    "include": ["src/**/*.ts"]
  }'
```

## Parameter

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| `topic` | string | - | Die Frage/das Thema (required wenn kein promptFile) |
| `promptFile` | string | - | Pfad zu einer Markdown-Datei mit der Frage |
| `workspace` | string | - | Projekt-Verzeichnis für Datei-Analyse |
| `include` | string[] | - | Glob-Patterns für Dateien (z.B. `["**/*.ts"]`) |
| `maxContext` | number | 100 | Max. Kontext-Größe in KB |
| `agents` | number | 3 | Anzahl Experten (1-5) |
| `maxRounds` | number | 5 | Max. Konsens-Runden |
| `timeout` | number | 60 | Timeout pro Agent in Sekunden |

## Wann diesen Skill nutzen?

✅ **Nutze OpenBotMan wenn:**
- Komplexe Architektur-Entscheidungen anstehen
- Code aus mehreren Perspektiven reviewt werden soll
- Du verschiedene Lösungsansätze analysieren willst
- Konfigurationsprobleme in fremden Systemen gelöst werden müssen

❌ **Nutze OpenBotMan NICHT für:**
- Einfache Code-Generierung
- Schnelle Fragen die keine Diskussion brauchen
- Aufgaben die du selbst schneller lösen kannst

## Response-Format

```json
{
  "id": "uuid",
  "status": "complete",
  "consensus": true,
  "result": "## Analyse\n...\n## Empfehlung\n...",
  "actionItems": ["Item 1", "Item 2"],
  "rounds": 3,
  "durationMs": 15000
}
```

## Tipps

1. **Sei spezifisch:** Je klarer die Frage, desto besser die Analyse
2. **Gib Kontext:** Nutze `workspace` + `include` wenn Dateien relevant sind
3. **Timeout erhöhen:** Bei komplexen Fragen `timeout: 180` oder mehr
4. **Glob-Patterns:** 
   - `**/*.ts` = alle TypeScript Dateien
   - `docs/**/*` = alles im docs Ordner
   - `*.config` = Config-Dateien im Root
