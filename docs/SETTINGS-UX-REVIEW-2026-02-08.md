# Settings-Seite UX-Review

**Datum:** 2026-02-08
**Team:** team-full-ux (5 Agents)
**Runden:** 10
**Status:** ⚠️ Kein formaler Konsens (4/5 SUPPORT_WITH_CONDITIONS)

---

## Zusammenfassung

Die Multi-Agent Diskussion analysierte die aktuelle Settings-Implementierung und lieferte konkrete Verbesserungsvorschläge. Der Workspace-Kontext (9 Dateien, 49KB) wurde erfolgreich geladen und von den Agents referenziert.

### Konsens-Essenz

> **"Sicherheit zuerst, dann UX, dann Enterprise. Iterativ entwickeln."**

---

## Priorisierte Roadmap

### 🔴 Phase 1: Kritische Sicherheit (vor Release)

| Maßnahme | Beschreibung |
|----------|--------------|
| CSRF-Protection | `csurf({ cookie: true })` für Browser-Clients |
| CORS-Whitelist | Aus `config.yaml` laden, kein `['*']` in Produktion |
| Path-Sanitizer | `path.resolve(BASE_DIR, userPath)` validieren |
| Atomic Writes | `.tmp` → `fsync` → `fs.renameSync` + `async-mutex` |
| Schema-Validation | AJV-Middleware für alle POST/PUT Endpoints |
| Rate-Limiting | Per API-Key + IP mit `rate-limit-flexible` |
| TLS-Enforcement | HTTPS erzwingen, `rejectUnauthorized: true` |

### 🟡 Phase 2: Logging & Monitoring (parallel zu UI)

| Maßnahme | Beschreibung |
|----------|--------------|
| Structured Logging | Winston mit JSON-Format, `requestId` |
| Log-Rotation | `winston-daily-rotate-file` |
| Prometheus-Metrics | `/metrics` Endpoint |
| Graceful Shutdown | `SIGTERM`/`SIGINT` Handler |

### 🟡 Phase 3: UX-Verbesserungen

| Maßnahme | Beschreibung |
|----------|--------------|
| Kategorisierung | Tabs: Allgemein, Sicherheit, Agenten, Erweitert |
| Progressive Disclosure | Erweiterte Einstellungen verstecken |
| Inline-Validation | AJV → sofortiges Feedback |
| Toast-Benachrichtigungen | Erfolg/Fehler visuell anzeigen |
| Mobile-First | Responsive Layout, Hamburger-Menu |
| Accessibility | ARIA-Labels, Fokus-Trap, Kontrast ≥ 4.5:1 |
| Internationalisierung | `i18next` mit `locales/de.json`, `locales/en.json` |
| Rollback | `config.yaml.<timestamp>.bak` + History-UI |

### 🟢 Phase 4: Enterprise & Architektur

| Maßnahme | Beschreibung |
|----------|--------------|
| RBAC | Rollen-basierte Zugriffskontrolle |
| Audit-Trail | Hash-Chain Logging |
| OpenAPI-Spec | `swagger-jsdoc` |
| Feature-Modules | `settings/`, `jobs/`, `agents/` |
| CI/CD | GitHub Actions: lint → test → build |

---

## Erkannte Lücken im aktuellen Code

| Bereich | Problem | Lösung |
|---------|---------|--------|
| Sicherheit | CSRF fehlt | `csurf` Middleware |
| Sicherheit | CORS `['*']` | Whitelist aus Config |
| Sicherheit | Path-Traversal | Pfad-Validierung |
| Performance | Sync FS I/O | `fs.promises` async |
| Performance | Jobs O(N) | Pagination / DB |
| Qualität | Kein zentrales Logging | Winston Logger |
| Qualität | Keine Unit-Tests | Jest für kritische Pfade |
| Qualität | Keine OpenAPI-Spec | swagger-jsdoc |

---

## UI-Mockups

### Desktop
```
+-----------------------------------------------------+
| OpenBotMan Einstellungen                            |
+-----------------------------------------------------+
| Suche: [                                        ]   |
+-----------------------------------------------------+
| Allgemein > | Sicherheit > | Agenten > | Erweitert |
+-----------------------------------------------------+
| Einstellungen (Sicherheit)                          |
+-----------------------------------------------------+
| TLS-Verschlüsselung: [X] Aktiviert                  |
| API-Key Rate Limit: [60] Requests / Minute          |
| CORS Whitelist: [example.com, ...]                  |
|                                                     |
| [Speichern] [Abbrechen]                             |
+-----------------------------------------------------+
```

### Mobile
```
+-----------------------+
| OpenBotMan            |
+-----------------------+
| [☰ Menu] [🔍 Search]  |
+-----------------------+
| **Sicherheit**        |
| TLS: [ON/OFF]         |
| Rate Limit: [60/min]  |
| CORS: [example.com]   |
+-----------------------+
| **Allgemein**         |
| **Agenten**           |
| **Erweitert**         |
+-----------------------+
| [💾 Speichern]        |
+-----------------------+
```

---

## Agent-Positionen

| Agent | Position | Fokus |
|-------|----------|-------|
| 🏗️ Strategic Planner | SUPPORT_WITH_CONDITIONS | Architektur, Enterprise, Modularität |
| 🔒 Security Expert | SUPPORT_WITH_CONDITIONS | Security-First, keine Kompromisse |
| 🎨 UX Designer | SUPPORT_WITH_CONDITIONS | Mobile-First, A11y, i18n |
| 💻 Senior Developer | CONCERN | Performance, Async FS (instabil) |
| 📊 Research Analyst | UNCLEAR | Timeout (LM Studio Context-Limit) |

---

## Code-Beispiele aus der Diskussion

### CSRF-Protection
```typescript
import csurf from 'csurf';
app.use(csurf({ cookie: true }));
```

### Path-Sanitizer
```typescript
const safePath = path.resolve(BASE_DIR, userPath);
if (!safePath.startsWith(BASE_DIR)) {
  throw new Error('Invalid path');
}
```

### Atomic Write + Mutex
```typescript
import { Mutex } from 'async-mutex';
const fileMutex = new Mutex();

async function writeAtomic(path: string, data: string) {
  await fileMutex.runExclusive(() => {
    const tmp = path + '.tmp';
    writeFileSync(tmp, data);
    renameSync(tmp, path);
  });
}
```

### Graceful Shutdown
```typescript
process.on('SIGTERM', async () => {
  await flushDatabase();
  server.close(() => process.exit(0));
});
```

### Rate-Limiting
```typescript
import rateLimit from 'express-rate-limit';
app.use(rateLimit({
  windowMs: 60_000,
  max: 60,
  keyGenerator: req => req.headers['x-api-key'] || req.ip
}));
```

---

## Bekannte Probleme mit lokalen Modellen

| Modell | Problem | Lösung |
|--------|---------|--------|
| `gpt-oss-20b` (LM Studio) | 300s Timeout, Context-Overflow | Größeres Context-Window oder schnelleres Modell |
| `qwen3-coder:30b` (Ollama) | Output-Loops, instabil | `maxTokens` limitieren oder alternatives Modell |

---

## Nächste Schritte

1. [ ] Phase 1 Security-Maßnahmen implementieren
2. [ ] Winston Logger einrichten
3. [ ] Unit-Tests für `config.ts`, `db.ts` schreiben
4. [ ] Settings-UI mit Kategorien refactoren
5. [ ] LM Studio Modell mit größerem Context laden

---

*Generiert durch OpenBotMan Multi-Agent Diskussion*
*Workspace-Kontext: 9 Dateien, 49KB*
