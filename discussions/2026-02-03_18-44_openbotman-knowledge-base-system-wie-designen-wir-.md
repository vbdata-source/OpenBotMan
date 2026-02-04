# Discussion: OpenBotMan Knowledge Base System: Wie designen wir ein System, das Experten-Agenten Zugriff auf projektspezifisches Wissen gibt? Anforderungen: 1) CLI: --context file.md, --context-dir ./docs/, --crawl URL, 2) UI: Knowledge Folders verwalten, Dateien hochladen (PDF/MD/TXT/Code), URLs crawlen, 3) Smart: Auto-Relevanz (nur relevante Chunks an Agenten), Pre-Processing (Embeddings, Summaries), Knowledge-Profiles pro Team, 4) Tokens sparen durch intelligentes Chunking. Fragen: Architektur? RAG vs. Full-Context? Embedding-Modell? Storage (Vector DB)? MVP-Scope? Zeitaufwand?

**Date:** 2026-02-03 18:44
**Participants:** Senior Developer (claude-sonnet-4-20250514), Security & Quality Expert (claude-sonnet-4-20250514), Strategic Planner (gemini-2.0-flash)
**Rounds:** 1
**Status:** ✅ CONSENSUS REACHED
**Duration:** 94s

---

## Round 1/5

### [Strategic Planner] 🎯 ARCHITECT (gemini-2.0-flash via API)

Okay, hier ist ein erster Vorschlag für das Design des Knowledge-Base-Systems für OpenBotMan, unter Berücksichtigung der gegebenen Anforderungen und Fragen.

**Ziel:** Ein System, das es Experten-Agenten ermöglicht, auf projektspezifisches Wissen zuzugreifen, um ihre Aufgaben effektiver zu erfüllen, während gleichzeitig Token-Limits berücksichtigt und die Relevanz sichergestellt wird.

**Architektur:** Retrieval Augmented Generation (RAG)

```
                                  +---------------------+
                                  |     User Query      |
                                  +--------+------------+
                                           |
                                           V
                                  +---------------------+
                                  |  Query Re-Formulator | (optional)
                                  +--------+------------+
                                           |
                                           V
                                  +---------------------+
                                  |   Knowledge Retriever |
                                  +--------+------------+
                                           |
                       +-------------------+-------------------+
                       |                   |                   |
                       V                   V                   |
              +-----------------+   +-----------------+   |
              |  Vector Database  |   |  Metadata Store |   |
              +--------+--------+   +--------+--------+   |
                       |                   |                   |
                       +-------------------+-------------------+
                                           |
                                           V
                                  +---------------------+
                                  | Contextualized Data  |
                                  +--------+------------+
                                           |
                                           V
                                  +---------------------+
                                  |    LLM Agent        |
                                  +--------+------------+
                                           |
                                           V
                                  +---------------------+
                                  |     Response        |
                                  +---------------------+
```

**Begründung:**

*   **RAG (Retrieval Augmented Generation) vs. Full-Context:** RAG bietet einen guten Kompromiss zwischen Genauigkeit, Token-Effizienz und Skalierbarkeit.  Full-Context (alles in den Prompt laden) ist bei großen Wissensbasen unpraktikabel und teuer. RAG erlaubt es uns, nur das relevante Wissen in den Kontext zu laden.
*   **Architektur-Diagramm:** Das Diagramm visualisiert den Datenfluss:  Die Anfrage wird (optional) umformuliert, um die Retrieval-Genauigkeit zu verbessern.  Ein "Knowledge Retriever" sucht in der Vektor-Datenbank und im Metadata-Store nach relevanten Informationen. Die gefundenen Daten werden contextualisiert und an den LLM-Agenten übergeben, der die Antwort generiert.

**Komponenten:**

1.  **Datenaufnahme (Ingestion):**
    *   **CLI:**
        *   `--context file.md`:  Liest den Inhalt einer einzelnen Markdown-Datei.
        *   `--context-dir ./docs/`:  Liest alle unterstützten Dateien (PDF, MD, TXT, Code) in einem Verzeichnis.
        *   `--crawl URL`:  Crawlt eine Website und extrahiert Textinhalte. (Achtung: Roboter-Regeln beachten!).
    *   **UI:**
        *   Verwaltung von Knowledge Folders (logische Gruppierung von Wissen).
        *   Datei-Upload (PDF, MD, TXT, Code).
        *   URL-Crawling.
