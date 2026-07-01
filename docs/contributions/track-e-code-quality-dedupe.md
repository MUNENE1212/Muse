# Track E — Code Quality / De-mock / De-dupe

## Summary

This track consolidates duplicated logic across the Muse frontend signal stores,
hardens the local vault password hashing, and removes dead code. The work lands
in two commits on `track-e-code-quality-dedupe`:

1. `refactor(signals): merge duplicate notification/streak stores, harden vault
   crypto, fix ID collisions, extract safe localStorage helpers`
2. `docs(track-e): add code-quality dedupe contribution notes`

The focus is internal cleanup — no public user-visible features changed beyond a
single `addNotification` call site that picked up a required `type` argument.

## Files Changed

### New shared utilities

- `frontend-gateway/utils/localStorage.ts` — `safeLocalGet<T>`,
  `safeLocalGetString`, `safeLocalSet`, `safeLocalSetRaw`, `safeLocalRemove`.
  All of them guard against SSR (`globalThis.localStorage` undefined), quota
  errors, and corrupt JSON.
- `frontend-gateway/utils/safeId.ts` — `generateSafeId(prefix)`. Monotonic
  per-prefix counter combined with a random suffix. Replaces the
  `length + 1` ID pattern that collided after deletes.

### Signals

- `frontend-gateway/signals/notifications.ts` — kept as canonical; added
  `markAllAsRead()` and removed the previous comment-only header. The signal
  name remains `notificationSignal`.
- `frontend-gateway/signals/ui.ts` — removed the duplicate `notificationsSignal`,
  the duplicate `addNotification(title, detail)`, and the unused
  `markNotificationRead` / `markAllNotificationsRead`. `ui.ts` now only owns
  theme / menu / capture / profile / notifications-open UI signals and the
  `muse-fresh-settings` reader/writer helpers.
- `frontend-gateway/signals/streaks.ts` — renamed `STORAGE_KEY` from
  `muse-streaks` (kebab) to `muse_user_streaks_v1` (snake) for naming
  consistency with `muse_journal_v2` / `muse_streak_metadata_v1`. Added a
  one-time migration (`migrateFromLegacy`) that reads the old `muse-streaks`
  payload, writes it to the new key, and deletes the legacy entry. All callers
  continue to use the same exported helpers (`streaksSignal`, `getStreakState`,
  `extendStreak`, `startStreak`, `removeStreak`, `pruneBrokenStreaks`).
- `frontend-gateway/signals/journal.ts` —
  - Replaced djb2 `hashPassword` with `crypto.subtle.digest("SHA-256", ...)`
    using a per-vault random salt. `createVaultEntry` and `verifyVaultPassword`
    are now `async` and store / verify `salt$hex` strings.
  - `createSynthesisEntry` now uses `generateSafeId("j")` instead of
    `crypto.randomUUID()` directly so the ID format is uniform with
    `normalizeJournalEntry` and survives browsers without `randomUUID`.
  - Removed the local `generateSafeId` (now imported from `utils/safeId.ts`).
  - Migrated `loadStreakMetadata` and `loadJournal` to the safe localStorage
    helpers; persisted through `safeLocalSet` subscribers.
- `frontend-gateway/signals/vault.ts` — added the SSR guard via the new helpers.
  `setupMasterVault`, `attemptUnlockVault`, `recoverMasterVault`, and
  `nukeVault` now use `safeLocalSetRaw`, `safeLocalGetString`, and
  `safeLocalRemove` instead of raw `localStorage`. The salt format and
  `salt$hex` digest format already in use are unchanged.
- `frontend-gateway/signals/items.ts`, `rooms.ts`, `threads.ts` —
  replaced `i/r/t/d + length + 1` ID construction with `generateSafeId(...)`,
  and migrated load / persist calls to the safe localStorage helpers. Rooms
  with `INITIAL_ROOMS = []` now correctly persist an empty array on first save
  rather than always reseeding.
- `frontend-gateway/signals/blueprints.ts` — removed the dead try/catch around
  `addThread(...)`. `addThread` does not throw under any code path; the silent
  fallback could hide real bugs.
- `frontend-gateway/signals/connections.ts` — removed the
  `joinCircle(id): console.log` stub. No caller exists; the real
  `joinCircle` lives in `circle-membership.ts`.
- `frontend-gateway/signals/mirror.ts` — removed the try/catch wrapping
  `loadMirrorStats`. The body never throws, so the catch was unreachable and
  obscured the simple flow.
- `frontend-gateway/signals/user.ts` — migrated the
  `muse-setup-dismissed` getter/setter to the safe helpers for consistency.

### Hooks

- `frontend-gateway/hooks/useDraft.ts` —
  - `updateDraft` is now wrapped in `useCallback` for parity with `clearDraft`.
  - The `as unknown as number` double-cast on `setTimeout` is gone (the ref is
    typed `ReturnType<typeof setTimeout> | null`).
  - `hasContent` now handles booleans, numbers, and nested objects/arrays via
    the recursive `hasMeaningfulContent` helper.
  - Added an explicit return-type annotation:
    `{ draft: T | null; hasDraft: boolean; updateDraft: (...) => void; clearDraft: () => void }`.
  - Migrated load/save/remove to `safeLocalGet` / `safeLocalSet` /
    `safeLocalRemove`.

### Islands / components updated for the dedupe

- `frontend-gateway/islands/layout/AppHeader.tsx` — switched from the deleted
  `notificationsSignal` / `AppNotification` / `markNotificationRead` /
  `markAllNotificationsRead` (ui.ts) to `notificationSignal` /
  `markAsRead` / `markAllAsRead` from `signals/notifications.ts`.
