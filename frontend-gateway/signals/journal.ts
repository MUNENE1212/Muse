import { signal } from "@preact/signals";
import {
  safeLocalGet,
  safeLocalSet,
} from "../utils/localStorage.ts";
import { generateSafeId } from "../utils/safeId.ts";

export type JournalMood =
  | "reflective"
  | "grounded"
  | "charged"
  | "anxious"
  | "custom";

export type StreakLevel = "Spark" | "Flame" | "Inferno" | "Phoenix";
export type EntryType = "reflection" | "synthesis";
export type VaultAccessLevel = "public" | "private" | "vault";

export interface LinkedArtifact {
  id: string;
  type: "room" | "thread";
  title: string;
  linkedAt: number;
}

export interface SynthesisData {
  sourceRoomIds: string[];
  sourceThreadIds: string[];
  keyInsights: string[];
  patterns: string[];
  nextActions: string[];
  synthesizedAt: number;
}

export const moodConfig: Record<
  JournalMood | "custom",
  { label: string; color: string; emoji: string; hex: string }
> = {
  reflective: {
    label: "Reflective",
    color: "blue-400",
    emoji: "💭",
    hex: "#60a5fa",
  },
  grounded: {
    label: "Grounded",
    color: "emerald-400",
    emoji: "🌱",
    hex: "#34d399",
  },
  charged: {
    label: "Charged",
    color: "amber-400",
    emoji: "⚡️",
    hex: "#fbbf24",
  },
  anxious: { label: "Anxious", color: "rose-400", emoji: "🌪", hex: "#fb7185" },
  custom: { label: "Custom", color: "#6b7280", emoji: "✨", hex: "#6b7280" },
};

export type MoodStat = {
  mood: string;
  label: string;
  emoji: string;
  color: string;
  count: number;
};
export type HeatmapDay = { date: Date; count: number };

export interface VaultConfig {
  isVaulted: boolean;
  passwordHash?: string;
  createdAt?: number;
}

export interface JournalEntry {
  id: string;
  body: string;
  mood: JournalMood;
  customMood?: string;
  tags: string[];
  linkedItemIds: string[];
  isFavorited: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  wordCount: number;
  // Phase 2 fields
  type?: EntryType;
  synthesis?: SynthesisData;
  vault?: VaultConfig;
  linkedArtifacts?: LinkedArtifact[];
  viewCount?: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  lastEntryDate: string;
  freezeCount: number;
  freezeResetMonth: number;
  milestonesUnlocked: number[];
  currentLevel: StreakLevel;
}

const STORAGE_KEY = "muse_journal_v2";
const STREAK_METADATA_KEY = "muse_streak_metadata_v1";

function loadStreakMetadata(): StreakData {
  const stored = safeLocalGet<Partial<StreakData> | null>(
    STREAK_METADATA_KEY,
    null,
  );
  if (stored && typeof stored === "object") {
    return { ...getDefaultStreakData(), ...stored };
  }
  return getDefaultStreakData();
}

function getDefaultStreakData(): StreakData {
  return {
    currentStreak: 0,
    longestStreak: 0,
    totalDays: 0,
    lastEntryDate: "",
    freezeCount: 2,
    freezeResetMonth: new Date().getMonth(),
    milestonesUnlocked: [],
    currentLevel: "Spark",
  };
}

const JOURNAL_MOODS: JournalMood[] = [
  "reflective",
  "grounded",
  "charged",
  "anxious",
  "custom",
];

function isJournalMood(value: unknown): value is JournalMood {
  return typeof value === "string" &&
    JOURNAL_MOODS.includes(value as JournalMood);
}

