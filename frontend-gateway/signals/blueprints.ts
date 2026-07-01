import { signal } from "@preact/signals";
import { addThread, type ThreadMood } from "./threads.ts";

export interface ThreadBlueprint {
  id: string;
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedMood: ThreadMood;
  itemIds: string[];
  sourceRoomIds: string[];
  thesis: string;
  confidenceScore: number; // 0-100% AI confidence in this pattern
  status: "pending" | "accepted" | "refining" | "discarded";
  createdAt: string;
}

export const blueprintsSignal = signal<ThreadBlueprint[]>([
  {
    id: "bp1",
    suggestedTitle: "The Architecture of Sovereignty",
    suggestedDescription:
      "A recurring pattern found across your Aesthetic Brutalism and Cognitive Stoicism rooms.",
    suggestedMood: "focus",
    itemIds: ["i1", "i2"],
    sourceRoomIds: ["r1", "r2"],
    thesis:
      "Your curation suggests that raw, honest digital forms are a prerequisite for personal sovereignty.",
    confidenceScore: 92,
    status: "pending",
    createdAt: new Date().toISOString(),
  },
]);

export function acceptBlueprint(id: string) {
  const bp = blueprintsSignal.value.find((b) => b.id === id);
  if (!bp) return undefined;

  // Mark blueprint accepted
  blueprintsSignal.value = blueprintsSignal.value.map((b) =>
    b.id === id ? { ...b, status: "accepted" } : b
  );

  // Create a new thread from the blueprint and return its id
  return addThread({
    title: bp.suggestedTitle,
    description: bp.suggestedDescription,
    mood: bp.suggestedMood,
    itemIds: bp.itemIds,
    sourceRoomIds: bp.sourceRoomIds,
    isPublic: true,
    thesis: bp.thesis,
  });
}

export function discardBlueprint(id: string) {
  blueprintsSignal.value = blueprintsSignal.value.map((bp) =>
    bp.id === id ? { ...bp, status: "discarded" } : bp
  );
}

export function updateBlueprintThesis(id: string, newThesis: string) {
  blueprintsSignal.value = blueprintsSignal.value.map((bp) =>
    bp.id === id ? { ...bp, thesis: newThesis, status: "refining" } : bp
  );
}
