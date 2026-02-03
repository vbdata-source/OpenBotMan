# Web-UI für OpenBotMan - Vollständige Anforderungen v2.1

## CREDO
> "Einfache Bedienung mit höchstem Komfort und voller Funktionalität!"

## 1. KONFIGURATION
- Agent-Editor (Name, Provider, Model, System-Prompt)
- Rollen-Editor (Coder, Reviewer, Architect, custom...)
- Zuweisung Rolle → Agent (Drag & Drop)
- **Profile speichern** ("REST-API Design Team", "Code Review Team")
- Profile kopieren & umbenennen
- Profile exportieren/importieren (JSON/YAML)

## 2. LIVE-DISKUSSION VISUALISIERUNG
- **Wer spricht gerade** (Avatar/Icon hervorgehoben)
- **Aktuelle Runde** (Round 2/5)
- **Konsens-Balken** (2 Support, 1 Concern, 0 Objection als visueller Balken)
- Position-Badges pro Agent (✅ ⚠️ ❌)
- Echtzeit-Typing-Indicator ("Coder analysiert...")

## 3. MODEL-MANAGEMENT
- **Model-Dropdown pro Agent** (claude-sonnet, claude-opus, gpt-4, gpt-4-turbo, gemini-flash, gemini-pro...)
- Automatische Model-Liste von Providern laden
- Model-Preise hinterlegen ($/1M tokens input/output)
- Favoriten-Modelle markieren

## 4. KOSTEN-TRACKING & ANALYTICS
- **Token-Zähler pro Diskussion** (Input/Output getrennt)
- **Kosten-Berechnung in Echtzeit** ("Diese Diskussion: $0.42")
- Kosten pro Agent sichtbar
- Kosten-Historie (Tag/Woche/Monat)
- **Budget-Limits** setzen (Warnung bei $10/Tag)
- Export für Buchhaltung (CSV)

## 5. ERGEBNIS-DARSTELLUNG & EXPORT
- **MD-File grafisch aufbereitet** anzeigen (nicht raw Markdown)
- Syntax-Highlighting für Code-Blöcke
- Konsens-Visualisierung (Diagramme, Badges)
- **Ein-Klick Copy to Clipboard** (gesamtes Ergebnis oder Teile)
- Export-Optionen: MD, PDF, HTML, JSON
- **Teilen-Link** generieren (read-only für Kollegen)
- Druckansicht optimiert

## 6. SECURITY & ENTERPRISE
- Web-UI **komplett deaktivierbar** (CLI-only Mode)
- Rollen-basierte Zugriffskontrolle (Admin vs. Viewer)
- Audit-Log in UI sichtbar
- API-Key Verschlüsselung

## 7. UX-KOMFORT
- Dark Mode / Light Mode
- Keyboard-Shortcuts (Ctrl+Enter = Start, Escape = Stop)
- Auto-Save von Drafts
- Undo/Redo für Config-Änderungen
- Responsive Design (Mobile-friendly)
- Onboarding-Tutorial für neue User

## 8. HISTORY & ANALYTICS
- Vergangene Diskussionen durchsuchen
- Konsens-Statistiken ("75% erreichen Konsens in Runde 2")
- Provider-Verbrauch (Tokens/Kosten pro Provider)
- Export als PDF/MD

---

## FRAGEN AN DAS EXPERTEN-TEAM

1. **Priorisierung:** Was ist MVP (Phase 1) vs Phase 2 vs Phase 3?
2. **Zeitaufwand:** Realistischer Zeitrahmen für jede Phase?
3. **Architektur:** Welche Anpassungen am bestehenden System sind nötig?
4. **Risiken:** Kritische technische oder Security-Risiken?
5. **Tech-Stack:** Bestätigt ihr React/Next.js + FastAPI oder gibt es bessere Alternativen für diese Anforderungen?
