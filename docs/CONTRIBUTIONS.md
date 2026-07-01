# Muse — Production-Grade Hardening Contributions

> *"I am because we are."* — Ubuntu

This document summarizes the contribution work made to the Muse project under the spirit of **ubuntu** — collaborative, transparent, and oriented toward the greater health of the codebase. Every change below was designed to be reviewable, reversible, and additive.

> **Reconciled against `deploy` after spec review.** See `docs/VALIDATION_REPORT.md` for the audit that produced the canonical architecture docs in `docs/architecture/`. Signal count corrected from "17" (README) to **20** (actual files in `frontend-gateway/signals/`). NLP engine (`nlp_engine.py`) and orchestrator (`pipeline.py`) are **planned**, not shipped — see `docs/architecture/03-ai-engine.md` §7.

## Repository state

- **Main branch**: `main` (unchanged from upstream `kagz-01/Muse`)
- **Feature branches** (one per contribution track):

| Branch | Track | Files | Commits |
|---|---|---|---|
| `track-a-security-and-backend` | P0 Security sweep + DB-backed endpoints | 24 | 2 |
| `track-b-frontend-bugfixes` | P1 frontend crashes + visual bugs | 12 | 2 |
| `track-c-ai-engine-hardening` | SSRF / async / asyncpg / pinned deps | 16 | 2 |
| `track-d-database-schema` | Constraints, indexes, new tables, migration | 4 | 4 |
| `track-e-code-quality-dedupe` | Notification/streak store merge, vault crypto | 20 | 2 |
| `track-f-ci-tests-infra` | CI workflows, dependabot, tests, .dockerignore | 21 | 3 |

Detailed per-track documentation lives at `docs/contributions/track-X-*.md` in each worktree.

## Threat model coverage

| Risk | Before | After |
|---|---|---|
| Hardcoded DB credentials | `postgres://user:password@...` fallback | Module throws at startup if `DATABASE_URL` is unset |
| Auth bypass via `user-123` | Anyone can act as that user | All mutations require valid session cookie |
| SSRF on `/api/scrape` | Fetch any URL (incl. cloud metadata) | Scheme + IP-range allowlist, DNS-rebinding defense |
| SSRF on `/api/extract` | Fetch any URL | Same protections + redirect cap + body size cap |
| Prompt injection | User content into LLM prompt verbatim | `<artifact>` boundary, sanitizer, length caps, Pydantic constraints |
| Memory exhaustion | Unbounded file upload | 25 MB streamed cap with 413 response |
| Brute-forceable vault | djb2 hash in localStorage | SHA-256 + per-vault salt |
| TLS / bcrypt | `genSalt(8)` | `genSalt(12)` (OWASP 2026) |
| Outdated deps | `python-multipart==0.0.9` (CVE-2024-21503) | `0.0.18` |

## Functional coverage

| Area | Before | After |
|---|---|---|
| Followers API | In-memory `Map` per route, lost on restart, fragmented across files | Real `user_follows` table, atomic operations |
| Circles API | Same fragmentation | Real `circles` + `circle_members` tables |
| Mirror stats | Hardcoded 1250 / 342 / 89 numbers | `COUNT(*)` aggregation across `journal_entries`/`rooms`/`artifacts`/`threads`/`user_follows` |
| Synthesis/parse | Returns fabricated marketing copy | Real `og:`/`twitter:` metadata or HTTP 400 |
| Notification store | Two parallel stores (`notifications.ts` + `ui.ts`) | Single canonical store |
| Streak store | Two parallel stores (`journal.ts` + `streaks.ts`) | Single canonical store with transparent migration |
| ID generation | `id: "i" + array.length + 1` (collides after deletes) | Monotonic counter + random suffix |
| Module-load DOM side effect | `document.head.appendChild` at import time | `useEffect` inside component |
| Invalid Tailwind | `bg-white/80/10` (not a real class) | `bg-white/10` |
| `moodMapping["contemplative"]` | Undefined key → TypeError at runtime | Valid fallback (`focus`) |
| `filterPerspectivesByFollowing` | Filtered on `p.author.id` (never exists) | Filtered on `p.author.name` |
| `(u.email as string).split("@")` | Crashed on null emails | Null-safe default |
| `/api/extract` fetch failure | Returned HTTP 200 with fake data | Returns HTTP 502 with structured error |

## Infra additions

- GitHub Actions workflows for Deno, Python, Rust (paths-filtered).
- Dependabot for npm / pip / cargo / github-actions.
- PR and issue templates.
- `deno.json` lock enabled + `test` / `coverage` tasks.
- `.dockerignore` for `frontend-gateway` and `ai-engine`.
- Expanded `.gitignore` (Python, Rust, Deno, IDE, OS).
- `.editorconfig` for cross-tool consistency.
- Basic network-free test suite (5 new files).
- `deno_out.log` removed from git history.
- `CONTRIBUTING.md` with ubuntu-spirited dev workflow.

## Suggested PR order

For an upstream contributor, the recommended order for submitting PRs to `kagz-01/Muse`:

1. **Track F first** (CI/tests infra) — establishes the test runner and CI pipeline. Once merged, subsequent PRs will be automatically validated.
2. **Track D** (database schema) — no application code changes, safe to merge alone; unlocks Track A's DB queries.
3. **Track A** (security + backend) — depends on D's new tables. Large but well-scoped.
4. **Track C** (AI engine hardening) — independent of A/D, but parallel work can land alongside.
5. **Track B** (frontend bug fixes) — independent, small surface.
6. **Track E** (code quality dedupe) — depends on Track A's API stability; ideally last.

The branches have **no inter-dependencies in their current commit graph**, so any subset can be sent as PRs in parallel if you prefer.

## Validation status

- **Track C**: 31 pytest tests passing (SSRF + prompt-injection guards).
- **Track F**: 4 new Deno test files, runs `cache.test.ts` with fake timers.
- **Track A/B/D/E**: changes were manually re-read; deno/cargo toolchains were not installed in the contributor's environment, so they should be re-validated in CI on the maintainer's side.
- **Track C Dockerfile / Track A frontend Deno**: not built locally; CI will validate.

## Acknowledgement

This work is offered in the spirit of ubuntu — we contribute because the project's health is our health, and we hope these changes help Muse reach its production-grade potential. Each track was scoped to be independently reviewable, and the per-track docs explain trade-offs so maintainers can decide what to merge.

— The contributors
