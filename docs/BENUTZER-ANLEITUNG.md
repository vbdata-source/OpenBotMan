# OpenBotMan Benutzer-Anleitung

> **Für:** Juergen & alle, die OpenBotMan nutzen wollen
> **Stand:** 2026-02-04
> **Pfad:** `C:\Sources\OpenBotMan`

---

## Voraussetzungen

1. **Node.js** (v20+)
2. **pnpm** installiert (`npm install -g pnpm`)
3. **Claude CLI** eingeloggt (`claude setup-token`)

---

## Wichtig: Immer absolute Pfade verwenden!

Die CLI läuft aus `packages/cli` — relative Pfade funktionieren nicht!

```cmd
# ❌ FALSCH
pnpm cli discuss --prompt-file prompts/meine-frage.md

# ✅ RICHTIG
pnpm cli discuss --prompt-file C:\Sources\OpenBotMan\prompts\meine-frage.md
```

---

## Befehlsübersicht

### 1. Multi-Agent Diskussion starten

```cmd
pnpm cli discuss [OPTIONEN]
```

#### Parameter:

**🔴 PFLICHT (einer von beiden):**
| Parameter | Kurz | Beschreibung |
|-----------|------|--------------|
| `[topic]` | | Thema direkt als Text |
| `--prompt-file <pfad>` | `-p` | Prompt aus Datei laden |

**🟢 OPTIONAL (mit sinnvollen Defaults):**
| Parameter | Kurz | Beschreibung | Default |
|-----------|------|--------------|---------|
| `--agents <anzahl>` | `-a` | Anzahl Agents (1-3) | 3 |
| `--max-rounds <n>` | `-r` | Max. Konsens-Runden | 10 |
| `--output <pfad>` | `-o` | Output-Verzeichnis | ./discussions |
| `--timeout <sek>` | `-t` | Timeout pro Agent (Sekunden) | 60 |
| `--model <model>` | `-m` | Model für alle Agents | aus config.yaml |
| `--verbose` | `-v` | Ausführliche Ausgabe | false |
| `--planner <provider>` | | Provider für Planner | claude-cli |
| `--coder <provider>` | | Provider für Coder | claude-cli |
| `--reviewer <provider>` | | Provider für Reviewer | claude-cli |

**💡 Empfohlene Runden:**
| Diskussions-Typ | `--max-rounds` |
|-----------------|----------------|
| Schnelle Frage | 3-5 |
| Normale Analyse | 10 (Default) |
| Komplexe Architektur | 15-20 |

#### Minimal-Beispiel (nur Pflicht-Parameter):

```cmd
# Variante 1: Thema direkt
pnpm cli discuss "Sollen wir React oder Vue verwenden?"

# Variante 2: Thema aus Datei
pnpm cli discuss --prompt-file C:\Sources\OpenBotMan\prompts\meine-frage.md
```

#### Weitere Beispiele:

```cmd
# Einfache Diskussion
pnpm cli discuss "Sollen wir TypeScript oder JavaScript verwenden?"

# Diskussion mit Datei-Prompt
pnpm cli discuss --prompt-file C:\Sources\OpenBotMan\prompts\meine-frage.md --agents 3 --max-rounds 5 --output C:\Sources\OpenBotMan\discussions --verbose

# Schnelle Diskussion (weniger Runden)
pnpm cli discuss --prompt-file C:\Sources\OpenBotMan\prompts\frage.md --agents 2 --max-rounds 3

# Mit verschiedenen Providern
pnpm cli discuss "Frage..." --planner google --coder claude-cli --reviewer openai
```

---

### 2. Interaktiver Chat

```cmd
pnpm cli chat [OPTIONEN]
```

| Parameter | Beschreibung | Default |
|-----------|--------------|---------|
| `--config <pfad>` | Config-Datei | config.yaml |

```cmd
# Chat starten
pnpm cli chat

# Mit anderer Config
pnpm cli chat --config custom-config.yaml
```

---

### 3. Agents auflisten

```cmd
pnpm cli agents
```

Zeigt alle konfigurierten Agents aus `config.yaml`.

---

### 4. Workflows auflisten

```cmd
pnpm cli workflows
```

Zeigt verfügbare Workflows (Code-Review, Feature-Development, etc.)

---

### 5. Authentifizierung

```cmd
# Status prüfen
pnpm cli auth status

# Neuen Token einrichten
pnpm cli auth setup-token

# Profile auflisten
pnpm cli auth list

# Profil entfernen
pnpm cli auth remove [name]

# Default-Profil setzen
pnpm cli auth default [name]
```

---

### 6. Demo-Diskussion

```cmd
pnpm cli demo discussion --topic "Dein Thema" --delay 1000
```

Simuliert eine Diskussion mit Animationen (für Demos/Tests).

---

## Prompt-Dateien erstellen

### Format (Markdown):

```markdown
# Titel der Anfrage

## Kontext
Beschreibe den Hintergrund...

## Frage
Was soll diskutiert werden?

## Optionen
1. Option A
2. Option B
3. Option C

## Randbedingungen
- Constraint 1
- Constraint 2
```

