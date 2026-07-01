import { Handlers } from "$fresh/server.ts";
import { executeDB, queryDB } from "../../../utils/db.ts";
import { getSessionUser, isDemoUser } from "../../../utils/auth.ts";
import { DEMO_CIRCLES } from "../../../utils/demo_data.ts";

export const handler: Handlers = {
  async GET(req) {
    // Demo mode — return template circles
    if (isDemoUser(await getSessionUser(req))) {
      return new Response(JSON.stringify({ circles: DEMO_CIRCLES }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    try {
      const circles = await queryDB(`
        SELECT id, name, description, theme, member_count, recent_activity
        FROM circles
        ORDER BY member_count DESC
      `);

      return new Response(JSON.stringify({ circles }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: unknown) {
      console.error("Failed to fetch circles:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch circles" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },

  async POST(req) {
    const userId = await getSessionUser(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    // Demo users cannot mutate data
    if (isDemoUser(userId)) {
      return new Response(
        JSON.stringify({ error: "Not available in demo mode" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    try {
      const body = await req.json();
      const { name, description, theme } = body;

      if (!name || !description || !theme) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Create circle
      const result = await executeDB(
        `INSERT INTO circles (name, description, theme, member_count, recent_activity)
         VALUES ($1, $2, $3, 1, 'Circle founded.') RETURNING id`,
        name,
        description,
        theme,
      );

      const circleId = (result as { rows: { id: string }[] }).rows[0].id;

      // Add founder to circle_members
      await executeDB(
        `INSERT INTO circle_members (circle_id, user_id, role) VALUES ($1, $2, 'founder')`,
        circleId,
        userId,
      );

      return new Response(JSON.stringify({ success: true, circleId }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: unknown) {
      console.error("Failed to create circle:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create circle" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};