2.  **Pre-Processing:**
    *   **Chunking:**  Dokumente werden in kleinere Chunks aufgeteilt.  Intelligentes Chunking berücksichtigt semantische Grenzen (z.B. Überschriften, Absätze), um die Kohärenz zu erhalten. Ziel ist es, die für die Vektor-Datenbank optimalen Chunks zu erzeugen.
    *   **Embedding:**  Chunks werden in Vektoren umgewandelt, die ihre semantische Bedeutung repräsentieren.
    *   **Summarization (Optional):**  Größere Dokumente können zusammengefasst werden, um einen Überblick zu erhalten.  Dies kann als zusätzliche Information für den Retrieval-Prozess dienen.
    *   **Metadata Extraction:**  Extrahieren von Metadaten wie Titel, Autor, Datum, Keywords, um die Suche zu verbessern.
3.  **Speicherung:**
    *   **Vector Database:**  Speichert die Vektoren (Embeddings) der Chunks.  Geeignete Optionen sind:
        *   **ChromaDB:** Einfach einzurichten, Open-Source, gut für Prototypen.
        *   **Pinecone:**  Managed Service, skalierbar, teurer.
        *   **Weaviate:**  Open-Source, flexibel, erfordert mehr Konfiguration.
    *   **Metadata Store:** Speichert die Metadaten der Dokumente und Chunks (z.B. Dateiname, Chunk-Nummer, Zusammenfassung). Eine einfache relationale Datenbank (SQLite, PostgreSQL) oder auch eine NoSQL-Datenbank (MongoDB) sind hierfür geeignet.
4.  **Retrieval:**
    *   **Semantic Search:**  Verwendet die Vektor-Datenbank, um die relevantesten Chunks basierend auf der semantischen Ähnlichkeit zur Anfrage zu finden.
    *   **Metadata Filtering:**  Filtert die Suchergebnisse basierend auf Metadaten (z.B. Knowledge Folder, Dateityp).
    *   **Re-Ranking:**  Ordnet die Suchergebnisse neu, um die relevantesten Chunks nach oben zu bringen.
5.  **Contextualization:**
    *   Die abgerufenen Chunks werden mit zusätzlichen Informationen (z.B. Dateiname, Zusammenfassung) angereichert, um den Kontext für den Agenten zu verbessern.
6.  **Agent Integration:**
    *   Der Orchestrator übergibt die Anfrage des Benutzers zusammen mit den contextualisierten Chunks an den ausgewählten Agenten.
    *   Der Agent verwendet das Wissen aus den Chunks, um die Anfrage zu beantworten.
7.  **Knowledge Profiles:**
    *   Profile, die festlegen, welche Wissensquellen (Knowledge Folders, Websites) für bestimmte Teams oder Rollen relevant sind.  Dies kann durch Metadaten-Filterung im Retrieval-Prozess implementiert werden.

**Embedding-Modell:**

*   **OpenAI Embeddings (text-embedding-ada-002):**  Hohe Qualität, kostenpflichtig.
*   **Sentence Transformers (all-mpnet-base-v2):**  Open-Source, gute Performance, kann lokal ausgeführt werden.
*   Die Wahl hängt von den Budget- und Performance-Anforderungen ab. Für ein MVP würde ich mit Sentence Transformers beginnen.

**MVP-Scope:**

*   CLI-Unterstützung für `--context file.md` und `--context-dir ./docs/`.
*   Unterstützung für Markdown- und Textdateien.
*   Verwendung von Sentence Transformers (all-mpnet-base-v2) für Embeddings.
*   Verwendung von ChromaDB als Vektor-Datenbank.
*   Einfache Metadaten-Speicherung (z.B. JSON-Datei pro Dokument).
*   Fokus auf Semantic Search ohne Re-Ranking.
*   Keine UI im ersten Schritt.
*   Keine Knowledge Profiles im ersten Schritt.

**Zeitaufwand (Schätzung):**

