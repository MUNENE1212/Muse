import { Handlers } from "$fresh/server.ts";
import { queryDB } from "../../../utils/db.ts";
import { getSessionUser, isDemoUser } from "../../../utils/auth.ts";
import { DEMO_STREAM } from "../../../utils/demo_data.ts";

export const handler: Handlers = {
  async GET(_req) {
    const _userId = await getSessionUser(_req);

    // Demo mode — return template stream immediately
    if (isDemoUser(_userId)) {
      return new Response(JSON.stringify({ stream: DEMO_STREAM }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // In production, we select public journal entries across all users
    // We join with the users table to get the author's details.
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
      const rawEntries = await queryDB(query);

      const stream = rawEntries.map((e: unknown) => {
        const entry = e as Record<string, unknown>;
        const authorName = typeof entry.author_name === "string"
          ? entry.author_name
          : "Anonymous";
        const authorAvatar = typeof entry.author_avatar === "string" &&
            entry.author_avatar.length > 0
          ? entry.author_avatar
          : "https://api.dicebear.com/7.x/avataaars/svg?seed=" + authorName;
        const timestampRaw = entry.timestamp;
        const timestamp = timestampRaw
          ? new Date(timestampRaw as string).toISOString()
          : new Date().toISOString();
        return {
          id: entry.id,
          author: {
            name: authorName,
            avatar: authorAvatar,
            aura: entry.mood || "reflective", // Map mood to aura color for UI
          },
          content: entry.content,
          timestamp,
          tags: entry.tags || [],
          // Mocking alignment and challenge counts for now until we build interaction tables
          alignCount: Math.floor(Math.random() * 50),
          challengeCount: Math.floor(Math.random() * 10),
        };
      });

      return new Response(JSON.stringify({ stream }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: unknown) {
      console.error("Failed to fetch thought stream:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch stream" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};
