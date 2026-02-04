# Anfrage: Web-UI Konfigurations- und Verwaltungs-Features

## Kontext

Wir planen eine Web-UI für OpenBotMan. Die Live-Diskussions-Ansicht wurde bereits konzipiert. 
Jetzt geht es um die **Konfigurations- und Verwaltungs-Features**.

## Motto

**"Einfachheit kombiniert mit absoluter Leistung und Bedienerfreundlichkeit"**

Der User soll das Programm einfach benutzen können — keine Kommandozeile, keine YAML-Dateien editieren.

## Gewünschte Features

### 1. Agent-Verwaltung
- Agents erstellen, bearbeiten, löschen
- Name, Rolle, System-Prompt konfigurieren
- Provider auswählen (Claude, OpenAI, Gemini, Ollama)
- Capabilities aktivieren/deaktivieren

### 2. Model-Auswahl
- **Dropdown/Combobox** für Modelle
- **Automatisch vom Provider abfragen** (nicht hardcoded!)
- Zeige verfügbare Modelle basierend auf API-Key/Auth
- Modell-Infos: Kosten/Token, Context-Window, Capabilities

### 3. Team-Builder
- Visueller Editor: Wer nimmt an Diskussion teil?
- Drag & Drop von Agents ins Team
- Rollen zuweisen (Architect, Coder, Reviewer, etc.)
- Team-Größe und Konsens-Schwelle konfigurieren

### 4. Team-Templates (Wiederverwendbarkeit)
- Definierte Teams **speichern** unter einem Namen
- Teams **laden** für neue Diskussionen
- Teams **exportieren/importieren** (JSON)
- Beispiel: "Security-Review-Team", "Architecture-Design-Team"

### 5. Kosten-Tracking
- Token-Verbrauch pro Session (Input/Output)
- Kosten in USD anzeigen (basierend auf Provider-Preisen)
- Historische Kosten (Tag/Woche/Monat)
- Budget-Warnung wenn Limit erreicht

### 6. Einstellungen
- API-Keys sicher verwalten (verschlüsselt)
- Default-Werte für neue Diskussionen
- Dark Mode / Light Mode
- Sprache (Deutsch/Englisch)

## Fragen an das Team

1. **UI-Konzept:** Wie sollte die Config-Oberfläche aussehen? (Wireframe/ASCII)
2. **UX-Flow:** Wie erstellt ein User ein neues Team in 3 Klicks?
3. **Model-Discovery:** Wie fragen wir verfügbare Modelle automatisch ab?
4. **Persistenz:** Wo speichern wir Teams/Configs? (LocalStorage, DB, Dateien?)
5. **Security:** Wie schützen wir API-Keys in der Web-UI?

## Randbedingungen

- MVP-First: Was ist das Minimum für v1.0?
- Ein Entwickler (Juergen + AJBot)
- TypeScript/Next.js Stack (bereits entschieden)
- Desktop-First, später Mobile
