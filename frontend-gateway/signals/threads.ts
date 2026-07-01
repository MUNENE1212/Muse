import { signal } from "@preact/signals";
import {
  safeLocalGet,
  safeLocalSet,
} from "../utils/localStorage.ts";
import { generateSafeId } from "../utils/safeId.ts";

export type ThreadMood = string;

export type ThreadFormat = string;
export type ThreadDepth = string;

export interface DialogueLayer {
  id: string;
  userId: string;
  userName: string;
  content: string;
  type: "insight" | "challenge" | "signal";
  resonanceScore: number;
  timestamp: string;
}

export interface Thread {
  id: string;
  title: string;
  description: string;
  mood: ThreadMood;
  format?: ThreadFormat;
  depth?: ThreadDepth;
  theme?: string;
  itemIds: string[];
  sourceRoomIds: string[];
  isPublic: boolean;
  isFavorited?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  updatedAt: string;
  coverImage?: string;
  thesis?: string;
  synthesisScore: number;
  resonanceMetrics: {
    views: number;
    connections: number; // Other threads that link back to this synthesis
  };
  dialogueLayers: DialogueLayer[]; // The "Rich Comment" section
  customStyling?: {
    auraGradients: string[];
    wallpaper?: string;
    fontFamily?: string;
  };
  // Vault functionality (now ties into the global vault)
  isVault?: boolean; // Private thread protected by the Master Vault Password
  // Synthesis analysis
  synthesis?: {
    patterns: string[];
    tensions: string[];
    coherenceScore: number;
    recommendations: string[];
  };
}

const STORAGE_KEY = "muse_threads_v2";

const INITIAL_THREADS: Thread[] = [
  {
    id: "t1",
    title: "The Impact of Local Elections",
    description:
      "Analyzing how municipal votes shape daily life more than national ones.",
    mood: "focus",
    format: "essay",
    depth: "50",
    itemIds: ["i1", "i2"],
    sourceRoomIds: ["r1"],
    isPublic: true,
    updatedAt: new Date().toISOString(),
    coverImage:
      "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80",
    thesis:
      "Local elections have more direct impact on our communities, yet they suffer the lowest turnout.",
    synthesisScore: 88,
    resonanceMetrics: { views: 1240, connections: 86 },
    dialogueLayers: [
      {
        id: "d1",
        userId: "u2",
        userName: "Elena",
        content:
          "This is so true. Our city council just passed a zoning law that completely changed my neighborhood, and only 15% of people voted on it.",
        type: "insight",
        resonanceScore: 42,
        timestamp: new Date().toISOString(),
      },
    ],
    customStyling: {
      auraGradients: ["#6366f1", "#10b981"],
    },
    synthesis: {
      patterns: ["local engagement", "policy impact", "voter apathy"],
      tensions: ["national media focus vs local reality"],
      coherenceScore: 85,
      recommendations: [
        "Explore ways to make local election information more accessible",
      ],
    },
    isVault: false,
  },
  {
    id: "t2",
    title: "The Evolution of Modern Dating",
    description:
      "How dating apps and social media have shifted human connection.",
    mood: "melancholy",
    format: "manifesto",
    depth: "80",
    itemIds: ["i3"],
    sourceRoomIds: ["r2"],
    isPublic: true,
    updatedAt: new Date().toISOString(),
    coverImage:
      "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1200&q=80",
    thesis:
      "Modern dating apps have fundamentally shifted human connection from serendipitous moments to gamified transactions.",
    synthesisScore: 75,
    resonanceMetrics: { views: 890, connections: 45 },
    dialogueLayers: [],
    customStyling: {
      auraGradients: ["#f43f5e", "#fbbf24"],
    },
    synthesis: {
      patterns: ["gamification", "choice paralysis", "digital romance"],
      tensions: ["efficiency vs authentic connection"],
      coherenceScore: 78,
      recommendations: [
        "Look into the psychological effects of endless swiping",
      ],
    },
    isVault: false,
  },
];

function loadThreads(): Thread[] {
  const stored = safeLocalGet<Thread[] | null>(STORAGE_KEY, null);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return INITIAL_THREADS;
}

export const threadsSignal = signal<Thread[]>(loadThreads());

threadsSignal.subscribe((threads: Thread[]) => {
  safeLocalSet(STORAGE_KEY, threads);
});

export function addThread(
  thread: Omit<
    Thread,
    | "id"
    | "updatedAt"
    | "synthesisScore"
    | "resonanceMetrics"
    | "dialogueLayers"
  >,
) {
  const newId = generateSafeId("t");
  const newThread: Thread = {
    ...thread,
    id: newId,
    updatedAt: new Date().toISOString(),
    synthesisScore: Math.floor(Math.random() * 40) + 60,
    resonanceMetrics: { views: 0, connections: 0 },
    dialogueLayers: [],
  };
  threadsSignal.value = [...threadsSignal.value, newThread];
  return newId;
}

export function addDialogueLayer(
  threadId: string,
  layer: Omit<DialogueLayer, "id" | "resonanceScore" | "timestamp">,
) {
  threadsSignal.value = threadsSignal.value.map((t) => {
    if (t.id === threadId) {
      const newLayer: DialogueLayer = {
        ...layer,
        id: generateSafeId("d"),
        resonanceScore: 0,
        timestamp: new Date().toISOString(),
      };
      return { ...t, dialogueLayers: [...t.dialogueLayers, newLayer] };
    }
    return t;
  });
}

export function toggleThreadPrivacy(id: string) {
  threadsSignal.value = threadsSignal.value.map((t) =>
    t.id === id ? { ...t, isPublic: !t.isPublic } : t
  );
}

export function updateThreadMood(id: string, mood: ThreadMood) {
  threadsSignal.value = threadsSignal.value.map((t) =>
    t.id === id ? { ...t, mood, updatedAt: new Date().toISOString() } : t
  );
}

export function removeItemFromThread(threadId: string, itemId: string) {
  threadsSignal.value = threadsSignal.value.map((t) =>
    t.id === threadId
      ? {
        ...t,
        itemIds: t.itemIds.filter((i) => i !== itemId),
        updatedAt: new Date().toISOString(),
      }
      : t
  );
}

export function resetThreads() {
  threadsSignal.value = [];
}

export function toggleFavoriteThread(id: string) {
  threadsSignal.value = threadsSignal.value.map((thread) =>
    thread.id === id ? { ...thread, isFavorited: !thread.isFavorited } : thread
  );
}

export function togglePinThread(id: string) {
  threadsSignal.value = threadsSignal.value.map((thread) =>
    thread.id === id ? { ...thread, isPinned: !thread.isPinned } : thread
  );
}

export function toggleArchiveThread(id: string) {
  threadsSignal.value = threadsSignal.value.map((thread) =>
    thread.id === id ? { ...thread, isArchived: !thread.isArchived } : thread
  );
}

export function deleteThread(id: string) {
  threadsSignal.value = threadsSignal.value.filter((t) => t.id !== id);
}