function normalizeJournalEntry(raw: unknown): JournalEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Partial<JournalEntry> & Record<string, unknown>;

  const body = typeof entry.body === "string" ? entry.body : "";
  const tags = Array.isArray(entry.tags)
    ? entry.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const linkedItemIds = Array.isArray(entry.linkedItemIds)
    ? entry.linkedItemIds.filter((id): id is string => typeof id === "string")
    : [];

  const createdAt = typeof entry.createdAt === "number"
    ? entry.createdAt
    : Date.now();
  const updatedAt = typeof entry.updatedAt === "number"
    ? entry.updatedAt
    : createdAt;

  return {
    id: typeof entry.id === "string" && entry.id.length > 0
      ? entry.id
      : generateSafeId("j"),
    body,
    mood: isJournalMood(entry.mood) ? entry.mood : "reflective",
    customMood: typeof entry.customMood === "string"
      ? entry.customMood
      : undefined,
    tags,
    linkedItemIds,
    isFavorited: !!entry.isFavorited,
    isPinned: typeof entry.isPinned === "boolean" ? entry.isPinned : false,
    isArchived: typeof entry.isArchived === "boolean"
      ? entry.isArchived
      : false,
    isPublic: typeof entry.isPublic === "boolean" ? entry.isPublic : false,
    createdAt,
    updatedAt,
    wordCount: typeof entry.wordCount === "number"
      ? entry.wordCount
      : body.trim().split(/\s+/).filter(Boolean).length,
    type: entry.type === "reflection" || entry.type === "synthesis"
      ? entry.type
      : undefined,
    synthesis: typeof entry.synthesis === "object" && entry.synthesis !== null
      ? entry.synthesis as SynthesisData
      : undefined,
    vault: typeof entry.vault === "object" && entry.vault !== null
      ? entry.vault as VaultConfig
      : undefined,
    linkedArtifacts: Array.isArray(entry.linkedArtifacts)
      ? entry.linkedArtifacts as LinkedArtifact[]
      : undefined,
    viewCount: typeof entry.viewCount === "number"
      ? entry.viewCount
      : undefined,
  };
}

function loadJournal(): JournalEntry[] {
  const parsed = safeLocalGet<unknown>(STORAGE_KEY, null);
  if (Array.isArray(parsed)) {
    return parsed
      .map(normalizeJournalEntry)
      .filter((entry): entry is JournalEntry => entry !== null);
  }

  // Seed initial data if empty
  return [
    {
      id: "j1",
      body:
        "I was reading about the new zoning policies proposed today. It makes me wonder about how much our daily lives are shaped by local decisions we barely pay attention to, compared to the national politics that consume our news feeds.",
      mood: "reflective",
      tags: ["politics", "local", "thoughts"],
      linkedItemIds: ["i1", "i2"],
      isFavorited: true,
      isPublic: false,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
      wordCount: 40,
    },
    {
      id: "j2",
      body:
        "Reflecting on my relationship today, I realized how important acts of service are to me. When they made me coffee this morning, it meant more than any grand romantic gesture could have.",
      mood: "grounded",
      tags: ["romance", "love languages", "gratitude"],
      linkedItemIds: ["i3"],
      isFavorited: false,
      isPublic: true,
      createdAt: Date.now() - 43200000,
      updatedAt: Date.now() - 43200000,
      wordCount: 32,
    },
  ];
}

export const journalSignal = signal<JournalEntry[]>(loadJournal());
export const streakMetadataSignal = signal<StreakData>(loadStreakMetadata());

// Persistence
journalSignal.subscribe((entries: JournalEntry[]) => {
  safeLocalSet(STORAGE_KEY, entries);
});

streakMetadataSignal.subscribe((metadata: StreakData) => {
  safeLocalSet(STREAK_METADATA_KEY, metadata);
});

export const dailyWordGoalSignal = signal(500);

export async function addEntry(
  body = "",
  isPublic = false,
): Promise<JournalEntry> {
  const response = await fetch("/api/journal/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawThought: body || "New reflection..." }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to capture journal entry: ${await response.text()}`,
    );
  }

  const { entry } = await response.json();

  // Transform DB entry to frontend format
  const newEntry: JournalEntry = {
    id: entry.id,
    body: entry.raw_thought,
    mood: entry.mood || "reflective",
    tags: entry.tags || [],
    linkedItemIds: [],
    isFavorited: entry.is_favorited || false,
    isPinned: entry.is_pinned || false,
    isArchived: entry.is_archived || false,
    isPublic: entry.is_public || isPublic,
    createdAt: new Date(entry.created_at).getTime(),
    updatedAt: new Date(entry.updated_at).getTime(),
    wordCount: entry.raw_thought.trim().split(/\s+/).filter(Boolean).length,
    synthesis: entry.synthesized_context || undefined,
  };

  journalSignal.value = [newEntry, ...journalSignal.value];

  // Update streak data on new entry
  updateStreakOnNewEntry();

  return newEntry;
}

