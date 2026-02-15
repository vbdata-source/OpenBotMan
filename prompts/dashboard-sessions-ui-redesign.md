# OpenClaw Dashboard — Sessions UI Redesign

## 🎯 Ziel

Wir wollen die Sessions-Ansicht im OpenClaw Dashboard komplett überarbeiten. Das aktuelle UI ist langweilig und unbrauchbar. Das neue UI soll einen **WOW-Effekt** erzeugen und echten Mehrwert bieten.

---

## 📊 Kontext: Was ist OpenClaw?

OpenClaw ist ein AI-Agent-System (basierend auf Claude), das über verschiedene Kanäle kommuniziert:
- **Telegram** — Chat mit dem Bot
- **MS Teams** — Business-Integration
- **Webchat** — Dashboard-integrierter Chat
- **Cron Jobs** — Automatisierte Tasks
- **Subagents** — Hintergrund-Aufgaben

Jede Konversation ist eine "Session" mit eigenem Kontext, Token-Verbrauch und History.

---

## 🔴 IST-Zustand (Problem)

### Screenshot der aktuellen UI:
```
Live Sessions
┌────────────────────────────────────────────────────────────┐
│ 0 NACHRICHTEN │ 441.5k TOKENS │ 5 KANÄLE │ 16 SESSIONS   │
├────────────────────────────────────────────────────────────┤
│ agent:main:main          telegram   Beendet  0 msg  59.8k │
│ c72b0992-01c9-4788-...   cron       Beendet  0 msg  15.4k │
│ 17d7586e-ac5a-4785-...   cron       Beendet              │
│ fab0c212-2c6a-4e83-...   cron       Beendet  15.4k tok   │
│ dashboard                webchat    Beendet  0 msg  975k  │
│ dashboard:job:ef762...   subagent   Beendet  0 msg  13.1k │
└────────────────────────────────────────────────────────────┘
```

### Probleme:
1. **Kryptische UUIDs** statt verständlicher Namen
2. **"0 msg" überall** — obwohl Nachrichten existieren (Bug)
3. **Nur "Beendet"** — kein Aktivitäts-Status, keine Timeline
4. **Kein Einblick** — kann nicht in die Session reinschauen
5. **Keine Kontext-Infos** — was wurde besprochen?
6. **Langweilig** — keine visuelle Hierarchie, kein WOW

---

## 🟢 Verfügbare Daten (API)

Die Backend-API liefert bereits umfangreiche Daten:

### Session-Liste (`sessions.list`):
```typescript
{
  key: "agent:main:main",              // Session-ID
  channel: "telegram",                  // Kanal
  displayName: "telegram:g-agent-...",  // Anzeigename
  deliveryContext: {
    channel: "telegram",
    to: "telegram:5249745642",          // User-ID/Empfänger
    accountId: "default"
  },
  updatedAt: 1771159467012,             // Letztes Update (Unix ms)
  model: "claude-opus-4-5",             // AI Model
  contextTokens: 200000,                // Max Context
  totalTokens: 116535,                  // Verbrauchte Tokens
  transcriptPath: "xxx.jsonl",          // Pfad zum Transcript
  messages: [                           // Letzte N Messages
    { role: "user", content: [...], timestamp: ... },
    { role: "assistant", content: [...], timestamp: ..., usage: {...} }
  ]
}
```

### Session-History (`sessions.history`):
```typescript
{
  sessionKey: "agent:main:main",
  messages: [
    {
      role: "user" | "assistant",
      content: [{ type: "text", text: "..." }, { type: "toolCall", ... }],
      timestamp: 1771159467607,
      model: "claude-opus-4-5",
      usage: {
        input: 10,
        output: 220,
        cacheRead: 116527,
        cost: { input: 0.00005, output: 0.0055, total: 0.067 }
      }
    }
  ]
}
```

### Verfügbare Informationen:
- ✅ Kanal (telegram, teams, webchat, cron, subagent)
- ✅ User-ID / Empfänger
- ✅ Timestamps (Start, letzte Aktivität)
- ✅ Token-Verbrauch + Kosten
- ✅ Model-Name
- ✅ Kompletter Chat-Verlauf
- ✅ Tool-Aufrufe (exec, read, write, etc.)
- ❓ User-Namen (nur IDs, kein Mapping zu Namen)

---

## 🎨 Gewünschtes Ergebnis

### Session-Liste (Übersicht):
- **Cards** statt langweilige Zeilen
- **Kanal-Icons** (📱 Telegram, 💼 Teams, 🤖 Cron, etc.)
- **User-Info** — Name oder ID, Avatar?
- **Status-Badges** — 🟢 Aktiv, 🟡 Idle, ⚪ Beendet
- **Letzte Nachricht** — Preview des letzten Messages
- **Key-Stats** — Messages, Tokens, Dauer
- **Sortierung** — Aktive zuerst, dann nach Zeit

### Session-Detail (Chat-Ansicht):
- **Chat-Bubbles** — User links, Bot rechts
- **Timestamps** — wann wurde was geschrieben
- **Tool-Calls** — collapsible, zeigen was der Bot gemacht hat
- **Stats-Header** — Tokens, Kosten, Dauer, Model
- **Suche** — in der Konversation suchen?

### Filter & Navigation:
- Nach Kanal filtern
- Nach Zeitraum filtern
- Suche über alle Sessions?

### Nice-to-have:
- Timeline-Visualisierung
- Kosten-Tracking pro Session/Tag
- Export (Markdown, PDF?)

---

## 🏗️ Technischer Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **State:** useState/useCallback (kein Redux)
- **API:** WebSocket zu OpenClaw Gateway
- **Styling:** Eigene CSS-Klassen mit `oc-` Prefix

---

## ❓ Fragen an die Experten

1. **UI/UX Design:**
   - Welche Layout-Varianten gibt es für Session-Listen? (Cards, Table, Timeline?)
   - Wie zeigt man am besten den Status einer Session an?
   - Wie viel Info in der Übersicht vs. Detail-Ansicht?

2. **Chat-Darstellung:**
   - Best Practices für Chat-UIs (Bubble-Style, Timestamps, etc.)?
   - Wie Tool-Calls darstellen ohne zu überladen?
   - Virtualisierung bei langen Chat-Verläufen?

3. **Performance:**
   - Lazy Loading für Session-Details?
   - Wie viele Sessions in der Liste ohne Performance-Probleme?
   - Caching-Strategien?

4. **WOW-Faktor:**
   - Was macht ein Session-Management-UI wirklich beeindruckend?
   - Welche Features würden einen "Das ist cool!"-Moment erzeugen?
   - Animationen, Transitions — ja oder übertrieben?

5. **Priorisierung:**
   - Was ist MVP (Minimum Viable Product)?
   - Was kommt in Phase 2?
   - Was ist Nice-to-have?

---

## 📋 Erwartetes Output

Bitte liefert:
1. **Konkretes UI-Konzept** — mit Mockups/ASCII-Art
2. **Komponenten-Struktur** — welche React-Komponenten?
3. **Priorisierte Feature-Liste** — MVP vs. Later
4. **Technische Empfehlungen** — Libraries, Patterns
5. **Potenzielle Fallstricke** — worauf achten?

---

*Erstellt: 2026-02-15*
*Projekt: OpenClaw Dashboard*
*Repo: github.com/vbdata-source/openclaw-dashboard*
