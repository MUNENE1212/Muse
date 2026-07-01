import { executeDB, queryDB } from "../../../utils/db.ts";
import {
  isDemoUser,
  requireDemoOrSession,
} from "../../../utils/auth.ts";
import { DEMO_USER } from "../../../utils/demo_data.ts";

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
  if (req.method !== "POST") {
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
    await ensureFollowsTable();

    const { targetUserId } = await req.json();

    if (!targetUserId || typeof targetUserId !== "string") {
      return jsonResponse({ error: "targetUserId required" }, 400);
    }

    if (targetUserId === currentUserId) {
      return jsonResponse({ error: "Cannot follow yourself" }, 400);
    }

    if (isDemoUser(currentUserId)) {
      return jsonResponse(
        {
          success: true,
          action: "followed",
          demo: true,
          follower: DEMO_USER.id,
          target: targetUserId,
        },
        200,
      );
    }

    await executeDB(
      `INSERT INTO user_follows (follower_id, followed_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, followed_id) DO NOTHING`,
      currentUserId,
      targetUserId,
    );

    return jsonResponse({ success: true, action: "followed" }, 200);
  } catch (_err) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};