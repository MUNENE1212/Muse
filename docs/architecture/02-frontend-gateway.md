# Muse Frontend Gateway Architecture

> **Canonical reference** (regenerated from `frontend-gateway/` on the `deploy` branch).
>
> The prior junior-authored version listed 9 signal files and a narrower API surface. The deployed gateway has **20 signal files** and **29 API endpoints** across 9 route groups. This document supersedes the prior version.

## 1. Stack

- **Deno Fresh** + **Preact** + **Preact Signals**.
- Vanilla CSS + Tailwind-compatible utility layers.
- Lucide-Preact icons.
- `safeFetch` (utils) handles all backend calls and offline queueing.

## 2. Signal layer (20 files)

| File | Key signals | Primary functions |
|---|---|---|
| `signals/user.ts` | `userSignal`, `soloModeSignal`, `setupBannerDismissedSignal` | `syncCurrentUserFromBackend`, `toggleSoloMode`, `updateProfile` |
| `signals/rooms.ts` | `roomsSignal` | `syncRoomsFromBackend`, `addRoom` |
| `signals/items.ts` | `itemsSignal` | `addItem`, `deleteItem` (also `removeItemFromThread`) |
| `signals/threads.ts` | `threadsSignal` | `addThread`, `updateThread`, `addDialogueLayer`, `toggleThreadPrivacy` |
| `signals/journal.ts` | `journalSignal`, `streakMetadataSignal`, `dailyWordGoalSignal` | `addEntry`, `updateJournalEntry`, `toggleFavoriteJournal`, `deleteJournalEntry` |
| `signals/streaks.ts` | `streaksSignal` | `loadGlobalStreak`, `extendStreak`, `startStreak`, `pruneBrokenStreaks` |
| `signals/mirror.ts` | `mirrorSignal` | `loadMirrorStats` (aggregates journal, rooms, threads, user) |
| `signals/connections.ts` | `circlesSignal`, `collaboratorsSignal`, `communityRoomsSignal`, `wisdomNodesSignal`, `perspectivesSignal`, `insightsSignal`, `activeThemesSignal`, `activeWisdomFocusSignal`, `syncStatusSignal` | `submitPerspective`, `alignWithPerspective`, `challengePerspective`, `synthesizePerspective`, `setActiveWisdomFocus` |
| `signals/followers.ts` | `followersSignal` | `loadFollowers`, `followUser`, `unfollowUser` |
| `signals/circle-membership.ts` | `circleMembershipSignal` | `joinCircle`, `leaveCircle`, `loadMembership` |
| `signals/feed-filter.ts` | `feedFilterSignal` | `setFilter`, `resetFilter` |
| `signals/ai-feedback.ts` | `aiFeedbackSignal` | `startAnalysis` |
| `signals/intelligence.ts` | `intelligenceSignal` | (read-mostly; mirrors backend intelligence state) |
| `signals/blueprints.ts` | `blueprintsSignal` | `acceptBlueprint`, `discardBlueprint`, `updateBlueprintThesis` |
| `signals/synthesis.ts` | `synthesisSignal` | (synthesis orchestration state) |
| `signals/resonance.ts` | `resonanceModeSignal`, `ambientGlowColorSignal` | `setResonanceMode`, `setAmbientGlow` |
| `signals/notifications.ts` | `notificationSignal` | `addNotification`, `dismissNotification` |
| `signals/publications.ts` | `publicationsSignal` | `publishThought`, `loadPublications` |
| `signals/vault.ts` | `isVaultUnlockedSignal` | `unlockVault`, `lockVault` |
| `signals/ui.ts` | `appThemeSignal`, `appAccentSignal`, `appFontSizeSignal`, `customAccentHexSignal`, `isMenuOpenSignal`, `isCaptureOpenSignal`, `isProfileOpenSignal`, `isNotificationsOpenSignal` | `initializeTheme`, `setTheme`, `toggleTheme`, `setAccent`, `setFontSize` |

## 3. Route → API surface (29 endpoints)

### 3.1 Authentication (`routes/api/auth/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Session login |
| POST | `/api/auth/register` | New account |
| POST | `/api/auth/demo` | Demo-mode session |
| POST | `/api/auth/2fa` | 2FA challenge/verify |

### 3.2 Rooms (`routes/api/rooms/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/rooms/create` | Create a room |

### 3.3 Artifacts (`routes/api/artifacts/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/artifacts/ingest-url` | Scrape a URL via ai-engine |
| POST | `/api/artifacts/upload-document` | Upload + parse a document |

### 3.4 Threads (`routes/api/threads/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/threads/synthesize` | Trigger synthesis for a room |

### 3.5 Synthesis (`routes/api/synthesis/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/synthesis/parse` | Parse an arbitrary URL into metadata |
| POST | `/api/synthesis/create-artifact` | Create an artifact from a URL/document |

### 3.6 Journal (`routes/api/journal/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/journal/capture` | Persist a journal entry |

### 3.7 Community (`routes/api/community/`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/community/stream` | Public thought stream |
| GET | `/api/community/circles` | Circle listings |
| GET | `/api/community/collaborators` | Suggested collaborators |

