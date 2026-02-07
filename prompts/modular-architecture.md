# 📋 ARCHITEKTUR-ANFRAGE: Modulare Entkopplung von Prompts, Agents und Teams

## 🎯 Ziel

Eine flexible, modulare Architektur für OpenBotMan, bei der:
- **Prompts** unabhängig und wiederverwendbar sind
- **Agents** austauschbare Komponenten haben (Prompt, Provider, Model)
- **Teams** eigene Konfigurationen pro Agent-Instanz haben können
- **Alles einfach und verständlich** für nicht-technische Benutzer bleibt

## 📋 Problemstellung

### Aktuelle Architektur (starr/monolithisch)
```yaml
agents:
  - id: researcher
    name: "Research Analyst"
    provider: openai
    model: local-model
    baseUrl: http://localhost:1234/v1
    systemPrompt: |
      Du bist ein Research-Analyst für Software...
      # Prompt ist FEST mit Agent verbunden!
```

### Probleme mit aktueller Architektur

1. **Prompts nicht wiederverwendbar:**
   - Gleicher "Researcher" braucht anderen Prompt für Business vs. Software
   - Aktuell: Agent kopieren und Prompt ändern = Redundanz

2. **Provider/Model nicht flexibel pro Kontext:**
   - Für schnelle Analysen: Gemini (schnell, günstig)
   - Für tiefe Analysen: Claude (gründlich)
   - Aktuell: Muss neuen Agent anlegen

3. **Teams sind nur Agent-Listen:**
   - Keine Möglichkeit, Agent-Parameter pro Team zu überschreiben
   - Aktuell: `agents: [planner, coder]` - keine Anpassungen

4. **Skaliert nicht für verschiedene Domänen:**
   - Software-Projekte, Business-Analyse, Legal-Review, Marketing, ...
   - Jede Domäne braucht andere Prompts, aber gleiche Rollen

## 🔧 Vorgeschlagene modulare Architektur

### Ebene 1: Prompts (wiederverwendbar)
```yaml
prompts:
  # Software-Kontext
  - id: software-researcher
    name: "Software Research Prompt"
    description: "Für technische Recherche und Analyse"
    text: |
      Du bist ein Research-Analyst für Software-Projekte.
      Fokus: Technische Machbarkeit, Alternativen, Best Practices.
      ...

  - id: software-developer
    name: "Senior Developer Prompt"
    text: |
      Du bist ein erfahrener Software-Entwickler.
      Fokus: Code-Qualität, Implementierung, Performance.
      ...

  # Business-Kontext
  - id: business-researcher
    name: "Business Research Prompt"
    text: |
      Du bist ein Business-Analyst.
      Fokus: Marktanalyse, ROI, Wettbewerber.
      ...

  - id: business-strategist
    name: "Business Strategy Prompt"
    text: |
      Du bist ein strategischer Berater.
      Fokus: Geschäftsmodelle, Skalierung, Partnerschaften.
      ...
```

### Ebene 2: Agents (Rollen mit Defaults)
```yaml
agents:
  - id: researcher
    role: researcher
    name: "Research Analyst"
    emoji: "🔬"
    # Defaults (können von Teams überschrieben werden)
    defaultPrompt: software-researcher
    defaultProvider: openai
    defaultModel: gpt-4

  - id: developer
    role: coder
    name: "Senior Developer"
    emoji: "💻"
    defaultPrompt: software-developer
    defaultProvider: claude-cli
    defaultModel: claude-sonnet-4

  - id: strategist
    role: architect
    name: "Strategic Planner"
    emoji: "🎯"
    defaultPrompt: software-strategist
    defaultProvider: google
    defaultModel: gemini-2.0-flash
```

### Ebene 3: Teams (Kombinationen mit Overrides)
```yaml
teams:
  # Software-Entwicklung
  - id: software-full
    name: "🖥️ Software Team (Voll)"
    description: "Alle Experten für Software-Projekte"
    agents:
      - agentId: strategist
        # Verwendet Agent-Defaults
      - agentId: developer
        # Verwendet Agent-Defaults
      - agentId: researcher
        # Verwendet Agent-Defaults
      - agentId: reviewer
        # Verwendet Agent-Defaults

  # Business-Analyse
  - id: business-analysis
    name: "💼 Business Team"
    description: "Für Geschäftsentscheidungen und Marktanalyse"
    agents:
      - agentId: strategist
        prompt: business-strategist      # Override!
        provider: claude-cli             # Override!
        model: claude-opus-4             # Besseres Model für Business
      - agentId: researcher
        prompt: business-researcher      # Anderer Prompt!
        provider: google
        model: gemini-2.0-flash

  # Lokale Entwicklung (kostenlos)
  - id: local-dev
    name: "🏠 Lokal (Kostenlos)"
    description: "Nur lokale LLMs, keine API-Kosten"
    agents:
      - agentId: developer
        provider: ollama
        model: qwen3-coder:30b
      - agentId: researcher
        provider: openai
        model: local-model
        baseUrl: http://localhost:1234/v1

  # Schnelle Code-Review
  - id: quick-review
    name: "⚡ Schnelle Review"
    description: "Nur Reviewer, schnellstes Model"
    maxRounds: 3  # Team-spezifische Limits
    timeout: 30
    agents:
      - agentId: reviewer
        provider: google
        model: gemini-2.0-flash
```

## ❓ Fragen an die Spezialisten

