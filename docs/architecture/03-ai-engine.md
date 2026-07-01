# Muse AI Engine Architecture

> **Canonical reference** (regenerated from `ai-engine/` on the `deploy` branch).
>
> The prior junior-authored version of this document described a `nlp_engine.py` module (`ProductionLocalNLPEngine`, `GroqEnrichedEngine`, `NLPEngineFactory`) and a `pipeline.py` orchestrator (`IntelligencePipeline`, `process_journal_entry`, `synthesize_with_insights`). **Neither file exists in `deploy`.** The shipped AI engine is a thin FastAPI service that delegates synthesis to an LLM via `synthesizer.py`.

## 1. What ships

| File | Role |
|---|---|
| `ai-engine/main.py` | FastAPI app; routes `/`, `/api/scrape`, `/api/upload-document`, `/api/synthesize`, `/api/analyze`, `/analyze` (legacy). |
| `ai-engine/database.py` | asyncpg pool lifecycle and two helpers: `get_room_artifacts()`, `save_threads()`. |
| `ai-engine/synthesizer.py` | Prompt construction, sanitization, truncation, blueprint synthesis via LLM (`synthesize_artifacts`). |
| `ai-engine/url_safety.py` | SSRF defense: scheme allowlist, IP-range blocklist (RFC1918, loopback, link-local, cloud metadata), DNS-rebinding guard via `resolve_url()` and `is_safe_url()`. |
| `ai-engine/scrapers/` | Source-specific normalizers: `youtube_scraper.py`, `social_scraper.py`, `web_scraper.py`, `document_scraper.py`. |

## 2. Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Health/readiness probe (`{"status":"ok"}`). |
| POST | `/api/scrape` | Body `{url}`. Validates with `url_safety.is_safe_url()`; dispatches to the matching scraper; returns normalized payload `{status, type, title, author, content, url, metadata}`. |
| POST | `/api/upload-document` | Multipart file upload (≤ 25 MB enforced via streaming cap). Returns parsed text + metadata. |
| POST | `/api/synthesize` | Body `{room_id}` (or pre-fetched artifacts). Calls `synthesize_artifacts()` and persists via `database.save_threads()`. |
| POST | `/api/analyze` | Body `{content}`. Sanitized, truncated, length-capped; returns analysis structure. |
| POST | `/analyze` | Legacy alias of `/api/analyze`. |

## 3. Security controls

- **SSRF** — `url_safety.resolve_url()` rejects non-http(s), resolves DNS, checks every A/AAAA record against the IP blocklist, and pins the actual IP for the fetch to defeat DNS rebinding.
- **Prompt injection guard** — `synthesizer._sanitize_text()` strips prompt-boundary tokens and wraps user content in `<artifact>` tags before the LLM call; `_truncate()` caps context length.
- **Upload cap** — 25 MB streaming limit (`_read_upload_with_cap`), 413 on overflow.
- **Filename validation** — `_validate_upload_filename()` blocks path traversal (`../`, null bytes, absolute paths).
- **Async I/O** — FastAPI handlers are `async def`; `asyncpg.Pool` with `min_size=1`, `max_size=10`.

## 4. Output contract (scraper → caller)

Every scraper normalizes to:

```json
{
  "status": "ok" | "error",
  "type": "<scraper-type>",
  "title": "...",
  "author": "...",
  "content": "...",
  "url": "...",
  "metadata": { "source": "...", "content_length": 1234, ... }
}
```

## 5. Synthesis flow

1. Frontend calls `POST /api/synthesize` with a `room_id`.
2. `database.get_room_artifacts(room_id)` returns the artifact rows from `artifacts.unstructured_data`.
3. `synthesizer._build_artifacts_block()` formats them with sanitization, truncation, and `<artifact>` boundaries.
4. The block is sent to the LLM with a structured prompt requesting a `ThreadBlueprint`.
5. The response is parsed into `SynthesisResult` and saved via `database.save_threads()` to `threads` and `thread_artifacts`.

## 6. Database integration

| Helper | Reads | Writes |
|---|---|---|
| `get_room_artifacts(room_id)` | `artifacts` | — |
| `save_threads(...)` | — | `threads`, `thread_artifacts` |

`database.py` does **not** write to `journal_entries`, `users`, or `user_follows`. Those mutations live in the frontend-gateway routes (track-a).

## 7. Planned (not shipped)

These were in the prior junior-authored spec but are **not** in `deploy`:
- `nlp_engine.py` — `ProductionLocalNLPEngine` (TF-IDF + spaCy noun-chunk themes, TextBlob sentiment, LRU cache), `GroqEnrichedEngine` (local + optional Groq via langchain_groq), `NLPEngineFactory`.
- `pipeline.py` — `IntelligencePipeline` orchestrator with `process_journal_entry()` and `synthesize_with_insights()`.
- `artifact_nlp_metadata` table — dual-storage of NLP results; today, NLP results live inline in `artifacts.unstructured_data` only.
- `tiktok_scraper.py`, `pinterest.py` — only `youtube`, `social`, `web`, `document` ship today. The TikTok scraper is referenced from imports in `main.py` but the module file is not in the tree (verify before deploy).

## 8. Local run

```bash
export DATABASE_URL=postgres://user:pass@host:5432/muse
export GROQ_API_KEY=...  # if using Groq
cd ai-engine
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 9. Why this shape

- **LLM-only synthesis** — fast iteration; prompt-engineering is cheaper than maintaining a TF-IDF model.
- **Async everywhere** — asyncpg + FastAPI `async def` keeps the event loop clean.
- **SSRF + prompt-injection hardened** — these were the two highest-impact attack surfaces called out in track-c.
- **No background workers** — synthesis is request-scoped; if load grows, move to a queue.