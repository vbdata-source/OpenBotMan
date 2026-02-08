# Feature: Workspace-Kontext für Web-UI Diskussionen

## Problem

Aktuell können Agents in der Web-UI **nur den Topic-Text** sehen - sie haben keinen Zugriff auf den tatsächlichen Code! Die CLI hat `--workspace` und `--include`, aber die Web-UI nicht.

**Auswirkung:** Code-Reviews, Architektur-Analysen und Implementation-Feedback sind nicht möglich, weil die Agents den Code nicht sehen.

## Bestehendes Backend

Die Workspace-Logik existiert bereits in `packages/api-server/src/workspace.ts`:
- `loadWorkspaceContext(root, patterns, maxBytes)` - Lädt Dateien
- `formatWorkspaceContext(context)` - Formatiert für LLM
- Ignoriert automatisch: node_modules, dist, .git, binaries
- Max 100KB Kontext (konfigurierbar)

## Vorgeschlagene UI-Erweiterung

NewDiscussion-Seite erweitern um:

```
┌─────────────────────────────────────┐
│ Thema / Fragestellung               │
│ [Textarea für Frage/Prompt     ]    │
├─────────────────────────────────────┤
│ 📁 Workspace Pfad (optional)        │
│ [C:\Sources\MeinProjekt        ]    │
│ ℹ️ Lokaler Pfad zum Projekt         │
├─────────────────────────────────────┤
│ 📄 Datei-Pattern                    │
│ [**/*.ts, **/*.tsx             ]    │
│ ℹ️ Glob-Pattern für relevante Files │
├─────────────────────────────────────┤
│ Team auswählen                      │
│ [Radio-Buttons wie bisher      ]    │
└─────────────────────────────────────┘
```

## Fragen an die Experten

### Funktionalität
1. Soll der Workspace-Pfad **Pflicht** oder **optional** sein?
2. Standard-Pattern: `**/*.ts,**/*.tsx` oder leer?
3. Max. Kontext-Größe: 50KB, 100KB, oder einstellbar?

### UX
4. Wie zeigen wir dem User welche Dateien geladen werden? (Preview?)
5. Fehlermeldung wenn Pfad nicht existiert - inline oder Modal?
6. Soll es **Presets** geben? (z.B. "TypeScript Projekt", "Python Projekt")

### Sicherheit
7. Soll der Server beliebige Pfade lesen dürfen? Oder nur whitelisted?
8. Wie verhindern wir Leaks von sensiblen Dateien (.env, secrets)?
9. Brauchen wir ein zusätzliches Ignore-Feld für User?

### Technisch
10. API-Änderung: `POST /discuss` bekommt `workspace` + `include` Parameter
11. Timeout erhöhen wenn viel Kontext? (mehr Tokens = länger)
12. Caching von Workspace-Kontext bei mehreren Diskussionen?

### Alternativen
13. Statt Pfad-Eingabe: Datei-Upload im Browser?
14. Git-Repository URL statt lokalem Pfad?

Bitte konkrete Empfehlungen mit Begründung!
