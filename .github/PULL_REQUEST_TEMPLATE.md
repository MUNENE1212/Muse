<!--
  Thank you for contributing to Muse. The CI badge should be green before
  merge. Please fill out the checklist below to help reviewers understand
  your change.
-->

## What does this PR do?

<!-- A clear, one-paragraph description of the change. Link the related
     issue(s) with "Closes #123". -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing behavior to change)
- [ ] Documentation / infra / CI only
- [ ] Refactor (no behavior change)

## Affected area

- [ ] `frontend-gateway/` (Deno / Fresh)
- [ ] `ai-engine/` (Python / FastAPI)
- [ ] `blockchain-security/` or `contracts/` (Rust)
- [ ] Docs / `.github/`
- [ ] `docker-compose.yml` / `render.yaml`

## How was it tested?

- [ ] `deno fmt --check` passes (in `frontend-gateway/`)
- [ ] `deno lint` passes (in `frontend-gateway/`)
- [ ] `deno check **/*.ts **/*.tsx` passes
- [ ] `deno task test` passes (new tests added if behavior changed)
- [ ] `pytest ai-engine/tests/ -v` passes (if `ai-engine/**` changed)
- [ ] `cargo fmt --all -- --check` passes (if Rust changed)
- [ ] `cargo clippy --all-targets -- -D warnings` passes
- [ ] `cargo test --all` passes
- [ ] Manual smoke test in `deno task start` (describe below)

Describe the manual checks you ran:

```

```

## Screenshots / recordings (UI changes only)

<!-- Drag images here or paste markdown image syntax. Skip this section
     for non-UI changes. -->

## Related issues

<!-- "Closes #123", "Refs #456" -->

## Checklist

- [ ] I read `CONTRIBUTING.md`
- [ ] My change is scoped — no unrelated edits in the same PR
- [ ] I did not commit secrets, `.env`, or build artefacts
- [ ] I updated docs / `README.md` if behavior or commands changed
- [ ] I added or updated tests for new or changed behavior
- [ ] The CI badge is green on this PR

## Notes for reviewers

<!-- Anything reviewers should pay special attention to: trade-offs, follow-up
     work, known limitations. The Muse way: be upfront, not performative. -->
