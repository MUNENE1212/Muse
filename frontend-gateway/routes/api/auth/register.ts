import { Handlers } from "$fresh/server.ts";
import { executeDB, queryDB } from "../../../utils/db.ts";
import {
  createSession,
  hashPassword,
  setSessionCookie,
} from "../../../utils/auth.ts";

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const handler: Handlers = {
  async POST(req) {
    try {
      const form = await req.formData();
      const email = form.get("email")?.toString();
      const username = form.get("username")?.toString();
      const password = form.get("password")?.toString();

      if (!email || !username || !password) {
        return jsonResponse({ error: "Missing fields" }, 400);
      }

      const existing = await queryDB(
        "SELECT id FROM users WHERE email = $1 OR username = $2",
        email,
        username,
      );
      if (existing.length > 0) {
        return jsonResponse({ error: "Email or Username already taken" }, 409);
      }

      const hashedPassword = await hashPassword(password);

      const result = await executeDB(
        "INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id",
        email,
        username,
        hashedPassword,
      );

      const row = result.rows[0] as Record<string, unknown>;
      const userId = row.id as string;

      const sessionId = await createSession(userId);

      const headers = new Headers();
      setSessionCookie(headers, sessionId);
      headers.set("location", "/dashboard");
      headers.set("Content-Type", "application/json");

      return new Response(null, { status: 303, headers });
    } catch (e) {
      console.error("[register]", e);
      return jsonResponse({ error: "Internal Server Error" }, 500);
    }
  },
};