*   MVP: 2-4 Wochen (1-2 Entwickler).
*   UI, Knowledge Profiles, erweiterte Funktionen: +4-6 Wochen.

**Offene Fragen:**

*   Wie detailliert sollen die Knowledge Profiles sein? (Benutzer, Teams, Rollen, Projekte?)
*   Wie soll das intelligente Chunking implementiert werden? (Bibliothek verwenden, eigene Logik?)
*   Wie wichtig ist die Performance? (Beeinflusst die Wahl der Vektor-Datenbank und des Embedding-Modells).

**Zusammenfassung:**

Dieser Vorschlag skizziert ein RAG-basiertes Knowledge-Base-System für OpenBotMan. Der Fokus liegt auf einer inkrementellen Entwicklung mit einem MVP, das die grundlegenden Funktionen abdeckt. Die Architektur ist flexibel genug, um später erweiterte Funktionen wie UI, Knowledge Profiles und intelligentes Chunking hinzuzufügen. Die Wahl der Komponenten (Embedding-Modell, Vektor-Datenbank) hängt von den spezifischen Anforderungen und Budgetbeschränkungen ab.

[POSITION: PROPOSAL]


**Position:** 💡 PROPOSAL

### [Senior Developer] 💻 CODER (claude-sonnet-4-20250514 via CLI)

Als erfahrener Developer analysiere ich den Architektur-Vorschlag kritisch:

## Technische Bewertung

**Gut durchdacht:**
- RAG-Ansatz ist richtig - Full-Context würde bei >100k Tokens explodieren
- ChromaDB als MVP-Choice ist solid - einfaches Setup, keine Cloud-Dependencies
- Sentence Transformers lokal = keine API-Kosten und Datenschutz

**Implementierungs-Realität:**

**1. Chunking ist komplexer als dargestellt**
```python
# Naive Chunking (schlecht):
chunks = text.split('\n\n')  

# Intelligentes Chunking (aufwändig):
# - Markdown-Header respektieren
# - Code-Blöcke zusammenhalten  
# - Overlap zwischen Chunks
# - Optimale Token-Länge pro Embedding-Modell
```
**Aufwand:** +1-2 Wochen nur für robustes Chunking.

**2. CLI-Integration unterschätzt**
Die bestehende `cli_runners.py` müsste komplett erweitert:
```python
# Aktuell:
cmd = [agent_config['cli']] + args + [prompt]

# Neu mit Context:
cmd = [agent_config['cli']] + args + 
      ['--context'] + context_chunks + [prompt]
```
**Problem:** Verschiedene CLIs haben unterschiedliche Context-Parameter. Claude Code CLI hat andere Syntax als Gemini CLI.

**3. Token-Budget Management fehlt**
```python
# Essentiell für Produktivität:
def calculate_context_budget(agent_model, user_prompt):
    max_tokens = MODEL_LIMITS[agent_model]
    prompt_tokens = count_tokens(user_prompt) 
    available_for_context = max_tokens - prompt_tokens - response_buffer
    return min(available_for_context, MAX_CONTEXT_TOKENS)
```

**4. Vector DB Performance in der Praxis**
ChromaDB ist gut für MVP, aber:
- >10k Dokumente = langsame Queries
- Keine persistente Indizierung out-of-box
- Memory-hungry bei größeren Embeddings

## Konkrete Implementierungs-Reihenfolge

**Phase 1 (1 Woche):**
```python
# Minimaler Proof-of-Concept
def simple_context_injection(files: List[str], prompt: str):
    context = "\n".join([read_file(f) for f in files[:3]])  # Max 3 files
    enhanced_prompt = f"Context:\n{context}\n\nTask: {prompt}"
    return enhanced_prompt
```

**Phase 2 (2-3 Wochen):**
- ChromaDB Integration
- Basic Chunking (fixed size mit overlap)
- CLI Parameter `--context-dir`

**Phase 3 (3-4 Wochen):**
- Intelligent Chunking
- Relevance Scoring
- Token Budget Management

## Kritische Fragen

**1. Performance-Erwartung:**
- Wie viele Dokumente? 100 oder 10.000?
- Query-Latenz Toleranz? <1s oder <5s OK?

