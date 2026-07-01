# Contributing to Muse

> *Ubuntu: "I am because we are."*
> Every thought you contribute strengthens the collective intelligence.
> Every bug you file clarifies the path. Every review sharpens the work.

Thank you for being here. Muse is a sovereign knowledge environment —
a synthesis engine, not just a notes app — and we treat contributions
the same way we treat artifacts: with care, provenance, and respect for
the people who will read what we leave behind.

This document is the shortest possible path from "I have an idea" to
"my PR is merged". If something is missing, please open an issue and
help us make this page better.

---

## Table of contents

1. [Code of conduct](#code-of-conduct)
2. [Project layout](#project-layout)
3. [Dev environment](#dev-environment)
4. [Running tests](#running-tests)
5. [Style guide](#style-guide)
6. [Commit & PR process](#commit--pr-process)
7. [Working with the agent skills](#working-with-the-agent-skills)
8. [Where to ask for help](#where-to-ask-for-help)

---

## Code of conduct

We follow a simple rule: **be the colleague you'd want to review your
work at 11pm the night before a launch.** Be specific, be kind, assume
good faith. Disagreement is welcome; rudeness is not.

## Project layout

```
Muse/
├── frontend-gateway/      # Deno Fresh + Preact + Signals (UI)
├── ai-engine/             # Python FastAPI scrapers + LangChain synthesis
├── blockchain-security/   # Rust (axum) Solana node + Arweave Irys bridge
│   └── contracts/         # Anchor / Solana programs
├── .github/               # Workflows, dependabot, PR & issue templates
├── .agent/                # Domain agent roles and skills
│   ├── agents/            # Role files (frontend-specialist, etc.)
│   ├── skills/            # Reusable playbooks (lint-and-validate, …)
│   └── workflows/         # High-level orchestrations
├── docs/                  # Living documentation + contribution notes
├── docker-compose.yml     # Local three-service stack
└── render.yaml            # Render blueprint for staging/prod
```

Each sub-service has its own `Dockerfile` and its own CI workflow. See
[`.github/workflows/`](./.github/workflows/) for the breakdown.

## Dev environment

### Prerequisites

| Tool       | Version          | Why                                        |
| ---------- | ---------------- | ------------------------------------------ |
| Deno       | `1.46.x`         | `frontend-gateway` runtime & tests         |
| Python     | `3.12`           | `ai-engine` runtime & tests                |
| Rust       | `stable`         | `blockchain-security`                      |
| Docker     | `>= 24`          | Full stack via `docker-compose`            |
| Node       | optional         | Only needed if you work on Tailwind config |

### Option A — local stack with Docker (recommended for first run)

```bash
docker-compose up --build
# frontend-gateway  -> http://localhost:8000
# ai-engine         -> http://localhost:8001
# blockchain-security -> http://localhost:3000
```

### Option B — per-service hot-reload

```bash
# Frontend (Deno)
cd frontend-gateway
deno task start           # http://localhost:8000

# AI engine (Python)
cd ai-engine
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium --with-deps
uvicorn main:app --reload --port 8000

# Blockchain security (Rust)
cd blockchain-security
cargo run
```

`.env` files are git-ignored on purpose. Copy the shape you need from
each service's `README` (or the inline `os.getenv` calls) and keep
secrets out of the repo.

## Running tests

All tests are runnable from the service directory they live in.

```bash
# Deno (frontend-gateway)
cd frontend-gateway
deno fmt --check
deno lint
deno check **/*.ts **/*.tsx
deno task test
deno task coverage      # writes to ./coverage/

# Python (ai-engine)
cd ai-engine
pytest tests/ -v --cov=ai-engine --cov-report=term

# Rust (blockchain-security)
cd blockchain-security
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all
```

The tests in `frontend-gateway/tests/` are deliberately network-free:
they use `FakeTime` for TTL behaviour, the in-process Deno KV for
session round-trips, and pure-function inputs for the perspective
filter. **Do not** make tests depend on a live Postgres or a real
network call — CI has neither.

## Style guide

- **Match what's already there.** Read a neighbouring file before
  writing your own. The deno config pins `deno fmt` and `deno lint`
  defaults; the Python service uses `pytest` conventions; the Rust
  service relies on `rustfmt` and `clippy -D warnings`.
- **Do not commit secrets, build artefacts, or generated lockfiles
  that should not be tracked.** The root `.gitignore` covers the
  usual suspects; please keep it that way.
- **Small, scoped PRs.** One concern per PR. If you find two unrelated
  things to fix, open two PRs.
- **Tests before/with code.** A bug fix without a regression test is
  easy to regress; a new feature without a smoke test is easy to break.
- **No drive-by formatting.** Run the formatter on the files you
  actually changed.

## Commit & PR process

1. **Branch from `main`.** Use a descriptive prefix:
   `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`, or
   `infra/` (this contribution is `track-f-ci-tests-infra`).
2. **Write a focused commit message.** We loosely follow
   [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat(feed): add resonance-cluster sorting
   fix(db): surface missing-DATABASE_URL on boot
   chore(infra): bump dependabot groups
   ```
3. **Push and open a PR** against `main`. The PR template
   (`.github/PULL_REQUEST_TEMPLATE.md`) will prompt you for the
   relevant checklist — please fill it in. The CI badge in the
   PR header must be green before review.
4. **One approval is enough** for non-breaking changes. Breaking
   changes need a second pair of eyes and a note in the PR body.
5. **Squash-merge by default.** The PR title becomes the commit on
   `main`, so make it count.

## Working with the agent skills

This repository ships with a curated set of domain agent roles and
reusable skills in [`.agent/`](./.agent/). If you are working with
an AI assistant on a task, point it at the role that matches the
area you are touching:

- **Frontend / UI / a11y** → [`.agent/agents/frontend-specialist.md`](./.agent/agents/frontend-specialist.md)
- **Backend / FastAPI / Python** → [`.agent/agents/backend-specialist.md`](./.agent/agents/backend-specialist.md)
- **Database / Postgres / schema** → [`.agent/agents/database-architect.md`](./.agent/agents/database-architect.md)
- **Rust / Solana / crypto** → [`.agent/agents/devops-engineer.md`](./.agent/agents/devops-engineer.md)
  and [`.agent/agents/security-auditor.md`](./.agent/agents/security-auditor.md)
- **Tests / QA** → [`.agent/agents/qa-automation-engineer.md`](./.agent/agents/qa-automation-engineer.md)
  and [`.agent/agents/test-engineer.md`](./.agent/agents/test-engineer.md)
- **Performance** → [`.agent/agents/performance-optimizer.md`](./.agent/agents/performance-optimizer.md)
- **Docs** → [`.agent/agents/documentation-writer.md`](./.agent/agents/documentation-writer.md)

Cross-cutting skills live in [`.agent/skills/`](./.agent/skills/)
(lint-and-validate, tdd-workflow, testing-patterns, deployment-procedures,
…). Browse them; they encode conventions that save review rounds.

## Where to ask for help

- **A specific bug or feature?** Open an issue using the templates
  in [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/).
- **A design question?** Tag it `discussion` and reference the
  relevant file. The right agent role can usually help draft a
  proposal.
- **Stuck mid-PR?** Comment on the PR — maintainers and prior
  contributors will see it.

---

*Welcome to the collective. May your threads weave well.*
