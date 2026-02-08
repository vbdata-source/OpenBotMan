# Web-Search Integration für OpenBotMan

## Kontext

OpenBotMan ist ein Multi-Agent-Orchestrator, bei dem mehrere KI-Agents (Claude, Gemini, Ollama, etc.) zu einem Thema diskutieren und einen Konsens finden. 

**Problem:** Die Agents haben nur Trainingswissen - keine aktuellen Informationen. Für viele Diskussionen wäre aktuelles Web-Wissen hilfreich.

## Ziel

Agents sollen **aktuelle Web-Informationen** erhalten können, bevor sie diskutieren.

## Technische Rahmenbedingungen

- **API Server:** Express.js (TypeScript)
- **Aktueller Discuss-Endpoint:** `POST /api/v1/discuss`
- **Request-Body aktuell:**
  ```typescript
  {
    topic: string;
    teamId?: string;
    maxRounds?: number;
    workspace?: string;      // Optional: Pfad zu Code
    include?: string[];      // Glob patterns
    ignore?: string[];       // Exclude patterns
  }
  ```
- **Bestehende Context-Logik:** Workspace-Dateien werden als "Code-Kontext" an Agents übergeben

## Mögliche APIs

| API | Free Tier | Preis danach |
|-----|-----------|--------------|
| **Brave Search** | 2000/Monat | $5/1000 |
| Tavily | 1000/Monat | $5/1000 |
| SerpAPI | 100/Monat | $50/5000 |

## Optionen zur Diskussion

### Option A: Pre-Search (vor Diskussion)

```
POST /api/v1/discuss
{
  topic: "...",
  webSearch: true,           // NEU
  searchQuery?: "...",       // Optional: Custom Query
  searchResultCount?: 5      // Optional: Anzahl
}
```

Flow:
1. API erhält Request
2. Wenn `webSearch: true` → Brave API call
3. Top-N Snippets als zusätzlicher Context
4. Agents erhalten: Topic + Web-Snippets + (optional) Code-Context

### Option B: Separater Search-Endpoint

```
POST /api/v1/search
{ query: "..." }
→ Returns: { results: [...] }

POST /api/v1/discuss
{
  topic: "...",
  searchContext: "..." // Vorher geholte Ergebnisse
}
```

### Option C: Search-Agent

Ein dedizierter Agent der nur für Web-Suche zuständig ist:
- Erhält Topic
- Formuliert Suchqueries
- Ruft Brave API auf
- Fasst Ergebnisse zusammen
- Andere Agents erhalten die Zusammenfassung

### Option D: On-Demand Search

Agents können während der Diskussion Suchen anfordern:
```
[SEARCH: "latest TypeScript 5.4 features"]
```
Orchestrator erkennt das Pattern, führt Suche durch, injiziert Ergebnisse.

## Fragen an die Experten

1. **Welche Option ist am besten?** (Einfachheit vs. Flexibilität vs. Qualität)

2. **Wie soll der Search-Context formatiert werden?**
   - Markdown mit Quellen?
   - Strukturiertes JSON?
   - Kurze Snippets vs. vollständige Artikel?

3. **Soll die Suche optional oder default sein?**

4. **Wie mit API-Limits umgehen?**
   - Rate-Limiting?
   - Caching?
   - User-eigene API-Keys?

5. **UI/UX in der Web-UI:**
   - Checkbox "Web-Recherche aktivieren"?
   - Eigenes Query-Feld?
   - Vorschau der Suchergebnisse?

## Erwartetes Ergebnis

Konkreter Implementierungsplan mit:
- Gewählte Option + Begründung
- API-Änderungen (Endpoints, Request/Response)
- Context-Format für Agents
- UI-Änderungen
- Geschätzter Aufwand
