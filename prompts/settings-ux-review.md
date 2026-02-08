# UX-Review: OpenBotMan Settings-Seite

## Kontext

Die Settings-Seite wurde gerade implementiert mit:
- 5 Tabs: Agents | Prompts | Teams | Allgemein | API Key
- Modal-Dialoge für Create/Edit (Agents, Prompts, Teams)
- Live Prompt-Vorschau im Agent-Editor
- Lösch-Schutz für Prompts die in Verwendung sind

## Aktuelle UI-Elemente

### Agents Tab
- Liste aller Agents mit Emoji, Name, Provider/Model
- Tags für promptId, API-Key (maskiert), baseUrl
- Edit/Delete Buttons

### Prompts Tab
- Liste aller Prompts mit Name, Beschreibung, Kategorie
- Vorschau des Prompt-Texts (gekürzt)
- Anzeige welche Agents den Prompt verwenden

### Teams Tab
- Liste aller Teams mit Agent-Badges
- Default-Team hervorgehoben
- Multi-Select für Agent-Zuweisung

### Allgemein Tab
- Max. Runden, Timeout, Max. Kontext
- Einfache Input-Felder

## Fragen an die Experten

1. **Tab-Struktur:** Ist die Reihenfolge (Agents → Prompts → Teams) logisch? Oder sollte es anders sein?

2. **Feedback & States:** Fehlen Erfolgsmeldungen nach dem Speichern? Wie sollten Lade-Zustände aussehen?

3. **Validierung:** Wie sollten Eingabefehler angezeigt werden? Inline oder als Toast?

4. **Modal-Design:** Sind die Edit-Dialoge übersichtlich? Was fehlt?

5. **Barrierefreiheit:** Keyboard-Navigation, Screen-Reader, Kontraste - was muss verbessert werden?

6. **Mobile:** Wie sollte die Settings-Seite auf dem Handy aussehen?

7. **Onboarding:** Brauchen neue Nutzer Hilfe-Texte oder Tooltips?

Bitte konkrete Verbesserungsvorschläge mit Priorität (High/Medium/Low)!
