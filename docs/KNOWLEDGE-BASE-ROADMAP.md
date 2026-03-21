# OpenBotMan Knowledge Base System - Roadmap

> **Ziel:** Experten-Agenten Zugriff auf projektspezifisches Wissen geben (VectronSkript, interne APIs, etc.)

---

## Experten-Konsens (2026-02-03)

**Teilnehmer:**
- 🎯 Strategic Planner (Gemini)
- 💻 Senior Developer (Claude)
- 🔍 Security Expert (Claude)

**Status:** ✅ KONSENS ERREICHT

---

## Architektur: RAG (Retrieval Augmented Generation)

```
+---------------------+
|    User Query       |
+--------+------------+
         |
         V
+---------------------+
| Query Re-Formulator | (optional)
+--------+------------+
         |
         V
+---------------------+
| Knowledge Retriever |
+--------+------------+
         |
    +----+----+
    |         |
    V         V
+-------+ +----------+
|Vector | |Metadata  |
|  DB   | |  Store   |
+-------+ +----------+
    |         |
    +----+----+
         |
         V
+---------------------+
| Contextualized Data |
+--------+------------+
         |
         V
+---------------------+
|     LLM Agent       |
+---------------------+
```

**Warum RAG statt Full-Context?**
- Full-Context bei >100k Tokens = Token-Explosion + Kosten
- RAG lädt nur relevante Chunks → Token-effizient + skalierbar

---

## Timeline

| Phase | Features | Zeitaufwand |
|-------|----------|-------------|
| **Phase 1** | File-based Context (ohne Vector DB) | 1 Woche |
| **Phase 2** | ChromaDB + Basic Chunking | 2-3 Wochen |
| **Phase 3** | Production-ready RAG | 3-4 Wochen |
| **Gesamt** | Komplett | **6-8 Wochen** |

---

## Phase 1: Simple Context Injection (1 Woche)

**Ansatz:** File-based ohne Vector DB (0 Dependencies!)

### CLI
```bash
# Einzelne Datei
openbotman discuss "Frage" --context docs/api.md

# Mehrere Dateien
openbotman discuss "Frage" --context-files "docs/*.md,specs/*.json"

# Ganzer Ordner
openbotman discuss "Frage" --context-dir ./vectron-docs/
```

### Implementation
```python
def simple_context_injection(files: List[str], prompt: str, max_tokens: int = 4000):
    context = ""
    for f in files[:10]:  # Max 10 files
        content = read_file(f)
        if len(context) + len(content) < max_tokens:
            context += f"\n\n--- {f} ---\n{content}"
    
    return f"Context:\n{context}\n\nTask: {prompt}"
```

### Limits (Security)
- Max 10 Dateien
- Max 10MB pro Datei
- Nur .md, .txt, .json, .yaml, .py, .ts, .js

---

## Phase 2: RAG mit ChromaDB (2-3 Wochen)

### Tech-Stack
| Komponente | Wahl | Begründung |
|------------|------|------------|
| **Embeddings** | Sentence Transformers (all-mpnet-base-v2) | Lokal, kostenlos, gute Qualität |
| **Vector DB** | ChromaDB | Einfach, Open-Source, gut für MVP |
| **Metadata** | JSON-Files | Simpel, keine DB-Dependency |

### Features
- [ ] Dokument-Chunking (fixed size + overlap)
- [ ] Embedding-Generation
- [ ] Semantic Search
- [ ] Token-Budget-Management
- [ ] CLI: `--context-dir` mit RAG

### Chunking-Strategie
```python
chunk_config = {
    "max_chunk_size": 500,      # Tokens
    "overlap": 50,              # Tokens
    "respect_boundaries": True,  # Markdown headers, code blocks
}
```

### Token-Budget-Management
```python
def calculate_context_budget(agent_model: str, user_prompt: str) -> int:
    MODEL_LIMITS = {
        "claude-sonnet": 200000,
        "gpt-4": 128000,
        "gemini-pro": 1000000,
    }
    max_tokens = MODEL_LIMITS.get(agent_model, 100000)
    prompt_tokens = count_tokens(user_prompt)
    response_buffer = 4000
    
    return min(max_tokens - prompt_tokens - response_buffer, 8000)
```

