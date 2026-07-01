# Track F — CI + Tests + Infrastructure

> *Ubuntu: the work is the work, the work is also the worker, and the
> worker is also the community. Track F is the part of the loom that
> keeps the rest from unraveling.*

## Summary

Track F wires up **production-grade CI, automated dependency updates,
issue/PR hygiene, and a starter test suite** for the three-service Muse
stack:

- `frontend-gateway` — Deno / Fresh
- `ai-engine` — Python / FastAPI
- `blockchain-security` (+ `contracts/`) — Rust

A meta `ci.yml` aggregates the three language-specific workhorse
workflows (`deno.yml`, `python.yml`, `rust.yml`). Each workhorse is
paths-filtered so PRs only run the jobs that touch their surface area.
Dependabot groups updates by ecosystem (npm, pip, cargo × 2,
github-actions) on a weekly cadence. PR and issue templates set the
tone and capture the right context from contributors up front.

No application code was changed. The only production-adjacent edit
outside `.github/` and `docs/` is enabling `deno.lock` and adding
`test` / `coverage` tasks in `frontend-gateway/deno.json`.

## Files created

### CI & repository automation (`.github/`)

| File | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | Meta workflow; delegates to the three language workflows via `workflow_call`. This is the workflow the README badge points at. |
| `.github/workflows/deno.yml` | Deno fmt / lint / type-check / test, with `actions/cache@v4` keyed on `deno.lock`. Uploads coverage to Codecov. |
| `.github/workflows/python.yml` | `actions/setup-python@v5` 3.12, pip install from `ai-engine/requirements.txt`, Playwright browser install, `pytest` with coverage. |
| `.github/workflows/rust.yml` | `dtolnay/rust-toolchain@stable`, cargo fmt + clippy (`-D warnings`) + test, with `~/.cargo/registry` and `target/` caching. |
| `.github/dependabot.yml` | Weekly grouped updates for npm (frontend-gateway), pip (ai-engine), cargo (blockchain-security + contracts), and github-actions. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Conventional checklist (tests run, screenshots, related issues, area checkboxes). |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Repro steps, expected vs. actual, environment matrix. |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Problem, proposed solution, alternatives, acceptance criteria. |

### Tests (`frontend-gateway/tests/`)

