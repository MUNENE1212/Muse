import { Handlers } from "$fresh/server.ts";
import { queryDB } from "../../../utils/db.ts";
import { getSessionUser, isDemoUser } from "../../../utils/auth.ts";
import { DEMO_COLLABORATORS } from "../../../utils/demo_data.ts";

interface CollaboratorRow {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const FALLBACK_AVATAR = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${
    encodeURIComponent(seed)
  }`;

function deriveName(row: CollaboratorRow): string {
  if (row.username && row.username.trim()) return row.username;
  if (row.email && row.email.includes("@")) return row.email.split("@")[0];
  return row.id;
}

export const handler: Handlers = {
  async GET(req) {
    const userId = await getSessionUser(req);
    if (isDemoUser(userId)) {
      return json({ collaborators: DEMO_COLLABORATORS, demo: true }, 200);
    }
    if (!userId) {
      return json({ error: "Unauthorized" }, 401);
    }

    try {
      const users = await queryDB<CollaboratorRow>(
        `
        SELECT id, username, email, avatar_url
        FROM users
        WHERE id != $1
        LIMIT 10
      `,
        userId,
      );

      const roles = ["Synthesizer", "Architect", "Challenger", "Observer"];
      const statuses = ["Online", "Reflecting", "Deep Focus", "Offline"];
      const auras = ["#60a5fa", "#34d399", "#fbbf24", "#fb7185"];
      const intelligenceProfiles = ["Synthesizer", "Architect", "Challenger"];

      const collaborators = users.map((row: CollaboratorRow, i: number) => {
        const name = deriveName(row);
        return {
          id: row.id,
          name,
          avatar: row.avatar_url || FALLBACK_AVATAR(name),
          role: roles[i % roles.length],
          status: statuses[i % statuses.length],
          bio: "Exploring the intersections of systems and human thought.",
          sharedThemes: ["Next.js", "AI", "Design Systems"],
          aura: auras[i % auras.length],
          intelligenceProfile:
            intelligenceProfiles[i % intelligenceProfiles.length],
          // demoData: random value used until real resonance scoring ships
          matchPercentage: Math.floor(Math.random() * 30) + 70,
          topCitedNode: "Mental Models for Engineers",
        };
      });

      return json({ collaborators, demo: true }, 200);
    } catch (error: unknown) {
      console.error("Failed to fetch collaborators:", error);
      return json({ error: "Failed to fetch collaborators" }, 500);
    }
  },
};