**2. Maintenance-Aufwand:**
- Wer updated Embeddings bei Dokumenten-Änderungen?
- Re-Indexing Strategy?

**3. Error Handling:**
```python
# Was passiert wenn:
- ChromaDB offline ist?
- Embedding-Model failed zu laden?
- Retrieval 0 Results zurückgibt?
```

## Alternativ-Vorschlag für MVP

**Einfacher Start:** File-based Context ohne Vector DB
```python
# OpenBotMan CLI Extension:
python orchestrator.py --context-files "docs/*.md,api/*.json" "Implement auth"

# Intern:
context = smart_file_selector(files, max_tokens=4000)
prompt_with_context = f"{context}\n\n{user_prompt}"
```

**Vorteile:**
- 0 Dependencies
- Sofort funktionsfähig
- Später zu RAG ausbaubar

## Risiko-Bewertung

**Hoch:** Chunking-Qualität entscheidet über Nutzen
**Mittel:** Performance bei skalierendem Content
**Niedrig:** ChromaDB Integration (gut dokumentiert)

**Zeit-Schätzung realistisch:**
- MVP (file-based): 1 Woche
- RAG-System: 3-4 Wochen  
- Production-ready: 6-8 Wochen

Der Vorschlag ist technisch sound, aber die Implementierungs-Komplexität wird unterschätzt. Chunking und Token-Management sind die kritischen Erfolgsfaktoren.

[POSITION: SUPPORT_WITH_CONDITIONS] - Brauchen Phase-1 MVP ohne Vector DB, robustes Token-Budget-System und realistische 4-6 Wochen Aufwand

**Position:** ☑️ SUPPORT_WITH_CONDITIONS - Brauchen Phase-1 MVP ohne Vector DB, robustes Token-Budget-System und realistische 4-6 Wochen Aufwand

### [Security & Quality Expert] 🔍 REVIEWER (claude-sonnet-4-20250514 via CLI)

## Kritische Code-Review-Analyse des Knowledge Base Systems

Als kritischer Code-Reviewer und Security-Experte sehe ich mehrere **kritische Schwachstellen** in diesem Vorschlag, die vor der Implementierung unbedingt adressiert werden müssen.

### 🚨 KRITISCHE SICHERHEITSLÜCKEN

**1. Input Validation & Injection Attacks**
- `--crawl URL`: **KEINE** URL-Validation erwähnt → SSRF-Vulnerabilities
- File Upload UI: **KEINE** Content-Type-Validation → Malicious File Execution
- Chunk Processing: **KEINE** Sanitization → Prompt Injection über Dokumente

**2. Resource Exhaustion**
```python
# GEFAHR: Unbegrenzte Speicher-Allokation
def chunk_document(file_content):  # File könnte 10GB sein!
    chunks = split_by_sentences(file_content)  # Memory-Bomb
```

**3. Unvalidierte Embedding-Pipeline**
- Sentence Transformers: **KEINE** Input-Size-Limits
- ChromaDB: **KEINE** Rate-Limiting oder Storage-Quotas

### ⚠️ PERFORMANCE & RELIABILITY RISKS

**Chunking-Algorithmus unspezifiziert:**
```yaml
# PROBLEM: "Intelligentes Chunking" - WAS bedeutet das konkret?
chunk_strategy: "semantic_boundaries"  # Vage!
max_chunk_size: ???  # Token-Limit unklar
overlap_strategy: ???  # Context-Loss-Risiko
```

**Vector Search Performance:**
- **KEINE** Latenz-Requirements definiert (>5s = User-Frustration)
- ChromaDB bei >1M Chunks? Performance-Kollaps vorprogrammiert
- **KEINE** Caching-Strategie für häufige Queries

### 🔍 EDGE-CASES & FEHLERSZENARIEN

**1. Corrupted Embeddings:**
```python
# Was passiert wenn Embedding fehlschlägt?
try:
    embedding = model.encode(chunk)
except Exception as e:  # Chunk verloren? System-Crash?
    # Fehlende Error-Recovery-Strategie
```

**2. Inconsistent Knowledge:**
- Dokument wird während Chunking geändert → Orphaned Chunks
- ChromaDB und Metadata-Store out-of-sync → Falsche Retrievals