export function updateJournalEntry(id: string, updates: Partial<JournalEntry>) {
  journalSignal.value = journalSignal.value.map((e: JournalEntry) => {
    if (e.id === id) {
      const updated = { ...e, ...updates, updatedAt: Date.now() };
      if (updates.body !== undefined) {
        updated.wordCount =
          updates.body.trim().split(/\s+/).filter(Boolean).length;
      }
      return updated;
    }
    return e;
  });
}

export function deleteJournalEntry(id: string) {
  journalSignal.value = journalSignal.value.filter((e: JournalEntry) =>
    e.id !== id
  );
}

export function toggleFavoriteJournal(id: string) {
  journalSignal.value = journalSignal.value.map((e: JournalEntry) =>
    e.id === id ? { ...e, isFavorited: !e.isFavorited } : e
  );
}

export function togglePinJournal(id: string) {
  journalSignal.value = journalSignal.value.map((e: JournalEntry) =>
    e.id === id ? { ...e, isPinned: !e.isPinned } : e
  );
}

export function toggleArchiveJournal(id: string) {
  journalSignal.value = journalSignal.value.map((e: JournalEntry) =>
    e.id === id ? { ...e, isArchived: !e.isArchived } : e
  );
}

export function getJournalStreak(): number {
  return streakMetadataSignal.value.currentStreak;
}

function updateStreakOnNewEntry(): void {
  const metadata = streakMetadataSignal.value;
  const today = new Date().toDateString();

  // Already wrote today, don't update
  if (metadata.lastEntryDate === today) {
    return;
  }

  const yesterday = new Date(Date.now() - 86400000).toDateString();
  let newStreak = metadata.currentStreak;

  // If wrote yesterday or today is first entry
  if (metadata.lastEntryDate === yesterday || metadata.currentStreak === 0) {
    newStreak = metadata.currentStreak + 1;
  } else {
    // Streak broken, reset to 1
    newStreak = 1;
  }

  // Update longest streak if current > longest
  const newLongest = Math.max(newStreak, metadata.longestStreak);

  // Check for milestone unlock
  const unlockedMilestones = getUnlockedMilestones(
    newStreak,
    metadata.milestonesUnlocked,
  );

  // Calculate streak level
  const level = getStreakLevelForCount(newStreak);

  const updated: StreakData = {
    ...metadata,
    currentStreak: newStreak,
    longestStreak: newLongest,
    totalDays: metadata.totalDays + 1,
    lastEntryDate: today,
    currentLevel: level,
    milestonesUnlocked: unlockedMilestones,
  };

  streakMetadataSignal.value = updated;
}

function getUnlockedMilestones(
  currentStreak: number,
  alreadyUnlocked: number[],
): number[] {
  const milestones = [7, 30, 100, 365, 1000];
  const newUnlocked = [...alreadyUnlocked];

  for (const milestone of milestones) {
    if (currentStreak === milestone && !newUnlocked.includes(milestone)) {
      newUnlocked.push(milestone);
    }
  }

  return newUnlocked;
}

function getStreakLevelForCount(count: number): StreakLevel {
  if (count >= 365) return "Phoenix";
  if (count >= 100) return "Inferno";
  if (count >= 30) return "Flame";
  return "Spark";
}

export function getStreakData(): StreakData {
  return streakMetadataSignal.value;
}

export function freezeStreak(): boolean {
  const metadata = streakMetadataSignal.value;
  const currentMonth = new Date().getMonth();

  // Reset freeze count if month changed
  if (metadata.freezeResetMonth !== currentMonth) {
    metadata.freezeResetMonth = currentMonth;
    metadata.freezeCount = 2;
  }

  // Can't freeze if no freezes left
  if (metadata.freezeCount <= 0) {
    return false;
  }

  const updated: StreakData = {
    ...metadata,
    freezeCount: metadata.freezeCount - 1,
  };

  streakMetadataSignal.value = updated;
  return true;
}

