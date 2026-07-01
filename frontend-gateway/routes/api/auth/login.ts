import { Handlers } from "$fresh/server.ts";
import { queryDB } from "../../../utils/db.ts";
import {
  comparePassword,
  createSession,
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
      const password = form.get("password")?.toString();

      if (!email || !password) {
        return jsonResponse({ error: "Missing fields" }, 400);
      }

      // Fetch user
      const users = await queryDB(
        "SELECT id, password_hash FROM users WHERE email = $1",
        email,
      );
      if (users.length === 0) {
        return jsonResponse({ error: "Invalid email or password" }, 401);
      }

      const user = users[0] as Record<string, unknown>;

      // Verify password
      if (!user.password_hash) {
        return jsonResponse(
          {
            error: "Please login with your connected provider (e.g., Google)",
          },
          401,
        );
      }

      const isValid = await comparePassword(
        password,
        user.password_hash as string,
      );
      if (!isValid) {
        return jsonResponse({ error: "Invalid email or password" }, 401);
      }

      const userId = user.id as string;

      // Create session
      const sessionId = await createSession(userId);

      // Set cookie and redirect
      const headers = new Headers();
      setSessionCookie(headers, sessionId);
      headers.set("location", "/dashboard");
      headers.set("Content-Type", "application/json");

      return new Response(null, {
        status: 303,
        headers,
      });
    } catch (e) {
      console.error(e);
      return jsonResponse({ error: "Internal Server Error" }, 500);
    }
  },
};
