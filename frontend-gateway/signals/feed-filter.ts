import { signal } from "@preact/signals";
import { type Perspective } from "./connections.ts";

export interface FeedFilter {
  type: "all" | "following";
  count: number;
}

export const feedFilterSignal = signal<FeedFilter>({
  type: "all",
  count: 0,
});

export const setFeedFilter = (type: "all" | "following") => {
  feedFilterSignal.value = {
    ...feedFilterSignal.value,
    type,
  };
};

export const filterPerspectivesByFollowing = (
  perspectives: Perspective[],
  followingNames: string[],
  filterType: "all" | "following",
): Perspective[] => {
  if (filterType === "all") {
    return perspectives;
  }

  const allowed = new Set(followingNames);
  return perspectives.filter((p) => allowed.has(p.author.name));
};
