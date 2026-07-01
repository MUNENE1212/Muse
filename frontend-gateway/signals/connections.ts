import { signal } from "@preact/signals";

export interface ActiveCircle {
  id: string;
  name: string;
  description: string;
  theme: string;
  memberCount: number;
  recentActivity: string;
  members: { avatar: string }[];
}

export interface Collaborator {
  id: string;
  name: string;
  avatar: string;
  role: string;
  status: "Online" | "Reflecting" | "Deep Focus" | "Offline";
  bio: string;
  sharedThemes: string[];
  aura: string;
  intelligenceProfile: string;
  matchPercentage: number;
  topCitedNode: string;
}

export interface CommunityRoom {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  coverImage: string;
}

export interface Perspective {
  id: string;
  author: {
    name: string;
    avatar: string;
    aura: string;
  };
  content: string;
  timestamp: string;
  relationship: "Resonating" | "Challenging" | "Synthesizing" | "Initial";
  targetId?: string;
  source?: string;
  txId?: string; // Ledger Transaction ID
  encryptionStatus?: "Secure" | "End-to-End" | "Standard";
  isAnalyzing?: boolean; // Parallel Analysis state
  alignCount: number;
  challengeCount: number;
}

export interface WisdomNode {
  id: string;
  topic: string;
  x: number;
  y: number;
  radius: number;
  connectedTo: string[];
}

export interface SyncEngineStatus {
  nodesActive: number;
  latency: string;
  throughput: string;
  health: "Optimal" | "Degraded" | "Critical";
}

export const syncStatusSignal = signal<SyncEngineStatus>({
  nodesActive: 12,
  latency: "2ms",
  throughput: "1.2k req/s",
  health: "Optimal",
});

export const circlesSignal = signal<ActiveCircle[]>([
  {
    id: "c1",
    name: "Modern Romance & Relationships",
    description:
      "Discussing the nuances of dating, love languages, and long-term connection.",
    theme: "Relationships",
    memberCount: 124,
    recentActivity: "8m ago",
    members: [{ avatar: "" }, { avatar: "" }, { avatar: "" }],
  },
  {
    id: "c2",
    name: "Local Politics Watch",
    description:
      "Tracking municipal changes, zoning laws, and community engagement.",
    theme: "Politics",
    memberCount: 86,
    recentActivity: "15m ago",
    members: [{ avatar: "" }, { avatar: "" }],
  },
]);

export const collaboratorsSignal = signal<Collaborator[]>([
  {
    id: "p1",
    name: "Amina El-Sayed",
    avatar:
      "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=150&q=80",
    role: "Community Organizer",
    status: "Deep Focus",
    bio:
      "Local changes matter more than national headlines. Let's build from the ground up.",
    sharedThemes: ["Politics", "Community"],
    aura: "cyan",
    intelligenceProfile: "Architect",
    matchPercentage: 92,
    topCitedNode: "Local changes matter more than national headlines.",
  },
  {
    id: "p2",
    name: "Marcus Thorne",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    role: "Relationship Coach",
    status: "Online",
    bio: "Understanding attachment styles is the key to lasting connection.",
    sharedThemes: ["Relationships", "Psychology"],
    aura: "purple",
    intelligenceProfile: "Challenger",
    matchPercentage: 78,
    topCitedNode: "Attachment styles dictate how we perceive conflict.",
  },
  {
    id: "p3",
    name: "Elena V.",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    role: "Policy Analyst",
    status: "Reflecting",
    bio:
      "Data doesn't lie, but it doesn't tell the whole story without context.",
    sharedThemes: ["Politics", "Data"],
    aura: "emerald",
    intelligenceProfile: "Synthesizer",
    matchPercentage: 85,
    topCitedNode: "We need better data to understand voter apathy.",
  },
]);

export const communityRoomsSignal = signal<CommunityRoom[]>([
  {
    id: "cr1",
    name: "The Civic Square",
    description: "Public archive of local policies and their societal impact.",
    memberCount: 412,
    coverImage:
      "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80",
  },
]);

