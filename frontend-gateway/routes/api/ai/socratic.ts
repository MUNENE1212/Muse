import { FreshContext } from "$fresh/server.ts";
import { generateDynamicSocraticQuestion } from "../../../utils/ai.ts";
import { requireSession } from "../../../utils/auth.ts";

interface SocraticRequest {
  userName: string;
  recentText: string;
  contextItems: { title: string; note?: string }[];
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const handler = {
  async POST(req: Request, _ctx: FreshContext): Promise<Response> {
    let userId: string;
    try {
      userId = await requireSession(req);
    } catch (response) {
      if (response instanceof Response) return response;
      throw response;
    }

    try {
      const body = await req.json() as SocraticRequest;

      if (!body.recentText) {
        return jsonResponse({ error: "Missing recentText" }, 400);
      }

      const question = await generateDynamicSocraticQuestion(
        body.userName || "Traveler",
        body.recentText,
        body.contextItems || [],
      );

      return jsonResponse({ question }, 200);
    } catch (error) {
      console.error("Socratic Question Error:", error);
      return jsonResponse(
        {
          error: "Failed to generate socratic question",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
};