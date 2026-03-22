# Realtime Discussion Matrix

## Context

Waehrend einer Diskussion sieht der User aktuell nur Text-Output und einen
einfachen Fortschrittsbalken. Es fehlt ein visueller Ueberblick ueber den
gesamten Diskussionsverlauf - welcher Agent was gemacht hat, welche Tools
genutzt wurden und wie die Stimmung pro Runde war.

**Ziel:** Eine Live-Matrix die den Diskussionsverlauf auf einen Blick zeigt.

**USP-Relevanz:** Staerkt das Alleinstellungsmerkmal "Multi-Agenten-Konsens" -
kein anderes Tool visualisiert Agenten-Interaktionen so transparent.

## Design-Skizze

```
┌─────────────────────────────────────────────────────────────┐
│  Diskussion: "Node.js 25 Features"          ⏱ 4:32  Runde 2/10  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Agent            │ Runde 1       │ Runde 2       │ Runde 3 │
│  ─────────────────┼───────────────┼───────────────┼─────────│
│  🎯 Planner       │ 🟡 PROPOSAL  │ 🟢 SUPPORT   │  ⏳     │
│     gemini-2.0    │              │              │         │
│                   │              │              │         │
│  💻 Developer     │ 🟡 COND.    │ 🟢 SUPPORT   │  ⏳     │
│     claude-4.5    │ 🔍🌐🌐     │ 🔍           │         │
│                   │              │              │         │
│  🔬 Researcher    │ 🟡 COND.    │ 🟡 COND.    │  💭     │
│     deepseek-r1   │              │              │         │
│                   │              │              │         │
│  🔍 Security      │ 🔴 CONCERN  │ 🟢 SUPPORT   │         │
│     qwen3         │              │              │         │
├─────────────────────────────────────────────────────────────┤
│  Legende: 🟢 Support  🟡 Conditions  🔴 Concern/Objection  │
│           🔍 Web Search  🌐 Web Fetch  📁 File Read         │
│           ⏳ Wartet  💭 Denkt nach  ✅ Fertig               │
└─────────────────────────────────────────────────────────────┘
```

## Daten-Anforderungen

### Job-Status API erweitern

Aktuell liefert `/api/v1/jobs/:id` pro Agent:
- name, role, status, durationMs, model, provider, responsePreview

**Neu benoetigt pro Agent PRO RUNDE:**
- position (SUPPORT/CONCERN/OBJECTION/PROPOSAL/SUPPORT_WITH_CONDITIONS)
- toolCalls: Array<{ name: string; success: boolean }>
- durationMs der Runde
- status in der aktuellen Runde (waiting/thinking/complete)

### Datenstruktur

```typescript
interface RoundAgentStatus {
  agentId: string;
  round: number;
  position?: ConsensusPosition;
  toolCalls?: Array<{ tool: string; success: boolean }>;
  durationMs?: number;
  status: 'waiting' | 'thinking' | 'tool-calling' | 'complete' | 'error';
}

// Im Job:
interface Job {
  // ... bestehende Felder
  roundMatrix?: RoundAgentStatus[][];  // [round][agentIndex]
}
```

## UI-Komponente

### `DiscussionMatrix.tsx`
- React-Komponente die die Matrix rendert
- Empfaengt Job-Daten via Props
- Farbkodierung:
  - 🟢 Gruen: SUPPORT
  - 🟡 Gelb: SUPPORT_WITH_CONDITIONS, PROPOSAL
  - 🔴 Rot: CONCERN, OBJECTION
  - Grau: ERROR, nicht teilgenommen
- Tool-Icons:
  - 🔍 web_search
  - 🌐 web_fetch / fetch
  - 📁 Datei-Tools (zukuenftig)
- Live-Status:
  - ⏳ Wartet (pulsierend)
  - 💭 Denkt nach (animiert)
  - 🔧 Tool wird aufgerufen (animiert)

### Integration
- In `JobView.tsx` einbinden (oberhalb des Text-Ergebnisses)
- In `Dashboard.tsx` als kompakte Version fuer laufende Jobs
- Polling alle 2 Sekunden fuer Live-Updates

## Implementierungs-Schritte

1. **API:** roundMatrix in Job-Datenstruktur + job status endpoint
2. **Server:** In runDiscussion pro Runde/Agent die Matrix befuellen
3. **UI:** DiscussionMatrix React-Komponente
4. **UI:** Integration in JobView und Dashboard
5. **Tests:** Bestehende Tests gruen, neue Tests fuer Matrix-Daten

## Abhaengigkeiten

- Keine neuen Pakete noetig
- Nutzt bestehende Job-Polling-Infrastruktur
- Bestehende Consensus-Positionen werden wiederverwendet

## Aufwand-Schaetzung

- API + Server: ~4h
- UI-Komponente: ~6h
- Integration + Tests: ~3h
- **Gesamt: ~1-2 Tage**