export const wisdomNodesSignal = signal<WisdomNode[]>([
  {
    id: "w1",
    topic: "Civic Duty",
    x: 200,
    y: 150,
    radius: 60,
    connectedTo: ["w2", "w3"],
  },
  {
    id: "w2",
    topic: "Love Languages",
    x: 400,
    y: 100,
    radius: 45,
    connectedTo: ["w1"],
  },
  {
    id: "w3",
    topic: "Attachment Styles",
    x: 350,
    y: 300,
    radius: 50,
    connectedTo: ["w1"],
  },
  {
    id: "w4",
    topic: "Voter Turnout",
    x: 600,
    y: 200,
    radius: 40,
    connectedTo: [],
  },
]);

export const perspectivesSignal = signal<Perspective[]>([
  {
    id: "per1",
    author: { name: "Amina El-Sayed", avatar: "", aura: "cyan" },
    content:
      "If we want to fix national politics, we have to start at the city council level.",
    timestamp: "2m ago",
    relationship: "Initial",
    source: "Journal",
    txId: "0x8f...3a2",
    encryptionStatus: "End-to-End",
    alignCount: 87,
    challengeCount: 12,
  },
  {
    id: "per2",
    author: { name: "Marcus Thorne", avatar: "", aura: "purple" },
    content:
      "I agree, but we also need to consider how political stress impacts our close relationships.",
    timestamp: "Just now",
    relationship: "Challenging",
    targetId: "per1",
    source: "Vault",
    txId: "0x4c...9b1",
    encryptionStatus: "End-to-End",
    alignCount: 42,
    challengeCount: 3,
  },
]);

export function submitPerspective(
  content: string,
  targetId?: string,
  source?: string,
) {
  const newId = "per-" + Date.now();
  const txId = "0x" + Math.random().toString(16).slice(2, 10) + "..." +
    Math.random().toString(16).slice(2, 6);

  const newPerspective: Perspective = {
    id: newId,
    author: { name: "Alex Rivera", avatar: "", aura: "indigo" },
    content,
    timestamp: "Just now",
    relationship: targetId
      ? (Math.random() > 0.5 ? "Resonating" : "Synthesizing")
      : "Initial",
    targetId,
    source,
    txId,
    encryptionStatus: "End-to-End",
    isAnalyzing: true,
    alignCount: 1,
    challengeCount: 0,
  };

  perspectivesSignal.value = [newPerspective, ...perspectivesSignal.value];

  // Simulate Parallel Analysis
  setTimeout(() => {
    perspectivesSignal.value = perspectivesSignal.value.map((p: Perspective) =>
      p.id === newId ? { ...p, isAnalyzing: false } : p
    );
  }, 2000);
}

export function alignWithPerspective(id: string) {
  perspectivesSignal.value = perspectivesSignal.value.map((p) => {
    if (p.id === id) {
      return { ...p, alignCount: p.alignCount + 1 };
    }
    return p;
  });
}

export function challengePerspective(id: string) {
  perspectivesSignal.value = perspectivesSignal.value.map((p) => {
    if (p.id === id) {
      return { ...p, challengeCount: p.challengeCount + 1 };
    }
    return p;
  });
}

export function synthesizePerspective(content: string, targetId: string) {
  submitPerspective(content, targetId, "Journal Synthesis");
}

export const insightsSignal = signal<string[]>([
  "Local Elections are trending across 3 rooms in your network.",
  "Your synthesis on 'Love Languages' has 86 resonance connections.",
  "Community dialogue is shifting toward civic engagement.",
]);

export const activeThemesSignal = signal<string[]>([
  "Politics",
  "Relationships",
  "Psychology",
  "Community",
  "Civic Duty",
  "Attachment Styles",
]);

// Map Selection State
export const activeWisdomFocusSignal = signal<string | null>(null);

export function setActiveWisdomFocus(nodeId: string | null) {
  activeWisdomFocusSignal.value = nodeId;
}