**3. Knowledge Profile Confusion:**
```python
# GEFAHR: Agent bekommt falsches Wissen
if user.team == "frontend" but query.contains("database"):
    # Welche Knowledge Profile gelten? Konflikt-Resolution?
```

### 💰 COST & COMPLIANCE ISSUES

**Token-Explosion:**
- "Nur relevante Chunks" - **WIE** wird Relevanz gemessen? 
- Threshold-Werte fehlen → Potentiell 50k Token pro Query
- OpenAI Embeddings: $0.0004/1k tokens → bei 1M Chunks = $400/Monat

**DSGVO/Privacy:**
- Crawled Content: Urheberrechte? Robots.txt-Compliance?
- User-Uploads: PII-Detection? Data-Retention-Policies?

### 🛠️ FEHLENDE MITIGATIONEN

**1. Input Validation Framework**
```python
class SecureKnowledgeIngestion:
    def validate_url(self, url: str) -> bool:
        # Whitelist domains, block private IPs
    
    def sanitize_content(self, content: str) -> str:
        # Remove malicious patterns, size limits
```

**2. Resource Monitoring**
```yaml
resource_limits:
  max_file_size: 100MB
  max_chunks_per_document: 1000
  embedding_timeout: 30s
  vector_search_timeout: 5s
```

**3. Graceful Degradation**
- Fallback bei ChromaDB-Ausfall → Keyword-Search
- Partial Results bei Timeout → Top-N statt komplette Suche

### 🎯 REALISTISCHE MVP-REQUIREMENTS

**Security-First MVP:**
1. **File-Type-Whitelist:** Nur .md, .txt (PDF später)
2. **Size-Limits:** Max 10MB pro File, Max 100 Files
3. **Local-Only:** Kein URL-Crawling im MVP (Security-Risk)
4. **Simple Auth:** API-Key für CLI-Access

**Performance-Messbar:**
- Vector Search: <2s für 90% der Queries
- Memory Usage: <1GB für 10k Chunks
- Storage: <100MB für Embeddings

### ⏱️ REALISTISCHE ZEITSCHÄTZUNG

Original: 2-4 Wochen → **UNREALISTISCH**

**Meine Schätzung:**
- Security Framework: +2 Wochen
- Robuste Error Handling: +1 Woche  
- Performance Testing: +1 Woche
- **Realistischer MVP: 6-8 Wochen**

### 🎯 CONCRETE ACTION ITEMS

1. **Security Design Doc:** OWASP-Guidelines für File-Upload & URL-Processing
2. **Performance Benchmarks:** Definiere messbare SLAs 
3. **Error Recovery Matrix:** Jeder Failure-Point braucht Recovery-Strategy
4. **Resource Monitoring:** Memory/CPU/Storage-Alerts

**Bottom Line:** Der Architektur-Ansatz ist solide, aber die **Implementierungs-Details sind kritisch unterspecified**. Ohne Security-Framework und Performance-Requirements wird das System in Production crashen oder kompromittiert werden.

[POSITION: SUPPORT_WITH_CONDITIONS] - Security-Framework, Performance-SLAs und realistische Resource-Limits müssen definiert werden bevor Implementation startet.

**Position:** ☑️ SUPPORT_WITH_CONDITIONS - Security-Framework, Performance-SLAs und realistische Resource-Limits müssen definiert werden bevor Implementation startet.

**Round Status:**
- Positions: 2 SUPPORT_WITH_CONDITIONS
- Consensus: Yes

---

## Final Consensus

Okay, hier ist ein erster Vorschlag für das Design des Knowledge-Base-Systems für OpenBotMan, unter Berücksichtigung der gegebenen Anforderungen und Fragen.

**Ziel:** Ein System, das es Experten-Agenten ermöglicht, auf projektspezifisches Wissen zuzugreifen, um ihre Aufgaben effektiver zu erfüllen, während gleichzeitig Token-Limits berücksichtigt und die Relevanz sichergestellt wird.

**Architektur:** Retrieval Augmented Generation (RAG)

