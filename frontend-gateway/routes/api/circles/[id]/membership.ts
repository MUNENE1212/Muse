import { FreshContext } from "$fresh/server.ts";
import { executeDB, queryDB } from "../../../../utils/db.ts";
import {
  isDemoUser,
  requireDemoOrSession,
} from "../../../../utils/auth.ts";
import { DEMO_CIRCLES } from "../../../../utils/demo_data.ts";

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
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    if (!circleId || !userId) {
      return jsonResponse(
        { error: "circleId and userId required" },
        400,
      );
    }

    if (!isDemoUser(currentUserId) && userId !== currentUserId) {
      return jsonResponse(
        { error: "userId must match the active session" },
        403,
      );
    }

    if (isDemoUser(currentUserId)) {
      const demoCircle = DEMO_CIRCLES.find((c) => c.id === circleId) ??
        DEMO_CIRCLES[0];
      return jsonResponse(
        {
          isMember: false,
          memberCount: demoCircle.member_count,
          demo: true,
        },
        200,
      );
    }

    await ensureCircleTables();

    const rows = await queryDB(
      `SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2 LIMIT 1`,
      circleId,
      userId,
    );

    const countRow = (await queryDB(
      `SELECT COUNT(*)::int AS count FROM circle_members WHERE circle_id = $1`,
      circleId,
    )) as unknown as { count: number }[];
    const memberCount = countRow[0]?.count ?? 0;

    return jsonResponse(
      { isMember: rows.length > 0, memberCount },
      200,
    );
  } catch (_err) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};