export function getMoodStats(): MoodStat[] {
  const entries = journalSignal.value;
  const stats: Record<string, number> = {};
  entries.forEach((entry: JournalEntry) => {
    const m = entry.mood === "custom" && entry.customMood
      ? entry.customMood
      : entry.mood;
    stats[m] = (stats[m] || 0) + 1;
  });
  return Object.entries(stats)
    .map(([mood, count]) => {
      const isDefault = mood in moodConfig && mood !== "custom";
      const cfg = isDefault
        ? moodConfig[mood as JournalMood]
        : moodConfig["custom"];
      return {
        mood,
        label: isDefault ? cfg.label : mood,
        emoji: isDefault ? cfg.emoji : "✨",
        color: cfg.hex,
        count: count || 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function getActivityHeatmap(): HeatmapDay[] {
  const entries = journalSignal.value;
  const days = [...Array(31)].map((_, i): HeatmapDay => {
    const d = new Date();
    d.setDate(d.getDate() - (30 - i));
    const dateStr = d.toDateString();
    const count = entries
      .filter((entry: JournalEntry) =>
        new Date(entry.createdAt).toDateString() === dateStr
      )
      .reduce((sum: number, entry: JournalEntry) => sum + entry.wordCount, 0);
    return { date: d, count };
  });
  return days;
}

export function getMilestoneUnlocked(): number | null {
  const metadata = streakMetadataSignal.value;
  const streak = metadata.currentStreak;
  const unlocked = metadata.milestonesUnlocked;

  const milestones = [7, 30, 100, 365, 1000];
  for (const milestone of milestones) {
    if (streak === milestone && unlocked.includes(milestone)) {
      return milestone;
    }
  }

  return null;
}

export function getTodayWordCount(): number {
  const today = new Date().toDateString();
  return journalSignal.value
    .filter((e: JournalEntry) => new Date(e.createdAt).toDateString() === today)
    .reduce((sum: number, e: JournalEntry) => sum + e.wordCount, 0);
}

export function getJournalTitle(entry: JournalEntry): string {
  if (entry.body.startsWith("#")) {
    return entry.body.split("\n")[0].replace("#", "").trim();
  }
  const firstLine = entry.body.split("\n")[0].trim();
  return firstLine.length > 40 ? firstLine.slice(0, 40) + "..." : firstLine;
}

export function resetJournalEntries() {
  journalSignal.value = [];
}

// ============ PHASE 2: VAULT & SECURITY ============

function generateVaultSalt(): string {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.getRandomValues !== "function"
  ) {
    return Math.random().toString(36).slice(2, 18);
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashVaultPassword(
  password: string,
  salt: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
  return `${salt}$${hex}`;
}

export async function createVaultEntry(
  entry: JournalEntry,
  password: string,
): Promise<JournalEntry> {
  const salt = generateVaultSalt();
  const hashed = await hashVaultPassword(password, salt);
  const updated = { ...entry };
  updated.vault = {
    isVaulted: true,
    passwordHash: hashed,
    createdAt: Date.now(),
  };
  updated.isPublic = false;
  updateJournalEntry(entry.id, updated);
  return updated;
}

export async function verifyVaultPassword(
  entry: JournalEntry,
  password: string,
): Promise<boolean> {
  if (!entry.vault || !entry.vault.passwordHash) return false;
  const [salt] = entry.vault.passwordHash.split("$");
  if (!salt) return false;
  const candidate = await hashVaultPassword(password, salt);
  return candidate === entry.vault.passwordHash;
}

export function unlockVaultEntry(entry: JournalEntry): JournalEntry {
  return { ...entry };
}

// ============ PHASE 2: CONNECTIONS ============

export function addLinkedArtifact(
  entryId: string,
  artifact: LinkedArtifact,
): void {
  journalSignal.value = journalSignal.value.map((e: JournalEntry) => {
    if (e.id === entryId) {
      const artifacts = e.linkedArtifacts || [];
      if (!artifacts.find((a) => a.id === artifact.id)) {
        return {
          ...e,
          linkedArtifacts: [...artifacts, artifact],
          updatedAt: Date.now(),
        };
      }
    }
    return e;
  });
}

export function removeLinkedArtifact(
  entryId: string,
  artifactId: string,
): void {
  journalSignal.value = journalSignal.value.map((e: JournalEntry) => {
    if (e.id === entryId && e.linkedArtifacts) {
      return {
        ...e,
        linkedArtifacts: e.linkedArtifacts.filter((a) => a.id !== artifactId),
        updatedAt: Date.now(),
      };
    }
    return e;
  });
}

export function getLinkedArtifacts(entryId: string): LinkedArtifact[] {
  const entry = journalSignal.value.find((e) => e.id === entryId);
  return entry?.linkedArtifacts || [];
}

// ============ PHASE 2: SYNTHESIS ============

export function createSynthesisEntry(
  body: string,
  synthesis: SynthesisData,
  isPublic = false,
): JournalEntry {
  const newEntry: JournalEntry = {
    id: generateSafeId("j"),
    body,
    mood: "reflective",
    tags: ["synthesis"],
    linkedItemIds: [],
    isFavorited: false,
    isPublic,
    type: "synthesis",
    synthesis,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    wordCount: body.trim().split(/\s+/).filter(Boolean).length,
  };

  journalSignal.value = [newEntry, ...journalSignal.value];
  updateStreakOnNewEntry();
  return newEntry;
}

export function getSynthesisEntries(): JournalEntry[] {
  return journalSignal.value.filter((e) => e.type === "synthesis");
}

export function getReflectionEntries(): JournalEntry[] {
  return journalSignal.value.filter((e) => !e.type || e.type === "reflection");
}

// ============ PHASE 2: COMMUNITY MODE ============

export function incrementViewCount(entryId: string): void {
  journalSignal.value = journalSignal.value.map((e: JournalEntry) => {
    if (e.id === entryId) {
      return {
        ...e,
        viewCount: (e.viewCount || 0) + 1,
      };
    }
    return e;
  });
}

export function getPublicEntries(): JournalEntry[] {
  return journalSignal.value.filter((e) =>
    e.isPublic && (!e.vault || !e.vault.isVaulted)
  );
}

export function getTrendingEntries(limit = 10): JournalEntry[] {
  return getPublicEntries()
    .sort((a, b) => {
      const aScore = calculateTrendScore(a);
      const bScore = calculateTrendScore(b);
      return bScore - aScore;
    })
    .slice(0, limit);
}

function calculateTrendScore(entry: JournalEntry): number {
  const viewWeight = (entry.viewCount || 0) * 2;
  const favoriteWeight = entry.isFavorited ? 10 : 0;
  const recencyWeight = Math.max(
    0,
    100 - (Date.now() - entry.createdAt) / 3600000,
  ); // 100 points fresh, decays over hours
  return viewWeight + favoriteWeight + recencyWeight;
}

export function getMoodDistribution(
  entries: JournalEntry[],
): Record<JournalMood, number> {
  const distribution: Record<string, number> = {};

  for (
    const mood of [
      "reflective",
      "grounded",
      "charged",
      "anxious",
      "custom",
    ]
  ) {
    distribution[mood] = 0;
  }

  for (const entry of entries) {
    const mood = entry.mood || "reflective";
    distribution[mood] = (distribution[mood] || 0) + 1;
  }

  return distribution as Record<JournalMood, number>;
}

// ============ PHASE 2: MIRROR INSIGHTS ============

export function getActivityTimeline(
  days = 30,
): Array<{ date: string; entries: number }> {
  const timeline: Map<string, number> = new Map();
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86400000).toDateString();
    timeline.set(date, 0);
  }

  for (const entry of journalSignal.value) {
    const date = new Date(entry.createdAt).toDateString();
    if (timeline.has(date)) {
      timeline.set(date, (timeline.get(date) || 0) + 1);
    }
  }

  return Array.from(timeline.entries()).map(([date, entries]) => ({
    date,
    entries,
  }));
}
