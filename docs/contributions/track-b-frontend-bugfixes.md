# Track B — P1 Frontend Bug Fixes

Production-grade fixes for broken filter logic, runtime crashes, invalid
Tailwind classes, API contract regressions, and DOM side effects that ran
at module load. All changes are coordinated across files so the UI keeps
rendering and the API surface stays honest.

## Summary

| Area | File | Nature |
| --- | --- | --- |
| Feed filter | `signals/feed-filter.ts` | Silent logic bug + unsafe typing |
| Feed filter caller | `islands/connections/ThoughtStream.tsx` | Coordinated param fix |
| Thread mood crash | `islands/threads/ThreadInside.tsx` | Runtime crash |
| Tailwind palette | `tailwind.config.ts` | Missing color token |
| Landing hero classes | `components/landing/LandingHero.tsx` | Invalid Tailwind classes |
| Landing feature classes | `components/landing/LandingFeatures.tsx` | Invalid Tailwind classes |
| URL extractor | `routes/api/extract.ts` | API contract + SSRF guard |
| Collaborators API | `routes/api/community/collaborators.ts` | Null safety + typed rows |
| Stream API | `routes/api/community/stream.ts` | Null safety + typed rows |
| Hero keyframes side effect | `islands/landing/SpectralHero.tsx` | Module-load DOM mutation |
| Demo guest entry | `islands/landing/LandingPage.tsx` | Non-idiomatic form submit |

## Files changed with rationale

### `frontend-gateway/signals/feed-filter.ts`
The filter read `p.author.id`, but `Perspective.author` only carries
`name`, `avatar`, and `aura` (see `signals/connections.ts:35-52`). The
return value was `any[]`. We now:

- Import the `Perspective` type and type the parameter and return
  (`Perspective[]`).
- Rename the second parameter to `followingNames` and filter against
  `p.author.name` through a `Set` lookup.
- This is a real fix: the old filter always returned an empty array
  because `includes(undefined)` is always false.

### `frontend-gateway/islands/connections/ThoughtStream.tsx`
Coordinated change for the filter signature rename. The caller now
passes `f.name` from `FollowerProfile` instead of `f.id`. Display names
match across the system, so the filter now works end-to-end.

### `frontend-gateway/islands/threads/ThreadInside.tsx`
Line 125 fell back to `moodMapping["contemplative"]`, a key that does
not exist in the mapping (lines 15-93). Any thread with a mood outside
the canonical set would crash the component because `mood.aura`,
`mood.bg`, and `mood.text` were all accessed immediately after. We
changed the fallback to `moodMapping["focus"]`, which is always
defined. Adding a `contemplative` key would have required extending the
`RoomMood` union; using an existing key is the smaller and safer fix.

### `frontend-gateway/tailwind.config.ts`
`CaptureModal.tsx` uses `bg-canvas-accent`, `text-canvas-accent`, and
`border-canvas-accent/40`, but the token was missing from the palette.
We added `canvas.accent: "#FF6B35"` (warm call-to-action accent) so the
Capture modal renders correctly. A full repo scan confirmed
`canvas-accent` is the only missing token — `canvas-primary` is already
wired through `--muse-accent-rgb`.

### `components/landing/LandingHero.tsx` & `components/landing/LandingFeatures.tsx`
Both files contained invalid Tailwind v3 classes such as
`bg-white/80/10`, `border-white/80/20`, and `border-white/80/30`.
Tailwind only accepts a single `<color>/<opacity>` pair, so these
classes silently fail to compile. Replaced them with the equivalent
valid forms (`bg-white/10`, `border-white/20`, `border-white/30`,
etc.). Also cleaned up `from-white/80 to-white/80` on gradient stops.

### `routes/api/extract.ts`
Rewrote the extractor with an explicit contract:

- **Real error codes**: `400` for bad requests, `400` for blocked
  hosts, `400` for invalid URLs, `405` for wrong methods, `502` for
  upstream failures, `502` for timeouts and oversize bodies, `500` for
  unexpected errors. Structured error JSON with a `code` discriminator
  (`BAD_REQUEST`, `INVALID_URL`, `BLOCKED_HOST`, `FETCH_FAILED`,
  `TIMEOUT`, `TOO_LARGE`, `INTERNAL`).
- **URL validation**: scheme must be `http:` or `https:`; anything
  else is rejected with `INVALID_URL`.
- **Redirect cap**: follows up to 3 redirects manually. The default
  `redirect: "follow"` was vulnerable to infinite redirect loops.
- **SSRF guard (defense in depth)**: refuses loopback, RFC1918,
  link-local, IPv6 ULA, and IPv6 link-local addresses on every hop.
  Track A/C should layer DNS-resolution checks and per-IP rate limits.
- **Size cap**: rejects responses larger than 1.5 MB before reading
  the body fully.