| File | Coverage |
| --- | --- |
| `cache.test.ts` | TTL behaviour and expiry eviction via `std/testing/time.ts::FakeTime`. Documents that the cache has no capacity-based eviction yet (the assertion reflects today's contract — every entry persists until its TTL elapses). |
| `db.test.ts` | Documents the *actual* contract of `utils/db.ts` — module loads with a default `DATABASE_URL` fallback, no upfront query/args validation. Marks the validation gaps as `TODO(track-h)` so the next infra pass can tighten them without losing context. |
| `auth.test.ts` | `hashPassword` bcrypt format, `comparePassword` round-trip, `createSession` UUID shape, `getSessionUser` round-trip via the module's existing Deno KV handle, demo-cookie priority. |
| `feed-filter.test.ts` | `filterPerspectivesByFollowing` for the "all" and "following" branches, missing-author safety, immutability of the input array. |

All tests are **network-free** (no live Postgres, no real HTTP). They
sit alongside the pre-existing `signals_cascade_test.ts`.

### Configuration

| File | Change |
| --- | --- |
| `frontend-gateway/deno.json` | `lock: true`; added `test` and `coverage` tasks. No application code touched. |
| `frontend-gateway/.dockerignore` | Excludes `deno_out.log`, `_fresh/`, `node_modules/`, `.git/`, env files, `tests/`, `docs/`, `*.md`. |
| `ai-engine/.dockerignore` | Excludes `__pycache__/`, `*.pyc`, venvs, `tests/`, `.pytest_cache/`, env files, `docs/`, `*.md`. |
| `.gitignore` | Expanded for Python, Rust, Deno, IDE/OS, and build artefacts (preserves the existing dotenv and Fresh rules). |
| `.editorconfig` | 2-space default; 4-space for `*.py` and `*.rs`; `*.md` keeps trailing whitespace. |

### Docs

| File | Purpose |
| --- | --- |
| `README.md` | Added the CI badge, a Contributing section linking to `CONTRIBUTING.md`, and a Deployment section noting the Render + Postgres shape. |
| `CONTRIBUTING.md` | Ubuntu-spirited contributor guide: dev setup, test commands, PR process, links to `.agent/agents/` and `.agent/skills/`. |
| `docs/contributions/track-f-ci-tests-infra.md` | This file. |

### Removed

- `frontend-gateway/deno_out.log` (17250 bytes, tracked, build artefact).
  Removed via `git rm` in its own commit `chore(repo): untrack
  frontend-gateway/deno_out.log (build artefact)`.

## Test commands

`deno` is not installed in this development container, so the test
runner was not executed. Run the following from the repo root on a
machine that has the toolchain installed.

```bash
# Frontend (Deno)
cd frontend-gateway
deno fmt --check
deno lint
deno check **/*.ts **/*.tsx
deno task test
deno task coverage    # writes ./coverage/

# AI engine (Python)
cd ai-engine
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install pytest pytest-cov pytest-asyncio httpx
pytest tests/ -v --cov=ai-engine --cov-report=term

# Blockchain security (Rust)
cd blockchain-security
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all
```

CI will run exactly the same set on every push to `main` and every PR
into `main`.

## Notes for maintainers

1. **First run will fail until secrets are configured.** The
   `python.yml` and `deno.yml` workflows attempt to upload coverage to
   Codecov. They use `secrets.CODECOV_TOKEN` and `fail_ci_if_error: false`,
   so the upload is **non-blocking** — but if you want green coverage
   badges, add the token under
   `Settings → Secrets and variables → Actions`. The test/lint jobs
   themselves do not depend on it.

2. **`deno.lock` is now tracked.** CI uses
   `hashFiles('frontend-gateway/deno.json', 'frontend-gateway/deno.lock')`
   as its cache key. Until a real lockfile is generated by a local
   `deno cache` (which happens automatically the first time you run
   `deno task start` or `deno task test`), the cache will be cold. That
   is expected on the first run; subsequent runs will hit the cache.

3. **The `python.yml` workflow installs Playwright + Chromium +
   Tesseract + Poppler on cache miss.** This is several hundred MB of
   system packages. We cache `~/.cache/ms-playwright` keyed on
   `requirements.txt` so subsequent runs are fast. The first run on a
   fresh runner will take noticeably longer than the others.

4. **Per-area paths filters.** `deno.yml`, `python.yml`, and `rust.yml`
   only run on changes to their respective subtrees. The meta
   `ci.yml` deliberately runs them all on `push` to `main` so a
   required-check policy is enforceable from a single workflow.

5. **Concurrency groups cancel in-flight runs** for the same ref
   (`ci-${{ github.ref }}`, `deno-${{ github.ref }}`, etc.). This is
   what keeps total CI under the 5-minute budget on a fast runner.

6. **Dependabot groups** are tuned to keep PRs reviewable:
   - `langchain`, `fresh-and-preact`, `async-runtime`, `crypto`, `solana` —
     update together within each ecosystem.
   - `actions-core` updates all `actions/*`, `denoland/*`,
     `dtolnay/*`, and `codecov/*` together so GitHub Actions bumps
     arrive as a single PR.

7. **Test gaps explicitly called out in `db.test.ts` and
   `cache.test.ts`.** The constraint that application code not change
   forced us to write tests that document the *current* contract
   rather than the desired one. Each test that asserts "current
   behaviour" carries a `TODO(track-h):` comment explaining the
   follow-up. The recommended follow-up track is **Track H: db
   hardening** — add `queryDB` argument validation, a startup
   `DATABASE_URL` guard, and a bounded LRU on `utils/cache.ts`.

8. **EditorConfig.** Most editors (VSCode, JetBrains family, Vim with
   `editorconfig-vim`, Neovim with `editorconfig.nvim`) pick this up
   automatically. The `*.md` override keeps trailing whitespace in
   markdown intact, which matters for hard-wrapped prose.

9. **PR template enforces the spirit, not just the mechanics.** The
   "Notes for reviewers" prompt explicitly invites the contributor to
   flag trade-offs and follow-up work. This is how we keep the
   review surface honest.

10. **The next maintainer runbook** (suggested):
    - Merge this PR.
    - Add `CODECOV_TOKEN` to repo secrets.
    - Open **Track H** issue(s) for the two `TODO(track-h)` items
      flagged in `db.test.ts` and `cache.test.ts`.
    - Consider switching from `workflow_call` to `needs:` chains inside
      `ci.yml` if/when you want a single required-check policy.
