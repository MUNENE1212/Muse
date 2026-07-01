import { Handlers } from "$fresh/server.ts";
import { queryDB } from "../../../utils/db.ts";
import { getSessionUser, isDemoUser } from "../../../utils/auth.ts";
import { DEMO_STREAM } from "../../../utils/demo_data.ts";

interface StreamRow {
  id: string;
  content: string;
  tags: string[] | null;
  mood: string | null;
  timestamp: string;
  author_name: string | null;
  author_avatar: string | null;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

function safeIsoTimestamp(value: unknown): string {
  if (typeof value !== "string" || !value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function normalizeTags(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((t): t is string => typeof t === "string")
    : [];
}

function fallbackAvatar(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${
    encodeURIComponent(seed)
  }`;
}

export const handler: Handlers = {
  async GET(_req) {
    const userId = await getSessionUser(_req);
    if (isDemoUser(userId)) {
      return json({ stream: DEMO_STREAM }, 200);
    }

    const query = `
      SELECT
        j.id,
        j.raw_thought as content,
        j.tags,
        j.mood,
        j.created_at as timestamp,
        u.username as author_name,
        u.avatar_url as author_avatar
      FROM journal_entries j
      JOIN users u ON j.user_id = u.id
      WHERE j.is_public = true
      ORDER BY j.created_at DESC
      LIMIT 50
    `;

    try {
      const rows = await queryDB<StreamRow>(query);

      const stream = rows.map((entry) => {
        const authorName = entry.author_name ?? "Anonymous";
        const authorAvatar = entry.author_avatar ?? fallbackAvatar(authorName);
        return {
          id: entry.id,
          author: {
            name: authorName,
            avatar: authorAvatar,
            aura: entry.mood || "reflective",
          },
          content: entry.content,
          timestamp: safeIsoTimestamp(entry.timestamp),
          tags: normalizeTags(entry.tags),
          // demoData: random counts until interaction tables exist
          alignCount: Math.floor(Math.random() * 50),
          challengeCount: Math.floor(Math.random() * 10),
        };
      });

      return json({ stream }, 200);
    } catch (error: unknown) {
      console.error("Failed to fetch thought stream:", error);
      return json({ error: "Failed to fetch stream" }, 500);
    }
  },
};
