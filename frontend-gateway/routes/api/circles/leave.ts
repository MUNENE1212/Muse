import { executeDB } from "../../../utils/db.ts";
import {
  isDemoUser,
  requireDemoOrSession,
} from "../../../utils/auth.ts";
import { DEMO_CIRCLES } from "../../../utils/demo_data.ts";

const CIRCLE_MEMBERS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS circle_members (
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (circle_id, user_id)
  )
`;

const CIRCLES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    theme VARCHAR(255),
    member_count INTEGER DEFAULT 0,
    recent_activity TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )
`;

async function ensureCircleTables() {
  await executeDB(CIRCLES_SCHEMA);
  await executeDB(CIRCLE_MEMBERS_SCHEMA);
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
    await ensureCircleTables();

    const { circleId } = await req.json();

    if (!circleId || typeof circleId !== "string") {
      return jsonResponse({ error: "circleId required" }, 400);
    }

    if (isDemoUser(currentUserId)) {
      const demoCircle = DEMO_CIRCLES.find((c) => c.id === circleId) ??
        DEMO_CIRCLES[0];
      return jsonResponse(
        {
          success: true,
          isMember: false,
          memberCount: Math.max(0, demoCircle.member_count - 1),
          demo: true,
        },
        200,
      );
    }

    await executeDB(
      `DELETE FROM circle_members WHERE circle_id = $1 AND user_id = $2`,
      circleId,
      currentUserId,
    );

    await executeDB(
      `UPDATE circles SET
         member_count = (SELECT COUNT(*)::int FROM circle_members WHERE circle_id = $1)
       WHERE id = $1`,
      circleId,
    );

    const countRow = (await executeDB(
      `SELECT COUNT(*)::int AS count FROM circle_members WHERE circle_id = $1`,
      circleId,
    )).rows[0] as { count: number };

    return jsonResponse(
      {
        success: true,
        isMember: false,
        memberCount: countRow.count,
      },
      200,
    );
  } catch (_err) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};