---

## Phase 3: Production-Ready (3-4 Wochen)

### Features
- [ ] UI: Knowledge Folders verwalten
- [ ] UI: Datei-Upload (PDF, MD, TXT, Code)
- [ ] Knowledge Profiles pro Team
- [ ] Re-Ranking der Suchergebnisse
- [ ] Query Re-Formulation
- [ ] Caching für häufige Queries

### URL-Crawling (mit Vorsicht!)
```python
crawl_config = {
    "enabled": False,           # Default: aus (Security)
    "whitelist_domains": [],    # Explizite Whitelist
    "respect_robots_txt": True,
    "max_pages": 50,
    "max_depth": 2,
}
```

### Knowledge Profiles
```yaml
profiles:
  vectron-team:
    name: "VectronSkript Experten"
    folders:
      - "vectron-docs/"
      - "vectron-examples/"
    auto_include: true
    
  api-team:
    name: "API Design Team"
    folders:
      - "api-specs/"
      - "openapi-docs/"
```

---

## Security Requirements (Release-Blocker)

### Input Validation
```python
class SecureKnowledgeIngestion:
    ALLOWED_EXTENSIONS = ['.md', '.txt', '.json', '.yaml', '.py', '.ts', '.js']
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_FILES = 100
    
    def validate_file(self, path: str) -> bool:
        if not any(path.endswith(ext) for ext in self.ALLOWED_EXTENSIONS):
            raise ValidationError(f"File type not allowed: {path}")
        if os.path.getsize(path) > self.MAX_FILE_SIZE:
            raise ValidationError(f"File too large: {path}")
        return True
```

### Resource Limits
```yaml
resource_limits:
  max_file_size: 10MB
  max_files_per_folder: 100
  max_chunks_per_document: 1000
  embedding_timeout: 30s
  vector_search_timeout: 5s
  max_context_tokens: 8000
```

### Performance SLAs
- Vector Search: <2s für 90% der Queries
- Memory Usage: <1GB für 10k Chunks
- Storage: <100MB für Embeddings (10k Chunks)

---

## Embedding-Modelle Vergleich

| Modell | Kosten | Qualität | Lokal? |
|--------|--------|----------|--------|
| Sentence Transformers (all-mpnet-base-v2) | Kostenlos | Gut | ✅ |
| OpenAI text-embedding-ada-002 | $0.0004/1k tokens | Sehr gut | ❌ |
| OpenAI text-embedding-3-small | $0.00002/1k tokens | Gut | ❌ |

**Empfehlung MVP:** Sentence Transformers (lokal, kostenlos, Datenschutz)

---

## Vector Database Vergleich

| DB | Setup | Skalierung | Kosten |
|----|-------|------------|--------|
| **ChromaDB** | Einfach | <100k Docs | Kostenlos |
| Pinecone | Managed | Unbegrenzt | $70+/Monat |
| Weaviate | Mittel | Gut | Kostenlos (self-hosted) |

**Empfehlung MVP:** ChromaDB

---

## CLI Parameter (Final)

```bash
# Phase 1: Simple Context
openbotman discuss "Frage" --context file.md
openbotman discuss "Frage" --context-dir ./docs/

# Phase 2: RAG
openbotman discuss "Frage" --knowledge vectron-docs
openbotman discuss "Frage" --knowledge-profile vectron-team

# Phase 3: Advanced
openbotman discuss "Frage" --crawl https://docs.example.com --max-pages 10
```

---

## Experten-Bedingungen (Release-Blocker)

### Senior Developer:
- ✅ Phase 1 MVP ohne Vector DB (0 Dependencies)
- ✅ Robustes Token-Budget-System
- ✅ Realistische 6-8 Wochen Aufwand

### Security Expert:
- ✅ Security-Framework vor Implementation
- ✅ Performance-SLAs definiert
- ✅ Resource-Limits implementiert
- ✅ Kein URL-Crawling im MVP

---

*Generiert durch OpenBotMan Multi-Agent Discussion am 2026-02-03*
