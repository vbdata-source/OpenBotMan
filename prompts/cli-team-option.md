# 📋 UMSETZUNGSANFRAGE: --team CLI-Option

## 🎯 Ziel
Die CLI soll eine `--team <team-id>` Option bekommen, um vordefinierte Agenten-Gruppen auszuwählen.

## 📋 Aktueller Stand

### Teams sind bereits in config.yaml definiert:
```yaml
teams:
  - id: full
    name: "🌟 Volles Team (4 Experten)"
    agents: [planner, coder, researcher, reviewer]
    default: true

  - id: quick
    name: "⚡ Schnelle Analyse"
    agents: [planner, reviewer]

  - id: code-review
    name: "💻 Code Review"
    agents: [coder, reviewer]

  - id: local-only
    name: "🏠 Nur Lokal (kostenlos)"
    agents: [coder, researcher]
```

### API-Server hat bereits Team-Support:
- `GET /api/v1/teams` - Listet verfügbare Teams
- Request Body kann `team: "quick"` enthalten

### CLI hat es NICHT:
```cmd
pnpm cli discuss "Test" --team local-only
# error: unknown option '--team'
```

## 🔧 Geplante Änderungen (AJBot's Plan)

### 1. Neue CLI-Option in discuss.ts:
```typescript
.option('--team <team-id>', 'Use predefined agent team (e.g., quick, code-review, local-only)')
```

### 2. Team-Lookup Funktion:
```typescript
function getTeamAgents(config: DiscussionConfig, teamId: string): string[] {
  const team = config.teams?.find(t => t.id === teamId);
  if (!team) {
    throw new Error(`Team "${teamId}" not found. Available: ${config.teams?.map(t => t.id).join(', ')}`);
  }
  return team.agents;
}
```

### 3. In getAgentsFromConfig():
- Wenn `--team` gesetzt: Nur Agents aus dem Team verwenden
- Wenn `--agents N` auch gesetzt: Kombination? Oder Fehler?

### 4. Team-Liste Befehl (optional):
```cmd
pnpm cli teams
# Zeigt verfügbare Teams mit Beschreibung
```

## ⚠️ Meine Bedenken

1. **Konflikt `--team` vs `--agents`:**
   - Was wenn beides gesetzt? `--team quick --agents 4`
   - Optionen: Error werfen, oder --team hat Vorrang?

2. **Default Team:**
   - Soll `default: true` aus Config respektiert werden?
   - Oder ist "alle Agents" der Default wenn nichts angegeben?

3. **Team nicht gefunden:**
   - Saubere Fehlermeldung mit Liste der verfügbaren Teams

4. **VSCode Extension:**
   - Hat bereits Team-Dropdown - nutzt API-Server
   - CLI sollte konsistent sein

## ❓ Fragen an die Spezialisten

1. Wie soll der Konflikt `--team` vs `--agents` gelöst werden?
2. Soll es einen `pnpm cli teams` Befehl geben, der verfügbare Teams listet?
3. Soll das Default-Team aus der Config automatisch verwendet werden?
4. Gibt es UX-Best-Practices für CLI-Optionen die sich gegenseitig ausschließen?
5. Sollte `--team` auch Kurzformen erlauben? (z.B. `--team q` für "quick")

## 📁 Betroffene Files
- `packages/cli/src/commands/discuss.ts` - Hauptlogik
- `packages/cli/src/cli.ts` - Command Definition
- Evtl. neuer Befehl `teams.ts`

## 📋 Kontext
- Version: 2.0.0-alpha.3
- VSCode Extension hat bereits Team-Support
- Nur CLI fehlt diese Funktion

---

*Erstellt: 2026-02-07 von AJBot*