```
                                  +---------------------+
                                  |     User Query      |
                                  +--------+------------+
                                           |
                                           V
                                  +---------------------+
                                  |  Query Re-Formulator | (optional)
                                  +--------+------------+
                                           |
                                           V
                                  +---------------------+
                                  |   Knowledge Retriever |
                                  +--------+------------+
                                           |
                       +-------------------+-------------------+
                       |                   |                   |
                       V                   V                   |
              +-----------------+   +-----------------+   |
              |  Vector Database  |   |  Metadata Store |   |
              +--------+--------+   +--------+--------+   |
                       |                   |                   |
                       +-------------------+-------------------+
                                           |
                                           V
                                  +---------------------+
                                  | Contextualized Data  |
                                  +--------+------------+
                                           |
                                           V
                                  +---------------------+
                                  |    LLM Agent        |
                                  +--------+------------+
                                           |
                                           V
                                  +---------------------+
                                  |     Response        |
                                  +---------------------+
```

**Begründung:**

*   **RAG (Retrieval Augmented Generation) vs. Full-Context:** RAG bietet einen guten Kompromiss zwischen Genauigkeit, Token-Effizienz und Skalierbarkeit.  Full-Context (alles in den Prompt laden) ist bei großen Wissensbasen unpraktikabel und teuer. RAG erlaubt es uns, nur das relevante Wissen in den Kontext zu laden.
*   **Architektur-Diagramm:** Das Diagramm visualisiert den Datenfluss:  Die Anfrage wird (optional) umformuliert, um die Retrieval-Genauigkeit zu verbessern.  Ein "Knowledge Retriever" sucht in der Vektor-Datenbank und im Metadata-Store nach relevanten Informationen. Die gefundenen Daten werden contextualisiert und an den LLM-Agenten übergeben, der die Antwort generiert.

**Komponenten:**

1.  **Datenaufnahme (Ingestion):**
    *   **CLI:**
        *   `--context file.md`:  Liest den Inhalt einer einzelnen Markdown-Datei.
        *   `--context-dir ./docs/`:  Liest alle unterstützten Dateien (PDF, MD, TXT, Code) in einem Verzeichnis.
        *   `--crawl URL`:  Crawlt eine Website und extrahiert Textinhalte. (Achtung: Roboter-Regeln beachten!).
    *   **UI:**
        *   Verwaltung von Knowledge Folders (logische Gruppierung von Wissen).
        *   Datei-Upload (PDF, MD, TXT, Code).
        *   URL-Crawling.
2.  **Pre-Processing:**
    *   **Chunking:**  Dokumente werden in kleinere Chunks aufgeteilt.  Intelligentes Chunking berücksichtigt semantische Grenzen (z.B. Überschriften, Absätze), um die Kohärenz zu erhalten. Ziel ist es, die für die Vektor-Datenbank optimalen Chunks zu erzeugen.
    *   **Embedding:**  Chunks werden in Vektoren umgewandelt, die ihre semantische Bedeutung repräsentieren.
    *   **Summarization (Optional):**  Größere Dokumente können zusammengefasst werden, um einen Überblick zu erhalten.  Dies kann als zusätzliche Information für den Retrieval-Prozess dienen.
    *   **Metadata Extraction:**  Extrahieren von Metadaten wie Titel, Autor, Datum, Keywords, um die Suche zu verbessern.
3.  **Speicherung:**
    *   **Vector Database:**  Speichert die Vektoren (Embeddings) der Chunks.  Geeignete Optionen sind:
        *   **ChromaDB:** Einfach einzurichten, Open-Source, gut für Prototypen.
        *   **Pinecone:**  Managed Service, skalierbar, teurer.
        *   **Weaviate:**  Open-Source, flexibel, erfordert mehr Konfiguration.
    *   **Metadata Store:** Speichert die Metadaten der Dokumente und Chunks (z.B. Dateiname, Chunk-Nummer, Zusammenfassung). Eine einfache relationale Datenbank (SQLite, PostgreSQL) oder auch eine NoSQL-Datenbank (MongoDB) sind hierfür geeignet.
