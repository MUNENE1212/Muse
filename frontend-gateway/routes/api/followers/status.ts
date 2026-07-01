import { executeDB, queryDB } from "../../../utils/db.ts";
import {
  isDemoUser,
  requireDemoOrSession,
} from "../../../utils/auth.ts";

const USER_FOLLOWS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS user_follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id)
  )
`;

async function ensureFollowsTable() {
  await executeDB(USER_FOLLOWS_SCHEMA);
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const handler = async (req: Request) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let currentUserId: string;
  try {
    currentUserId = await requireDemoOrSession(req);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  try {
    const url = new URL(req.url);
    const userIdParam = url.searchParams.get("userId");
    const targetUserId = url.searchParams.get("targetUserId");

    if (!userIdParam || !targetUserId) {
      return jsonResponse(
        { error: "userId and targetUserId required" },
        400,
      );
    }

    if (!isDemoUser(currentUserId) && userIdParam !== currentUserId) {
      return jsonResponse(
        { error: "userId must match the active session" },
        403,
      );
    }

    if (isDemoUser(currentUserId)) {
      return jsonResponse({ isFollowing: false, demo: true }, 200);
    }

    await ensureFollowsTable();

    const rows = await queryDB(
      `SELECT 1 FROM user_follows
       WHERE follower_id = $1 AND followed_id = $2
       LIMIT 1`,
      userIdParam,
      targetUserId,
    );

    return jsonResponse({ isFollowing: rows.length > 0 }, 200);
  } catch (_err) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};