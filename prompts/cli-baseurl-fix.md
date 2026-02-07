# 📋 UMSETZUNGSANFRAGE: CLI baseUrl Bug Fix

## 🎯 Ziel
Der CLI-Befehl `pnpm cli discuss` soll auch mit OpenAI-kompatiblen APIs (LM Studio, etc.) funktionieren, die eine eigene `baseUrl` benötigen.

## 🐛 Aktuelles Problem
```
OpenAI API error (404): The model local-model does not exist
```
Die CLI ignoriert die `baseUrl` aus der Agent-Config und schickt Requests an die offizielle OpenAI API statt an den lokalen Server.

## 📁 Betroffene Files
- `packages/cli/src/commands/discuss.ts` - Hauptdatei mit dem Bug
- `packages/orchestrator/src/providers/factory.ts` - Provider Factory (zum Vergleich)

## 🔧 Geplante Änderung (AJBot's Plan)

In `discuss.ts`, Funktion `createAgentProvider()` (ca. Zeile 405):

**Vorher:**
```typescript
return createProvider({
  provider,
  model,
  apiKey,
  cwd,
  verbose,
  defaults
});
```

**Nachher:**
```typescript
return createProvider({
  provider,
  model,
  apiKey,
  baseUrl: agent.baseUrl,  // <-- DIESE ZEILE HINZUFÜGEN
  cwd,
  verbose,
  defaults
});
```

## ⚠️ Meine Bedenken
1. Gibt es noch andere Stellen in der CLI, die `baseUrl` brauchen aber nicht bekommen?
2. Sollte `baseUrl` auch für andere Provider (nicht nur openai) unterstützt werden?
3. Fehlt vielleicht auch Error-Handling wenn `baseUrl` gesetzt aber nicht erreichbar ist?

## ❓ Fragen an die Spezialisten
1. Ist mein Fix korrekt und vollständig?
2. Welche Seiteneffekte könnte ich übersehen haben?
3. Sollten wir einen Fallback oder Validierung für `baseUrl` einbauen?
4. Gibt es Best Practices für OpenAI-kompatible API Clients die wir beachten sollten?

## 📋 Kontext
- Config-Beispiel mit baseUrl:
  ```yaml
  discussion:
    agents:
      - id: researcher
        name: "Research Analyst"
        provider: openai
        model: local-model
        baseUrl: http://localhost:1234/v1
  ```
- API Server (`packages/api-server`) funktioniert bereits korrekt mit baseUrl
- Nur CLI hat das Problem

---

*Erstellt: 2026-02-07 von AJBot*