4.  **Retrieval:**
    *   **Semantic Search:**  Verwendet die Vektor-Datenbank, um die relevantesten Chunks basierend auf der semantischen Ähnlichkeit zur Anfrage zu finden.
    *   **Metadata Filtering:**  Filtert die Suchergebnisse basierend auf Metadaten (z.B. Knowledge Folder, Dateityp).
    *   **Re-Ranking:**  Ordnet die Suchergebnisse neu, um die relevantesten Chunks nach oben zu bringen.
5.  **Contextualization:**
    *   Die abgerufenen Chunks werden mit zusätzlichen Informationen (z.B. Dateiname, Zusammenfassung) angereichert, um den Kontext für den Agenten zu verbessern.
6.  **Agent Integration:**
    *   Der Orchestrator übergibt die Anfrage des Benutzers zusammen mit den contextualisierten Chunks an den ausgewählten Agenten.
    *   Der Agent verwendet das Wissen aus den Chunks, um die Anfrage zu beantworten.
7.  **Knowledge Profiles:**
    *   Profile, die festlegen, welche Wissensquellen (Knowledge Folders, Websites) für bestimmte Teams oder Rollen relevant sind.  Dies kann durch Metadaten-Filterung im Retrieval-Prozess implementiert werden.

**Embedding-Modell:**

*   **OpenAI Embeddings (text-embedding-ada-002):**  Hohe Qualität, kostenpflichtig.
*   **Sentence Transformers (all-mpnet-base-v2):**  Open-Source, gute Performance, kann lokal ausgeführt werden.
*   Die Wahl hängt von den Budget- und Performance-Anforderungen ab. Für ein MVP würde ich mit Sentence Transformers beginnen.

**MVP-Scope:**

*   CLI-Unterstützung für `--context file.md` und `--context-dir ./docs/`.
*   Unterstützung für Markdown- und Textdateien.
*   Verwendung von Sentence Transformers (all-mpnet-base-v2) für Embeddings.
*   Verwendung von ChromaDB als Vektor-Datenbank.
*   Einfache Metadaten-Speicherung (z.B. JSON-Datei pro Dokument).
*   Fokus auf Semantic Search ohne Re-Ranking.
*   Keine UI im ersten Schritt.
*   Keine Knowledge Profiles im ersten Schritt.

**Zeitaufwand (Schätzung):**

*   MVP: 2-4 Wochen (1-2 Entwickler).
*   UI, Knowledge Profiles, erweiterte Funktionen: +4-6 Wochen.

**Offene Fragen:**

*   Wie detailliert sollen die Knowledge Profiles sein? (Benutzer, Teams, Rollen, Projekte?)
*   Wie soll das intelligente Chunking implementiert werden? (Bibliothek verwenden, eigene Logik?)
*   Wie wichtig ist die Performance? (Beeinflusst die Wahl der Vektor-Datenbank und des Embedding-Modells).

**Zusammenfassung:**

Dieser Vorschlag skizziert ein RAG-basiertes Knowledge-Base-System für OpenBotMan. Der Fokus liegt auf einer inkrementellen Entwicklung mit einem MVP, das die grundlegenden Funktionen abdeckt. Die Architektur ist flexibel genug, um später erweiterte Funktionen wie UI, Knowledge Profiles und intelligentes Chunking hinzuzufügen. Die Wahl der Komponenten (Embedding-Modell, Vektor-Datenbank) hängt von den spezifischen Anforderungen und Budgetbeschränkungen ab.

[POSITION: PROPOSAL]


## Action Items

- [ ] **  Extrahieren von Metadaten wie Titel, Autor, Datum, Keywords, um die Suche zu verbessern.
- [ ] {prompt}"

## Conditions & Concerns

### Conditions
- Senior Developer: S] - Brauchen Phase-1 MVP ohne Vector DB, robustes Token-Budget-System und realistische 4-6 Wochen Aufwand
- Senior Developer: Brauchen Phase-1 MVP ohne Vector DB, robustes Token-Budget-System und realistische 4-6 Wochen Aufwand
- Security & Quality Expert: S] - Security-Framework, Performance-SLAs und realistische Resource-Limits müssen definiert werden bevor Implementation startet
- Security & Quality Expert: Security-Framework, Performance-SLAs und realistische Resource-Limits müssen definiert werden bevor Implementation startet.

---

*Generated by OpenBotMan Multi-Agent Discussion*