### 3.8 Followers (`routes/api/followers/`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/followers` | List followers/following |
| GET | `/api/followers/status` | Check follow state |
| POST | `/api/followers/follow` | Follow a user |
| POST | `/api/followers/unfollow` | Unfollow |

### 3.9 Circles (`routes/api/circles/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/circles/join` | Join a circle |
| POST | `/api/circles/leave` | Leave |
| GET | `/api/circles/[id]/members` | Membership list |
| POST | `/api/circles/[id]/membership` | Update membership |

### 3.10 Profile
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/profile` | Hydrate / update profile |

### 3.11 AI & misc
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ai/socratic` | Generate a Socratic question |
| POST | `/api/extract` | URL metadata extraction |
| GET | `/api/mirror` | Mirror stats |
| GET | `/api/health/services` | Service health |
| GET | `/api/joke` | Easter egg (no auth) |

## 4. Page routes (Deno Fresh `routes/`)

| Route | Page component | Notes |
|---|---|---|
| `/` | Landing | Pre-auth |
| `/dashboard` | PulseHome | Auth required |
| `/rooms` | RoomsGallery | |
| `/rooms/[id]` | RoomInside | |
| `/threads` | ThreadsGallery | |
| `/threads/[id]` | ThreadInside | |
| `/journal` | JournalGallery | |
| `/journal-community` | CommunityPage | |
| `/mirror` | MirrorDashboard | |
| `/profile` | ProfilePage | |
| `/profile/[userId]` | PublicProfile | |
| `/streaks` | StreakHub | |
| `/connections` | ConnectionsHub | |
| `/settings` | Settings | |

## 5. Feature flows

### 5.1 Room flow
1. `/rooms` → `RoomsGallery` reads `roomsSignal`.
2. `CreateRoomModal` → `addRoom()` → `POST /api/rooms/create` → signal update.
3. `/rooms/[id]` → `RoomInside` renders items, threads, mood, theme.
4. `ArtifactUploader` or URL paste → `POST /api/artifacts/ingest-url` or `upload-document`.
5. `SynthesisTrigger` → `POST /api/threads/synthesize`.

### 5.2 Journal flow
1. `/journal` → `JournalGallery` reads `journalSignal` (with `initialEntries` from server).
2. Filterable by mood, visibility, type, favorites, search.
3. `addEntry()` writes via `POST /api/journal/capture` (also updates streak metadata server-side).
4. Public entries surface in `/journal-community` and feed `/mirror`.

### 5.3 Mirror flow
`MirrorDashboard` calls `loadMirrorStats(currentUserId)` and `loadGlobalStreak()`. Aggregates `journalSignal`, `roomsSignal`, `threadsSignal`, `userSignal` into charts, heatmap, top themes, and engagement KPIs.

### 5.4 Connections flow
`ConnectionsHub` loads `/api/community/stream`, `/api/community/circles`, `/api/community/collaborators`. Solo Mode (`soloModeSignal`) toggles feed rendering client-side.

## 6. Cross-cutting behavior

### 6.1 Offline / sync resilience
`utils/safeFetch.ts` queues failed writes (POST/PUT/DELETE/PATCH) and returns a synthetic `202` so the UI stays optimistic. `pushToQueue()` and `registerIdSwapCallback()` are the queue primitives. Demo mode persists rooms, threads, items, journal, and streak metadata to `localStorage`. Theme + settings persist under `muse-fresh-settings`.

### 6.2 Demo mode
`/api/auth/demo` issues a session that the API routes detect via `isDemoUser()` in `utils/auth.ts`. When detected, `/api/community/*` returns hard-coded `DEMO_*` arrays (track-a did not remove these fallbacks). Frontend-gateway mutating endpoints either 200 with a synthetic response or write to `localStorage` via the queues.

### 6.3 Theming
`appThemeSignal`, `appAccentSignal`, `appFontSizeSignal`, `customAccentHexSignal` write CSS variables on `:root`. `initializeTheme()` reads from `localStorage` on boot.

## 7. Utilities (`frontend-gateway/utils/`)

| File | Role |
|---|---|
| `auth.ts` | `getSessionUser`, `isDemoUser`, session validation |
| `db.ts` | Postgres connection; throws on missing `DATABASE_URL` (track-a) |
| `cache.ts` | In-memory cache helper |
| `images.ts` | Image processing/upload |
| `safeFetch.ts` | Offline-safe HTTP client |
| `localStorage.ts` | Type-safe localStorage helpers (track-e) |
| `safeId.ts` | Monotonic ID generator (track-e; replaces the bug-prone `"i"+arr.length`) |
| `demo_data.ts` | DEMO_COLLABORATORS, DEMO_STREAM, DEMO_CIRCLES arrays |

## 8. Why this shape

- **Signals-first** — no Redux/Zustand; shared state lives in `signals/*.ts` and components read directly.
- **Islands hydration** — only interactive pieces are islands; pages stay lightweight.
- **Defensive parsing** — track-b's normalization helpers (`safeIsoTimestamp`, `normalizeTags`, `fallbackAvatar`) apply at every API boundary.
- **Hardened auth** — track-a removed hardcoded `user-123` and required session validation on every mutating route.