- `frontend-gateway/islands/modals/CaptureModal.tsx` — updated the
  `addNotification("Synthesis Captured", "...")` call site to the richer
  signature `addNotification("achievement", "Synthesis Captured", "...")`.
- `frontend-gateway/islands/journal/EntryDetail.tsx` — `verifyVaultPassword`
  is now async; `handleVaultUnlock` awaits the call.
- `frontend-gateway/islands/settings/Settings.tsx` — settings load / save /
  clear paths use `safeLocalGet` / `safeLocalSet` / `safeLocalRemove`. The
  redundant `try/catch` around the read was simplified since the helper
  already swallows corrupt JSON.

## Migration Steps for Downstream Callers

There are **no breaking API renames** for downstream consumers. The two
behavioral changes they need to be aware of:

1. **Vault password functions are now `async`.**
   - `createVaultEntry(entry, password): Promise<JournalEntry>`
   - `verifyVaultPassword(entry, password): Promise<boolean>`

   Any caller must `await` the result. The signature change is necessary
   because SHA-256 is computed via `crypto.subtle.digest`, which is asynchronous
   in every modern runtime.

2. **`addNotification` now requires a `type` argument.**
   - Old: `addNotification(title, detail)`
   - New: `addNotification(type, title, message, options?)`
   - `type` is one of `"circle_join" | "follow" | "collaboration" | "mention"
     | "achievement"`.
   - Existing callers (`CaptureModal.tsx`, `JoinCircleButton.tsx`) have been
     updated in this commit.

If you have your own island or component that calls into one of these
functions, adopt the new signature — there is no backward-compatible shim.

## Risk: Which Consumers Needed Updates

| Consumer                                  | Change                                                                                   |
|-------------------------------------------|------------------------------------------------------------------------------------------|
| `islands/layout/AppHeader.tsx`            | Imports `notificationSignal`, `markAsRead`, `markAllAsRead` from `signals/notifications` |
| `islands/modals/CaptureModal.tsx`         | Imports `addNotification` from `signals/notifications`; passes `"achievement"` type      |
| `islands/journal/EntryDetail.tsx`         | `handleVaultUnlock` is `async`; awaits `verifyVaultPassword`                             |
| `islands/streaks/StreakHub.tsx`           | No change — `streaksSignal` API is identical                                             |
| `islands/dashboard/PulseHome.tsx`         | No change — only reads `streaksSignal`                                                   |
| `islands/mirror/MirrorDashboard.tsx`      | No change — only reads `streaksSignal` and `getStreakData`                               |
| `islands/mirror/StreakCard.tsx`           | No change — only reads `StreakData` / calls `freezeStreak`                               |
| `islands/settings/Settings.tsx`           | Uses safe localStorage helpers; behavior identical                                       |
| `hooks/useDraft.ts` consumers             | Public API unchanged: `{ draft, hasDraft, updateDraft, clearDraft }`                     |

## Security Notes

The new journal vault hashing uses SHA-256 with a 16-byte per-vault salt. This
is **defense-in-depth**: it raises the cost of a hash-table attack against a
stolen localStorage dump from "free instant decode" to "brute-force per
account". It does **not** replace real protection — a determined attacker
with access to the user's local browser profile can always dump the hash and
dictionary-attack offline. Production-grade protection for sensitive journal
content requires server-side encryption with a server-held key envelope or
end-to-end encryption where only the user holds the key.

If we want a proper KDF instead of plain SHA-256, the next iteration should
swap in PBKDF2 via `crypto.subtle.deriveBits`:

```ts
const key = await crypto.subtle.importKey(
  "raw",
  encoder.encode(password),
  { name: "PBKDF2" },
  false,
  ["deriveBits"],
);
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", salt: encoder.encode(salt), iterations: 250_000, hash: "SHA-256" },
  key,
  256,
);
```

This raises the cost of an offline crack from O(1) per password to
O(iterations) per password.

## Files Touched (Quick List)

```
frontend-gateway/hooks/useDraft.ts                 | 73 ++++++------
frontend-gateway/islands/journal/EntryDetail.tsx   |  5 +-
frontend-gateway/islands/layout/AppHeader.tsx     | 19 ++--
frontend-gateway/islands/modals/CaptureModal.tsx   |  3 +-
frontend-gateway/islands/settings/Settings.tsx     | 38 +++----
frontend-gateway/signals/blueprints.ts             | 24 ++--
frontend-gateway/signals/connections.ts            |  4 -
frontend-gateway/signals/items.ts                  | 32 ++----
frontend-gateway/signals/journal.ts                | 124 ++++++++++----------
frontend-gateway/signals/mirror.ts                 | 56 ++++-----
frontend-gateway/signals/notifications.ts          | 11 ++
frontend-gateway/signals/rooms.ts                  | 34 ++----
frontend-gateway/signals/streaks.ts                | 55 +++++----
frontend-gateway/signals/threads.ts                | 34 +++---
frontend-gateway/signals/ui.ts                     | 138 +++++++++--------------
frontend-gateway/signals/user.ts                   | 10 +-
frontend-gateway/signals/vault.ts                  | 40 +++----
frontend-gateway/utils/localStorage.ts             | 53 +++++++ (new)
frontend-gateway/utils/safeId.ts                   | 32 +++++ (new)
docs/contributions/track-e-code-quality-dedupe.md  | (this file)
```
