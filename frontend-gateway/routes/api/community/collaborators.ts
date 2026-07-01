import { Handlers } from "$fresh/server.ts";
import { queryDB } from "../../../utils/db.ts";
import { getSessionUser, isDemoUser } from "../../../utils/auth.ts";
import { DEMO_COLLABORATORS } from "../../../utils/demo_data.ts";

export const handler: Handlers = {
  async GET(req) {
    const userId = await getSessionUser(req);
    // Demo mode — return template collaborators
    if (isDemoUser(userId)) {
      return new Response(
        JSON.stringify({ collaborators: DEMO_COLLABORATORS }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    try {
      // In production, match users based on shared tags in journal_entries
      // For now, we will select random users to simulate the network
      const users = await queryDB(
        `
        SELECT id, username, email, avatar_url
        FROM users
        WHERE id != $1
        LIMIT 10
      `,
        userId,
      );

      const collaborators = users.map((e: unknown, i: number) => {
        const u = e as Record<string, unknown>;
        const email = typeof u.email === "string" ? u.email : null;
        const fallbackName = email ? email.split("@")[0] : `explorer-${i}`;
        const username = typeof u.username === "string"
          ? u.username
          : fallbackName;
        return {
          id: u.id,
          name: u.username || fallbackName,
          avatar: u.avatar_url ||
            "https://api.dicebear.com/7.x/avataaars/svg?seed=" + username,
          role: ["Synthesizer", "Architect", "Challenger", "Observer"][i % 4],
          status: ["Online", "Reflecting", "Deep Focus", "Offline"][i % 4],
          bio: "Exploring the intersections of systems and human thought.",
          sharedThemes: ["Next.js", "AI", "Design Systems"],
          aura: ["#60a5fa", "#34d399", "#fbbf24", "#fb7185"][i % 4],
          intelligenceProfile:
            ["Synthesizer", "Architect", "Challenger"][i % 3],
          matchPercentage: Math.floor(Math.random() * 30) + 70, // 70-99%
          topCitedNode: "Mental Models for Engineers",
        };
      });

      return new Response(JSON.stringify({ collaborators }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: unknown) {
      console.error("Failed to fetch collaborators:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch collaborators" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};
