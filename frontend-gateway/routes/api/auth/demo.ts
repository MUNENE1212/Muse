import { Handlers } from "$fresh/server.ts";
import { setDemoCookie } from "../../../utils/auth.ts";

/**
 * POST /api/auth/demo
 * Sets an httpOnly demo session cookie and redirects to the dashboard.
 * This is the production-safe way to enter demo mode — it persists
 * across all page navigations without any client-side hacks.
 */
export const handler: Handlers = {
  POST(_req) {
    const headers = new Headers();
    setDemoCookie(headers);
    headers.set("location", "/dashboard");
    headers.set("Content-Type", "application/json");
    return new Response(null, { status: 303, headers });
  },
};
