import { Handlers } from "$fresh/server.ts";
import { getSessionUser } from "../../../utils/auth.ts";
import { queryDB } from "../../../utils/db.ts";
import { generateSecret, generateURI, verify } from "npm:otplib";

export const handler: Handlers = {
  async POST(req) {
    try {
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

      const body = await req.json();
      const { action, token, secret } = body;

      // Action: "generate"
      // Generates a new 2FA secret and an otpauth URL for Google Authenticator
      if (action === "generate") {
        const newSecret = generateSecret();

        // Fetch user email to label the authenticator app
        const userRes = await queryDB(
          "SELECT email FROM users WHERE id = $1",
          userId,
        );
        const email = (userRes[0] as { email: string })?.email ??
          "user@muse.os";

        const otpauthUrl = generateURI({
          secret: newSecret,
          label: email,
          issuer: "Muse OS",
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          type: "totp",
        });

        return new Response(
          JSON.stringify({ secret: newSecret, otpauthUrl }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Action: "verify"
      // Verifies a user-provided TOTP code against the provided secret
      if (action === "verify") {
        if (!token || !secret) {
          return new Response(
            JSON.stringify({
              error: "Token and secret are required for verification",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const isValid = verify({ token, secret });

        if (isValid) {
          // In production: save secret to the `users` table
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } else {
          return new Response(
            JSON.stringify({ error: "Invalid 2FA code" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }

      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (e) {
      console.error("Error in 2FA endpoint:", e);
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          details: (e as Error).message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};