### Speicherort:
```
C:\Sources\OpenBotMan\prompts\
```

---

## Git-Workflow

```cmd
cd C:\Sources\OpenBotMan

# Änderungen holen
git pull

# Änderungen committen
git add .
git commit -m "Beschreibung der Änderung"
git push origin master
```

---

## Claude CLI Befehle

```cmd
# Version prüfen
claude --version

# Token einrichten (bei "Invalid API key")
claude setup-token

# Schneller Test
claude -p "Sag Hallo"
```

**Wichtig:** `claude -p` oder `--print` für nicht-interaktiven Modus!

---

## Typische Workflows

### A) Neue Frage diskutieren lassen

1. **Prompt-Datei erstellen:**
   ```cmd
   notepad C:\Sources\OpenBotMan\prompts\meine-frage.md
   ```

2. **Diskussion starten:**
   ```cmd
   pnpm cli discuss --prompt-file C:\Sources\OpenBotMan\prompts\meine-frage.md --agents 3 --max-rounds 5 --output C:\Sources\OpenBotMan\discussions --verbose
   ```

3. **Ergebnis lesen:**
   ```cmd
   dir C:\Sources\OpenBotMan\discussions\
   notepad C:\Sources\OpenBotMan\discussions\[neueste-datei].md
   ```

4. **Ergebnis teilen (mit AJBot):**
   ```cmd
   git add discussions/
   git commit -m "Add discussion: meine-frage"
   git push origin master
   ```

### B) Schnelle Frage (ohne Datei)

```cmd
pnpm cli discuss "Welche Datenbank für ein Chat-System?" --agents 2 --max-rounds 3 --verbose
```

---

## Troubleshooting

### "Invalid API key"
```cmd
claude setup-token
# Token eingeben
```

### "Prompt file not found"
→ Absolute Pfade verwenden!

### "Command not found: pnpm"
```cmd
npm install -g pnpm
```

### Claude CLI öffnet IDE statt zu antworten
→ `--print` oder `-p` Flag verwenden:
```cmd
claude -p "Deine Frage"
```

---

## Konfiguration

Die Hauptkonfiguration liegt in:
```
C:\Sources\OpenBotMan\config.yaml
```

Hier werden Agents, Provider, Modelle und mehr definiert.

---

## Provider: CLI vs API

OpenBotMan unterstützt zwei Wege um mit Claude zu kommunizieren:

### `claude-cli` (Standard für lokale Entwicklung)

Nutzt die Claude Code CLI als Subprocess.

**Vorteile:**
- ✅ Nutzt dein Claude Pro/Max Abo (keine Extra-Kosten)
- ✅ Einfach einzurichten (nur `claude setup-token`)
- ✅ Funktioniert auf deinem PC mit Browser

**Nachteile:**
- ❌ Braucht interaktive Authentifizierung (Browser)
- ❌ Nicht für Server ohne GUI geeignet

```yaml
# config.yaml
discussion:
  agents:
    - id: planner
      provider: claude-cli  # ← Nutzt Claude CLI
      model: claude-sonnet-4-20250514
```

### `claude-api` (Für Server-Deployments)

Nutzt das Anthropic SDK direkt mit API-Key.

**Vorteile:**
- ✅ Funktioniert auf Servern ohne Browser
- ✅ Stabiler für Production
- ✅ Keine CLI-Installation nötig

**Nachteile:**
- ❌ Kostet Geld pro Token (~$3-15 pro 1M Tokens)
- ❌ Braucht ANTHROPIC_API_KEY

```yaml
# config.yaml für Server
discussion:
  agents:
    - id: planner
      provider: claude-api  # ← Nutzt Anthropic API direkt
      model: claude-sonnet-4-20250514
      apiKey: ${ANTHROPIC_API_KEY}
```

### Wann was verwenden?

| Szenario | Empfohlener Provider |
|----------|---------------------|
| Lokale Entwicklung (dein PC) | `claude-cli` |
| Server ohne GUI | `claude-api` |
| CI/CD Pipeline | `claude-api` |
| Docker Container | `claude-api` |
| Kostenbewusst | `claude-cli` |

### Umgebungsvariablen für API:

```bash
# Für claude-api
export ANTHROPIC_API_KEY=sk-ant-xxxxx

# Für andere Provider
export OPENAI_API_KEY=sk-xxxxx
export GOOGLE_API_KEY=xxxxx
```

---

## Nützliche Pfade

| Was | Pfad |
|-----|------|
| **Projekt-Root** | `C:\Sources\OpenBotMan` |
| **Prompts** | `C:\Sources\OpenBotMan\prompts\` |
| **Diskussionen** | `C:\Sources\OpenBotMan\discussions\` |
| **Config** | `C:\Sources\OpenBotMan\config.yaml` |
| **CLI-Code** | `C:\Sources\OpenBotMan\packages\cli\` |

---

*Erstellt von AJBot am 2026-02-04*
