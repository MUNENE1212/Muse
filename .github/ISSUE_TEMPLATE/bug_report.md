---
name: Bug report
about: Something in Muse is broken or behaving incorrectly
title: "bug: "
labels: ["bug"]
---

## What happened?

<!-- A clear, one-sentence description of the bug. -->

## Reproduction steps

1.
2.
3.
4.

## Expected behavior

<!-- What you thought should happen. -->

## Actual behavior

<!-- What actually happened. Include error messages and stack traces. -->

```
<paste error output here>
```

## Environment

- **Component**: `frontend-gateway` / `ai-engine` / `blockchain-security` / `contracts`
- **Deno version** (run `deno --version`):
- **Python version** (run `python --version`, if relevant):
- **Rust toolchain** (run `rustc --version`, if relevant):
- **OS**: (e.g., Ubuntu 24.04, macOS 15, Windows 11)
- **Deployment**: local docker-compose / Render / Deno Deploy
- **Browser** (UI bugs): e.g., Firefox 130, Chrome 128

## Screenshots / recordings

<!-- If applicable, drag images or paste a link. -->

## Possible cause

<!-- Optional: where you suspect the bug lives, e.g. "the cache TTL check in
     utils/cache.ts". Helps reviewers triage quickly. -->

## Severity

- [ ] Blocker — production is on fire
- [ ] Major — feature unusable
- [ ] Minor — annoying but workable
- [ ] Cosmetic / polish
