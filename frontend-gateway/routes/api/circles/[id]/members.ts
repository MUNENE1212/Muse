import { FreshContext } from "$fresh/server.ts";
import { executeDB, queryDB } from "../../../../utils/db.ts";
import {
  isDemoUser,
  requireDemoOrSession,
} from "../../../../utils/auth.ts";
import { DEMO_CIRCLES, DEMO_USER } from "../../../../utils/demo_data.ts";

const CIRCLE_MEMBERS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS circle_members (
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (circle_id, user_id)
  )
`;

async function ensureCircleTables() {
  await executeDB(CIRCLE_MEMBERS_SCHEMA);
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface MemberRow {
  user_id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  joined_at: string;
  role: string;
  resonance_score: number | null;
}

export const handler = async (req: Request, ctx: FreshContext) => {
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
    const circleId = ctx.params.id;

    if (!circleId) {
      return jsonResponse({ error: "circleId required" }, 400);
    }

    if (isDemoUser(currentUserId)) {
      const demoCircle = DEMO_CIRCLES.find((c) => c.id === circleId) ??
        DEMO_CIRCLES[0];
      const baseTime = Date.now();
      return jsonResponse(
        {
          members: [
            {
              userId: DEMO_USER.id,
              name: DEMO_USER.name,
              username: DEMO_USER.username,
              avatar: DEMO_USER.avatarUrl,
              joinedAt: new Date(baseTime - 30 * 24 * 3600000).toISOString(),
              role: "founder" as const,
              resonanceScore: 88,
            },
          ],
          demo: true,
          circleId: demoCircle.id,
        },
        200,
      );
    }

    await ensureCircleTables();

    const rows = await queryDB(
      `SELECT cm.user_id, u.username, u.email, u.avatar_url,
              cm.joined_at, cm.role, u.resonance_score
       FROM circle_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.circle_id = $1
       ORDER BY cm.joined_at ASC`,
      circleId,
    ) as MemberRow[];

    const members = rows.map((row, i) => ({
      userId: row.user_id,
      name: row.username || (row.email ? row.email.split("@")[0] : `member-${i}`),
      username: row.username || `member-${i}`,
      avatar: row.avatar_url ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.username}`,
      joinedAt: row.joined_at,
      role: (row.role as "founder" | "moderator" | "member") ?? "member",
      resonanceScore: row.resonance_score ?? 0,
    }));

    return jsonResponse({ members }, 200);
  } catch (_err) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};