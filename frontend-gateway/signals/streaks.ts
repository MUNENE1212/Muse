import { signal } from "@preact/signals";
import {
  safeLocalGet,
  safeLocalSet,
} from "../utils/localStorage.ts";
import { generateSafeId } from "../utils/safeId.ts";

export type StreakState = "ignition" | "resonance" | "fading" | "broken";

const TWENTY_FOUR_HOURS = 1000 * 60 * 60 * 24;
const FOUR_HOURS = 1000 * 60 * 60 * 4;
const STORAGE_KEY = "muse_user_streaks_v1";
const LEGACY_STORAGE_KEYS = ["muse-streaks"];

export interface StreakHistory {
  timestamp: number;
  action: string; // e.g. "shared artifact", "extended thought", "journal reflection"
}

export interface UserStreak {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  count: number;
  lastActionAt: number;
  expiresAt: number;
  history: StreakHistory[];
  createdAt: number;
}

// Seed data so the feature isn't empty on first visit
const SEED_STREAKS: UserStreak[] = [
  {
    id: "str-1",
    partnerId: "u-2",
    partnerName: "Elena",
    count: 42,
    lastActionAt: Date.now() - 1000 * 60 * 60 * 2,
    expiresAt: Date.now() + 1000 * 60 * 60 * 22,
    createdAt: Date.now() - TWENTY_FOUR_HOURS * 42,
    history: [
      {
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
        action: "Shared an artifact in Philosophy",
      },
      {
        timestamp: Date.now() - TWENTY_FOUR_HOURS,
        action: "Extended thought on consciousness",
      },
      {
        timestamp: Date.now() - TWENTY_FOUR_HOURS * 2,
        action: "Journal reflection exchange",
      },
    ],
  },
  {
    id: "str-2",
    partnerId: "u-3",
    partnerName: "Marcus",
    count: 7,
    lastActionAt: Date.now() - 1000 * 60 * 60 * 21,
    expiresAt: Date.now() + 1000 * 60 * 60 * 3, // fading
    createdAt: Date.now() - TWENTY_FOUR_HOURS * 7,
    history: [
      {
        timestamp: Date.now() - 1000 * 60 * 60 * 21,
        action: "Added artifact to shared room",
      },
    ],
  },
  {
    id: "str-3",
    partnerId: "u-4",
    partnerName: "Sarah",
    count: 1,
    lastActionAt: Date.now() - 1000 * 60 * 60 * 5,
    expiresAt: Date.now() + 1000 * 60 * 60 * 19,
    createdAt: Date.now() - TWENTY_FOUR_HOURS,
    history: [
      {
        timestamp: Date.now() - 1000 * 60 * 60 * 5,
        action: "Started a new synthesis chain",
      },
    ],
  },
];

function migrateFromLegacy(): UserStreak[] | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    try {
      const raw = globalThis.localStorage.getItem(legacyKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as UserStreak[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        safeLocalSet(STORAGE_KEY, parsed);
        try {
          globalThis.localStorage.removeItem(legacyKey);
        } catch { /* best effort cleanup */ }
        return parsed;
      }
    } catch { /* keep scanning legacy keys */ }
  }
  return null;
}

function loadStreaks(): UserStreak[] {
  const fromCanonical = safeLocalGet<UserStreak[] | null>(STORAGE_KEY, null);
  if (Array.isArray(fromCanonical) && fromCanonical.length > 0) {
    return fromCanonical;
  }
  const migrated = migrateFromLegacy();
  if (migrated) return migrated;
  return SEED_STREAKS;
}

export const streaksSignal = signal<UserStreak[]>(loadStreaks());

// Auto-persist on change
streaksSignal.subscribe((streaks) => {
  safeLocalSet(STORAGE_KEY, streaks);
});

/** Derives the visual state of a streak based on time and count. */
export function getStreakState(streak: UserStreak): StreakState {
  const now = Date.now();
  const timeRemaining = streak.expiresAt - now;

  if (timeRemaining <= 0) return "broken";
  if (timeRemaining < FOUR_HOURS) return "fading";
  if (streak.count < 3) return "ignition";
  return "resonance";
}

/** Extend a streak — resets the 24-hour timer and increments the count. */
export function extendStreak(streakId: string, action = "Extended thought") {
  const now = Date.now();
  streaksSignal.value = streaksSignal.value.map((s) => {
    if (s.id !== streakId) return s;
    return {
      ...s,
      count: s.count + 1,
      lastActionAt: now,
      expiresAt: now + TWENTY_FOUR_HOURS,
      history: [{ timestamp: now, action }, ...s.history].slice(0, 50), // keep last 50
    };
  });
}

/** Start a new streak with a connection. */
export function startStreak(
  partnerId: string,
  partnerName: string,
  partnerAvatar?: string,
) {
  const now = Date.now();
  const newStreak: UserStreak = {
    id: generateSafeId("str"),
    partnerId,
    partnerName,
    partnerAvatar,
    count: 1,
    lastActionAt: now,
    expiresAt: now + TWENTY_FOUR_HOURS,
    createdAt: now,
    history: [{ timestamp: now, action: "Started a new synthesis chain" }],
  };
  streaksSignal.value = [...streaksSignal.value, newStreak];
  return newStreak;
}

/** Remove a broken streak permanently. */
export function removeStreak(streakId: string) {
  streaksSignal.value = streaksSignal.value.filter((s) => s.id !== streakId);
}

/** Prune all broken streaks. Returns number removed. */
export function pruneBrokenStreaks(): number {
  const before = streaksSignal.value.length;
  streaksSignal.value = streaksSignal.value.filter((s) =>
    getStreakState(s) !== "broken"
  );
  return before - streaksSignal.value.length;
}
