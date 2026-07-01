import { signal } from "@preact/signals";
import { journalSignal } from "./journal.ts";
import { roomsSignal } from "./rooms.ts";
import { threadsSignal } from "./threads.ts";

export interface EngagementStats {
  views: number;
  likes: number;
  comments: number;
  collaborations: number;
  follows: number;
  circleJoins: number;
}

export interface ActivityEntry {
  id: string;
  type: "follow" | "like" | "comment" | "join_circle" | "collaborate" | "view";
  actor: string;
  actorAvatar: string;
  target?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface MirrorStats {
  stats: EngagementStats;
  activity: ActivityEntry[];
  followerCount: number;
  followingCount: number;
  followerHistory: { date: string; count: number }[];
  isLoading: boolean;
  error: string | null;
}

const initialState: MirrorStats = {
  stats: {
    views: 1250,
    likes: 342,
    comments: 89,
    collaborations: 23,
    follows: 156,
    circleJoins: 12,
  },
  activity: [
    {
      id: "act-1",
      type: "follow",
      actor: "Sarah Chen",
      actorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      timestamp: new Date(Date.now() - 5 * 60000),
    },
    {
      id: "act-2",
      type: "like",
      actor: "Marcus Webb",
      actorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus",
      target: "Your thought on AI consciousness",
      timestamp: new Date(Date.now() - 15 * 60000),
    },
    {
      id: "act-3",
      type: "comment",
      actor: "Elena Rodriguez",
      actorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena",
      target: "Your artifact: Design Patterns",
      timestamp: new Date(Date.now() - 45 * 60000),
    },
    {
      id: "act-4",
      type: "join_circle",
      actor: "Alex Park",
      actorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
      target: "Digital Architects",
      timestamp: new Date(Date.now() - 2 * 3600000),
    },
    {
      id: "act-5",
      type: "collaborate",
      actor: "Jordan Bell",
      actorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
      target: "Blockchain Ethics",
      timestamp: new Date(Date.now() - 4 * 3600000),
    },
  ],
  followerCount: 156,
  followingCount: 89,
  followerHistory: [
    { date: "Mon", count: 120 },
    { date: "Tue", count: 128 },
    { date: "Wed", count: 135 },
    { date: "Thu", count: 142 },
    { date: "Fri", count: 149 },
    { date: "Sat", count: 154 },
    { date: "Sun", count: 156 },
  ],
  isLoading: false,
  error: null,
};

export const mirrorSignal = signal<MirrorStats>(initialState);

export const loadMirrorStats = (userId: string) => {
  mirrorSignal.value = {
    ...mirrorSignal.value,
    isLoading: true,
    error: null,
  };

  const journals = journalSignal.value;
  const rooms = roomsSignal.value;
  const threads = threadsSignal.value;

  const followerHistory = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toLocaleDateString("en-US", { weekday: "short" }),
      count: 120 + i * 5 + Math.floor(Math.random() * 10),
    };
  });

  mirrorSignal.value = {
    ...initialState,
    stats: {
      views: journals.length * 15 + threads.length * 20,
      likes: journals.filter((j) => j.isFavorited).length * 5,
      comments: threads.length * 3,
      collaborations: rooms.length * 2,
      follows: 156,
      circleJoins: rooms.length,
    },
    followerHistory,
    isLoading: false,
  };
};

export const refreshMirrorStats = (userId: string) => {
  loadMirrorStats(userId);
};
