# OpenBotMan VSCode Extension: Design & Architektur

## Kontext
OpenBotMan ist ein Multi-Agent-Tool das verschiedene LLMs (Claude, GPT, Gemini) als Experten-Panel koordiniert. Es gibt bereits eine funktionierende CLI mit:
- `--workspace` und `--include` für Projekt-Kontext
- Konsens-basierte Diskussionen
- Markdown-Output

## Ziel
Eine VSCode Extension die OpenBotMan nahtlos in den Entwickler-Workflow integriert.

## Use-Case (WOW-Erlebnis)
1. Entwickler arbeitet in VSCode mit Gemini/Codex als Coding-Partner
2. Will ein Feature implementieren (z.B. "User Authentication")
3. **BEVOR** er Gemini/Codex fragt: Triggert OpenBotMan
4. Experten analysieren Code + diskutieren (30-60 Sek)
5. Strukturierter Plan erscheint im Panel
6. "Copy to Clipboard" → Entwickler gibt Plan an Gemini/Codex
7. Gemini/Codex implementiert nach Experten-Guidance

## Zu analysierende Fragen

### 1. Extension-Architektur
- Wie kommuniziert die Extension mit OpenBotMan CLI?
- Subprocess vs. Language Server Protocol?
- Wie zeigen wir Live-Status während der Analyse?

### 2. User Interface
- Command Palette Commands?
- Sidebar Panel?
- Wo erscheint das Ergebnis (Panel, Editor, Webview)?
- Input-Dialog für das Thema?

### 3. Workspace-Integration
- Wie sammeln wir automatisch Kontext?
- Welche Dateien includen wir by default?
- Respektieren wir .gitignore?

### 4. Output-Format für LLMs
- Wie strukturieren wir das Ergebnis für Gemini/Codex?
- Markdown mit klaren Sektionen?
- Code-Beispiele ready-to-use?
- "Copy to Clipboard" Funktionalität?

### 5. Konfiguration
- Settings für API-Keys, Models?
- Default-Agenten konfigurierbar?
- Projekt-spezifische Einstellungen (.vscode/openbotman.json)?

### 6. Error-Handling
- Was wenn CLI nicht installiert?
- Was wenn ein Agent fehlschlägt?
- Timeout-Handling für lange Analysen?

## Technische Randbedingungen
- TypeScript (konsistent mit CLI)
- VSCode Extension API
- Bestehende CLI wrappen (nicht neu schreiben)
- Muss mit Windows, macOS, Linux funktionieren

## Erwartetes Ergebnis
- Empfohlene Architektur
- UI/UX Design-Entscheidungen
- Implementierungs-Roadmap
- Kritische Risiken und Mitigationen
