import { signal } from "@preact/signals";
import { itemsSignal } from "./items.ts";
import { threadsSignal } from "./threads.ts";
import {
  safeLocalGet,
  safeLocalSet,
} from "../utils/localStorage.ts";
import { generateSafeId } from "../utils/safeId.ts";

export type RoomTheme =
  | "indigo"
  | "emerald"
  | "rose"
  | "amber"
  | "cyan"
  | "slate";

export type RoomCategory =
  | "workspace"
  | "journal"
  | "archive"
  | "brainstorm"
  | "inspiration";
export type RoomSize = "small" | "medium" | "large";
export type RoomMood =
  | "focus"
  | "zen"
  | "chaos"
  | "energetic"
  | "melancholy"
  | "dreamy"
  | "noir"
  | "warm"
  | "electric"
  | "minimal"
  | "cosmic"
  | "storm";

export const MOOD_OPTIONS: {
  id: RoomMood;
  emoji: string;
  label: string;
  description: string;
}[] = [
  {
    id: "focus",
    emoji: "🎯",
    label: "Focus",
    description: "Deep work, no distractions",
  },
  {
    id: "zen",
    emoji: "🧘",
    label: "Zen",
    description: "Calm, meditative breathing",
  },
  {
    id: "chaos",
    emoji: "🌀",
    label: "Chaos",
    description: "Glitchy, raw creative energy",
  },
  {
    id: "energetic",
    emoji: "⚡",
    label: "Energetic",
    description: "Fast-paced, vibrant pulse",
  },
  {
    id: "melancholy",
    emoji: "🌧️",
    label: "Melancholy",
    description: "Thoughtful, introspective depth",
  },
  {
    id: "dreamy",
    emoji: "☁️",
    label: "Dreamy",
    description: "Soft, floating, ethereal",
  },
  {
    id: "noir",
    emoji: "🖤",
    label: "Noir",
    description: "Dark cinematic mystery",
  },
  {
    id: "warm",
    emoji: "🕯️",
    label: "Warm",
    description: "Cozy, candlelit comfort",
  },
  {
    id: "electric",
    emoji: "💜",
    label: "Electric",
    description: "Neon-lit cyberpunk haze",
  },
  {
    id: "minimal",
    emoji: "◻️",
    label: "Minimal",
    description: "Clean, stripped-back clarity",
  },
  {
    id: "cosmic",
    emoji: "🌌",
    label: "Cosmic",
    description: "Deep space, infinite scale",
  },
  {
    id: "storm",
    emoji: "🌩️",
    label: "Storm",
    description: "Intense, volatile urgency",
  },
];

export interface Room {
  id: string;
  name: string;
  description?: string;
  emoji?: string; // Room icon/emoji (e.g., 🎨, 📖, 🏗️)
  category?: RoomCategory; // Room type/template (workspace, journal, archive, brainstorm, inspiration)
  size?: RoomSize; // Room capacity (small, medium, large)
  mood?: RoomMood; // Ambient mode (focus, zen, chaos, energetic)
  themeColor: RoomTheme;
  customThemeHex?: string; // Custom hex color chosen by user (overrides themeColor if present)
  coverImage?: string;
  isPublic: boolean;
  count: number;
  tags: string[]; // Initial/managed tags for the room
  notificationsEnabled: boolean; // User notification preference for room activity
  updatedAt: string;
  semanticTags: string[];
  resonanceMetrics: {
    views: number;
    wovenCount: number; // Number of times artifacts from this room were woven into public threads
  };
  customStyling?: {
    wallpaper?: string;
    auraIntensity?: number;
    fontFamily?: string;
  };
  // Vault-related properties
  isVault?: boolean; // True if this is a private vault room
}

const STORAGE_KEY = "muse_rooms_v2";

const INITIAL_ROOMS: Room[] = [];

function loadRooms(): Room[] {
  const stored = safeLocalGet<Room[] | null>(STORAGE_KEY, null);
  if (Array.isArray(stored)) return stored;
  return INITIAL_ROOMS;
}

export const roomsSignal = signal<Room[]>(loadRooms());

roomsSignal.subscribe((rooms: Room[]) => {
  safeLocalSet(STORAGE_KEY, rooms);
});

export function addRoom(
  room: Omit<
    Room,
    "id" | "updatedAt" | "count" | "semanticTags" | "resonanceMetrics"
  >,
) {
  const newId = generateSafeId("r");
  const newRoom: Room = {
    ...room,
    id: newId,
    updatedAt: new Date().toISOString(),
    count: 0,
    semanticTags: [],
    resonanceMetrics: { views: 0, wovenCount: 0 },
  };
  roomsSignal.value = [...roomsSignal.value, newRoom];
  return newId;
}

export function updateRoomTheme(id: string, theme: RoomTheme) {
  roomsSignal.value = roomsSignal.value.map((r: Room) =>
    r.id === id ? { ...r, themeColor: theme } : r
  );
}

export function updateRoomCover(id: string, cover: string) {
  roomsSignal.value = roomsSignal.value.map((r: Room) =>
    r.id === id ? { ...r, coverImage: cover } : r
  );
}

export function toggleRoomPrivacy(id: string) {
  roomsSignal.value = roomsSignal.value.map((r: Room) =>
    r.id === id ? { ...r, isPublic: !r.isPublic } : r
  );
}

export function updateRoom(id: string, updates: Partial<Room>) {
  roomsSignal.value = roomsSignal.value.map((r: Room) =>
    r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
  );
}

export function deleteRoom(id: string) {
  // Remove the room itself
  roomsSignal.value = roomsSignal.value.filter((r: Room) => r.id !== id);

  // Remove items belonging to the room
  const removedItemIds = itemsSignal.value
    .filter((it) => it.roomId === id)
    .map((it) => it.id);

  itemsSignal.value = itemsSignal.value.filter((it) => it.roomId !== id);

  // Remove references to removed items and the room from threads
  threadsSignal.value = threadsSignal.value
    .map((t) => ({
      ...t,
      itemIds: t.itemIds.filter((iid) => !removedItemIds.includes(iid)),
      sourceRoomIds: t.sourceRoomIds.filter((rid) => rid !== id),
    }))
    // Optionally remove threads that now have no items and no source rooms
    .filter((t) => t.itemIds.length > 0 || t.sourceRoomIds.length > 0);
}

export function resetRooms() {
  roomsSignal.value = [];
}
