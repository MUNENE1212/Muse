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

interface ProfileRow {
  id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  resonance_score: number | null;
}

function profileFromRow(row: ProfileRow, fallbackSeed: string) {
  const fallbackName = row.email ? row.email.split("@")[0] : fallbackSeed;
  return {
    id: row.id,
    name: row.username || fallbackName,
    username: row.username || fallbackSeed,
    avatarUrl: row.avatar_url ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.username}`,
    bio: "Explorer of ideas",
    auraColor: ["#6366f1", "#8b5cf6", "#d946ef"][Math.abs(
      row.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
    ) % 3],
    resonanceScore: row.resonance_score ?? 0,
  };
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
    await ensureFollowsTable();

    if (isDemoUser(currentUserId)) {
      return jsonResponse(
        {
          demo: true,
          followers: [profileFromRow(
            {
              id: DEMO_USER.id,
              username: DEMO_USER.username,
              email: DEMO_USER.email,
              avatar_url: DEMO_USER.avatarUrl,
              resonance_score: 88,
            },
            DEMO_USER.username,
          )],
          following: [],
          followerCount: 1,
          followingCount: 0,
        },
        200,
      );
    }

    const followingRows = await queryDB(
      `SELECT u.id, u.username, u.email, u.avatar_url, u.resonance_score
       FROM user_follows f
       JOIN users u ON u.id = f.followed_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC`,
      currentUserId,
    );

    const followerRows = await queryDB(
      `SELECT u.id, u.username, u.email, u.avatar_url, u.resonance_score
       FROM user_follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.followed_id = $1
       ORDER BY f.created_at DESC`,
      currentUserId,
    );

    const following = (followingRows as ProfileRow[]).map((row, i) =>
      profileFromRow(row, `following-${i}`)
    );
    const followers = (followerRows as ProfileRow[]).map((row, i) =>
      profileFromRow(row, `follower-${i}`)
    );

    return jsonResponse(
      {
        followers,
        following,
        followerCount: followers.length,
        followingCount: following.length,
      },
      200,
    );
  } catch (_err) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};