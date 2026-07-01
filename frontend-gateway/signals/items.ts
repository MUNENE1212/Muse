import { signal } from "@preact/signals";
import { removeItemFromThread, threadsSignal } from "./threads.ts";
import {
  safeLocalGet,
  safeLocalSet,
} from "../utils/localStorage.ts";
import { generateSafeId } from "../utils/safeId.ts";

export interface Item {
  id: string;
  roomId: string;
  title: string;
  sourceUrl: string;
  note?: string;
  isPublic: boolean;
  createdAt: string;
  // PERSISTENCE METADATA
  storedContent?: string; // The extracted raw data (text, JSON, etc.)
  localMediaPath?: string; // Path to the locally stored image/video
  dataProvenance: {
    platform: string;
    extractedAt: string;
    integrityHash: string;
  };
}

const STORAGE_KEY = "muse_items_v2";

const INITIAL_ITEMS: Item[] = [
  {
    id: "i1",
    roomId: "r1",
    title: "Voter Turnout Statistics 2024",
    sourceUrl: "https://politics.news/voter-turnout",
    note:
      "The lowest engagement we've seen in a decade for municipal elections.",
    isPublic: true,
    createdAt: new Date().toISOString(),
    dataProvenance: {
      platform: "Web",
      extractedAt: new Date().toISOString(),
      integrityHash: "sha256-a1b2c3",
    },
  },
  {
    id: "i2",
    roomId: "r1",
    title: "City Council Zoning Proposal",
    sourceUrl: "https://localgov.city/zoning",
    note: "This will affect housing availability dramatically.",
    isPublic: true,
    createdAt: new Date().toISOString(),
    dataProvenance: {
      platform: "Web",
      extractedAt: new Date().toISOString(),
      integrityHash: "sha256-d4e5f6",
    },
  },
  {
    id: "i3",
    roomId: "r2",
    title: "The 5 Love Languages Explained",
    sourceUrl: "https://psychology.com/love-languages",
    note:
      "Fascinating how acts of service can be misinterpreted if your partner values words of affirmation.",
    isPublic: false,
    createdAt: new Date().toISOString(),
    dataProvenance: {
      platform: "Web",
      extractedAt: new Date().toISOString(),
      integrityHash: "sha256-x7y8z9",
    },
  },
];

function loadItems(): Item[] {
  const stored = safeLocalGet<Item[] | null>(STORAGE_KEY, null);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return INITIAL_ITEMS;
}

export const itemsSignal = signal<Item[]>(loadItems());

itemsSignal.subscribe((items: Item[]) => {
  safeLocalSet(STORAGE_KEY, items);
});

export function addItem(
  item: Omit<Item, "id" | "createdAt" | "dataProvenance">,
) {
  const newItem: Item = {
    ...item,
    id: generateSafeId("i"),
    createdAt: new Date().toISOString(),
    dataProvenance: {
      platform: item.sourceUrl.includes("x.com") ? "X" : "Web",
      extractedAt: new Date().toISOString(),
      integrityHash: "sha256-" + Math.random().toString(16).slice(2, 10),
    },
  };
  itemsSignal.value = [newItem, ...itemsSignal.value];
}

export function deleteItem(id: string) {
  // Remove the item from the store
  itemsSignal.value = itemsSignal.value.filter((i: Item) => i.id !== id);

  // Remove references to this item from all threads
  threadsSignal.value.forEach((t) => {
    if (t.itemIds.includes(id)) {
      removeItemFromThread(t.id, id);
    }
  });
}

export function resetItems() {
  itemsSignal.value = [];
}