- **Timeout**: 8-second `AbortController` timeout per fetch.
- **HTML entity decoding**: the previous `title.replace(/&#x27;/g, ...)`
  only handled three named entities and stripped unknown ones. The new
  `decodeEntities` helper covers numeric and hex references plus the
  common named entities (`amp`, `lt`, `gt`, `quot`, `apos`, `nbsp`).
- **Content-Type**: every response now sets
  `application/json; charset=utf-8`.

### `routes/api/community/collaborators.ts`
- Replaced `as unknown` + `as Record<string, unknown>` with a typed
  `CollaboratorRow` interface and `queryDB<CollaboratorRow>`.
- `deriveName(row)` falls back through `username → email local part → id`,
  so we never call `.split` on `null` and we never silently produce
  `"undefined"`.
- Marked the response shape with `demo: true` and labelled the random
  `matchPercentage` as demo data. Real resonance scoring is a future
  feature.
- Centralised the avatar fallback through `FALLBACK_AVATAR(seed)` so
  the URL is always safely encoded.

### `routes/api/community/stream.ts`
- Typed rows via `StreamRow` and `queryDB<StreamRow>`; no more `as
  Record<string, unknown>`.
- `safeIsoTimestamp(value)` accepts only strings, returns a valid ISO
  string even when the value is missing or unparseable.
- `normalizeTags(value)` filters non-string elements instead of
  leaking whatever the DB returned.
- Avatar fallback uses the derived author name, encoded properly.

### `islands/landing/SpectralHero.tsx`
The keyframes for `spin-slow` and `spin-reverse` were injected via
`document.head.appendChild` at module load. This violates the Preact
island contract — Fresh renders islands in multiple places and the side
effect ran on import even when the island was never mounted. Moved the
injection into a `useEffect` with an explicit guard: the script is
tagged with a stable `id` (`muse-spectral-hero-keyframes`) and the
effect bails out if the tag is already present. The component is now
safe to re-render or hydrate multiple times.

### `islands/landing/LandingPage.tsx`
Replaced the synthetic form submission for the Guest Access button with
`globalThis.location.href = "/api/auth/demo"`. The handler now performs
a plain navigation, which lets the server set the httpOnly cookie via
its existing redirect response — same behaviour, no fake form, and no
flash of the browser's "submitting" state. Removed the dead DOM
construction and the orphan `document.body.appendChild`.

## Categorization

### Crash
- `ThreadInside.tsx` — fallback to undefined `contemplative` would
  throw on the next render.
- `SpectralHero.tsx` — module-level DOM mutation breaks SSR hydration
  and double-renders in Preact.

### Visual
- `tailwind.config.ts` — missing `canvas-accent` made the Capture modal
  glow rings invisible.
- `LandingHero.tsx`, `LandingFeatures.tsx` — invalid opacity classes
  silently stripped the affected borders, fills, and gradients.

### API contract
- `extract.ts` — returned `200` with a fake "External Artifact" payload
  on real failures, masking outages and bot blocks. Now returns honest
  HTTP error codes and structured `code` enums. Also gains an SSRF
  guard, redirect cap, and size/timeout limits.
- `collaborators.ts`, `stream.ts` — typed rows, null-safe defaults,
  demo-data labels.

### Behavior
- `feed-filter.ts` — filter logic was broken at the type level and the
  runtime level. The "Following" tab was always empty.

## Known follow-ups

- **DNS-resolution SSRF**: the current guard inspects the hostname
  string only. Track A/C should resolve the hostname to an IP before
  each fetch and re-check the address; today a hostname with a DNS
  record pointing at `127.0.0.1` would slip past.
- **`matchPercentage` and `alignCount`/`challengeCount`**: still
  random. Replace with real signal once interaction tables land.
- **HTML parsing**: regex extraction is fragile. A proper parser
  (e.g., `linkedom` or `htmlparser2`) would handle edge cases like
  nested quotes, comments, and CDATA.
- **Hot-reload idempotency for keyframes**: the script tag survives HMR
  in most cases, but if the `id` ever changes, ensure the cleanup
  removes the previous tag.
- **Cache-Control on `/api/extract`**: upstream metadata can be cached
  briefly to reduce repeat fetches. Not in scope here.
- **Accessibility**: `LandingPage.tsx` now navigates programmatically;
  consider also rendering an `<a href>` link as the primary affordance
  for keyboard users.

## Diff summary

```
 11 files changed, 436 insertions(+), 234 deletions(-)
```

## Verification

- Cross-repo sweep confirmed no remaining `bg-white/80/`,
  `border-white/80/`, or `from-white/80 to-white/80` patterns.
- `git diff --stat` matches the scope listed above.
- No files in `signals/items.ts`, `signals/rooms.ts`,
  `signals/threads.ts`, `signals/journal.ts`, `routes/api/auth/*`, or
  `utils/*` were touched (Track A and Track E own those).
- `deno.json`, `fresh.config.ts`, and the Tailwind config structure
  were not modified beyond adding the new color token.
- No new dependencies were introduced.