### Architektur & Design

1. **Ist die 3-Ebenen-Struktur (Prompts → Agents → Teams) sinnvoll?**
   - Oder brauchen wir mehr/weniger Ebenen?
   - Gibt es eine bessere Abstraktion?

2. **Wie sollen Defaults und Overrides funktionieren?**
   - Agent hat Defaults, Team kann überschreiben
   - Was wenn Team nichts angibt - immer Agent-Default?
   - Kaskade: Team → Agent → Global Defaults?

3. **Prompt-Vererbung/Komposition?**
   - Basis-Prompt + Kontext-spezifische Ergänzungen?
   - Oder immer vollständige Prompts?

### Implementierung

4. **Config-Struktur:**
   - Alles in einer `config.yaml`?
   - Oder aufteilen: `prompts.yaml`, `agents.yaml`, `teams.yaml`?
   - Oder Ordnerstruktur: `config/prompts/*.yaml`?

5. **Referenzierung:**
   - `prompt: software-researcher` (String-ID)
   - Oder `prompt: { ref: "software-researcher" }`?
   - Validierung: Was wenn referenzierter Prompt nicht existiert?

6. **Backward-Compatibility:**
   - Aktuelle Configs sollen weiter funktionieren
   - Migration-Pfad von alter zu neuer Struktur?

### Benutzeroberfläche

7. **VSCode Extension:**
   - Dropdown für Team-Auswahl ✅ (existiert)
   - Soll man Agents/Prompts/Provider ad-hoc ändern können?
   - "Advanced Mode" vs. "Simple Mode"?

8. **CLI:**
   - `--team business-analysis` wählt alles aus Team
   - Soll man überschreiben können? `--team business --provider claude`
   - `pnpm cli prompts` zum Listen?
   - `pnpm cli agents` zum Listen?

9. **Zukünftige CLI-UI:**
   - Interaktive Team/Agent-Auswahl?
   - Wizard für neue Teams/Prompts?
   - Wie bleibt es "nicht kompliziert"?

### Usability

10. **Für nicht-technische Benutzer:**
    - Wie erklärt man Prompts vs. Agents vs. Teams?
    - Naming: "Prompts" verständlich? Oder "Anweisungen"?
    - Soll die UI die Komplexität verstecken können?

11. **Preset-Bibliothek:**
    - Vordefinierte Prompts für häufige Domänen?
    - Community-Prompts importieren?
    - "Starter-Kits" für Software/Business/Legal/etc.?

### Performance & Skalierung

12. **Viele Prompts/Agents/Teams:**
    - Wie bleibt die Config übersichtlich bei 50+ Prompts?
    - Kategorisierung/Tagging?
    - Suche/Filter in UI?

13. **Lazy Loading:**
    - Alle Prompts beim Start laden?
    - Oder nur bei Bedarf?

### Erweiterte Konzepte

14. **Conditional Prompts:**
    - Prompt-Auswahl basierend auf Kontext?
    - z.B. "Wenn Frage Code enthält → use software-prompt"

15. **Prompt-Variablen:**
    ```yaml
    prompts:
      - id: researcher
        text: |
          Du bist ein Research-Analyst für ${DOMAIN}.
          Fokus: ${FOCUS_AREAS}
    ```
    - Teams könnten Variablen setzen?

16. **Agent-Ketten/Workflows:**
    - Agent A → Output → Agent B
    - Brauchen wir dafür separate Workflow-Definition?

## 📊 Beispiel-Szenarien

### Szenario 1: Software-Startup
```bash
pnpm cli discuss "Sollen wir React oder Vue verwenden?" --team software-full
# Verwendet: software-prompts, alle 4 Agents, Standard-Provider
```

### Szenario 2: Business-Entscheidung
```bash
pnpm cli discuss "Sollen wir in den US-Markt expandieren?" --team business-analysis
# Verwendet: business-prompts, strategist + researcher mit Business-Focus
```

### Szenario 3: Kostenlose lokale Analyse
```bash
pnpm cli discuss "Review dieses Codes" --team local-dev
# Verwendet: Ollama + LM Studio, keine API-Kosten
```

### Szenario 4: Ad-hoc Override
```bash
pnpm cli discuss "Frage" --team software-full --provider claude-cli
# Team software-full, aber alle Agents nutzen Claude CLI
```

## 🎯 Erfolgskriterien

1. **Einfachheit:** Basis-Nutzung so einfach wie jetzt
2. **Flexibilität:** Power-User können alles anpassen
3. **Konsistenz:** CLI, VSCode, API-Server gleiche Config
4. **Erweiterbarkeit:** Neue Domänen einfach hinzufügbar
5. **Übersichtlichkeit:** Config bleibt lesbar, auch bei vielen Einträgen

## 📁 Betroffene Bereiche

- Config-Struktur (`config.yaml` oder aufgeteilt)
- CLI (`discuss.ts`, neue Commands)
- API-Server (Team/Agent Resolution)
- VSCode Extension (UI für Auswahl)
- Dokumentation (Konzepte erklären)

## 📋 Kontext

- Version: 2.0.0-alpha.3
- Aktuell: Monolithische Agent-Definition
- Ziel: Modulare, wiederverwendbare Bausteine
- Wichtig: Muss für nicht-technische User verständlich bleiben

---

*Erstellt: 2026-02-07 von AJBot*
*Basierend auf Feedback von Juergen zur modularen Architektur*
