import { executeDB, queryDB } from "../../utils/db.ts";
import {
  isDemoUser,
  requireDemoOrSession,
} from "../../utils/auth.ts";
import { DEMO_USER } from "../../utils/demo_data.ts";

const USER_FOLLOWS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS user_follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id)
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

async function aggregateCount(
  query: string,
  ...args: unknown[]
): Promise<number> {
  const rows = await queryDB(query, ...args) as { count: number }[];
  return rows[0]?.count ?? 0;
}

export const handler = async (req: Request) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let sessionUserId: string;
  try {
    sessionUserId = await requireDemoOrSession(req);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return jsonResponse({ error: "userId required" }, 400);
    }

    if (!isDemoUser(sessionUserId) && userId !== sessionUserId) {
      return jsonResponse(
        { error: "userId must match the active session" },
        403,
      );
    }

    if (isDemoUser(sessionUserId)) {
      return jsonResponse(
        {
          stats: {
            views: 0,
            likes: 0,
            comments: 0,
            collaborations: 0,
            follows: 0,
            circleJoins: 0,
            followerCount: 0,
            followingCount: 0,
            followerHistory: [],
          },
          activity: [],
          followerCount: 0,
          followingCount: 0,
          followerHistory: [],
          isLoading: false,
          error: null,
          demo: true,
          user: DEMO_USER.id,
        },
        200,
      );
    }

    await ensureFollowsTable();

    const [
      journalCount,
      roomCount,
      artifactCount,
      threadCount,
      followerCount,
      followingCount,
      historyRows,
    ] = await Promise.all([
      aggregateCount(
        `SELECT COUNT(*)::int AS count FROM journal_entries WHERE user_id = $1`,
        userId,
      ),
      aggregateCount(
        `SELECT COUNT(*)::int AS count FROM rooms WHERE user_id = $1`,
        userId,
      ),
      aggregateCount(
        `SELECT COUNT(*)::int AS count FROM artifacts a
         JOIN rooms r ON r.id = a.room_id
         WHERE r.user_id = $1`,
        userId,
      ),
      aggregateCount(
        `SELECT COUNT(*)::int AS count FROM threads t
         JOIN rooms r ON r.id = t.room_id
         WHERE r.user_id = $1`,
        userId,
      ),
      aggregateCount(
        `SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`,
        userId,
      ),
      aggregateCount(
        `SELECT COUNT(*)::int AS count FROM user_follows WHERE follower_id = $1`,
        userId,
      ),
      queryDB(
        `SELECT to_char(date_trunc('day', created_at), 'Dy') AS day,
                COUNT(*)::int AS count
         FROM user_follows
         WHERE following_id = $1
           AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY day
         ORDER BY MIN(created_at)`,
        userId,
      ) as Promise<{ day: string; count: number }[]>,
    ]);

    const followerHistory = (historyRows ?? []).map((row) => ({
      date: row.day,
      count: row.count,
    }));

    const stats = {
      views: journalCount,
      likes: 0,
      comments: 0,
      collaborations: 0,
      follows: followerCount,
      circleJoins: 0,
      followerCount,
      followingCount,
      followerHistory,
    };

    return jsonResponse(
      {
        stats,
        activity: [],
        followerCount,
        followingCount,
        followerHistory,
        isLoading: false,
        error: null,
      },
      200,
    );
  } catch (_err) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};