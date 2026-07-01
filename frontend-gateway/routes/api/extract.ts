import { FreshContext } from "$fresh/server.ts";

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 1_500_000;
const REQUEST_TIMEOUT_MS = 8_000;

interface ExtractedMetadata {
  title: string;
  summary: string;
  image: string;
  source: string;
  type: "Article" | "Post" | "Repository" | "Video";
}

interface ExtractError {
  error: string;
  code:
    | "BAD_REQUEST"
    | "INVALID_URL"
    | "BLOCKED_HOST"
    | "FETCH_FAILED"
    | "TIMEOUT"
    | "TOO_LARGE"
    | "INTERNAL";
}

const json = (body: ExtractError | ExtractedMetadata, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const PRIVATE_IPV4_PATTERNS: RegExp[] = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
];

const PRIVATE_IPV6_PATTERNS: RegExp[] = [
  /^::1$/,
  /^fe80:/i,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
];

function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;

  if (PRIVATE_IPV4_PATTERNS.some((re) => re.test(lower))) return true;
  if (PRIVATE_IPV6_PATTERNS.some((re) => re.test(lower))) return true;

  return false;
}

function classifyHost(hostname: string): ExtractedMetadata["type"] {
  const host = hostname.toLowerCase();
  if (host.includes("x.com") || host.includes("twitter.com") ||
      host.includes("linkedin.com")) return "Post";
  if (host.includes("github.com")) return "Repository";
  if (host.includes("youtube.com") || host.includes("vimeo.com")) return "Video";
  return "Article";
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return "";
      }
    })
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function extractTag(html: string, regex: RegExp): string {
  const match = html.match(regex);
  return match && match[1] ? decodeEntities(match[1].trim()) : "";
}

async function fetchWithGuard(
  initialUrl: URL,
): Promise<
  | { ok: true; response: Response }
  | { ok: false; status: number; error: ExtractError }
> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (isPrivateHost(currentUrl.hostname)) {
      return {
        ok: false,
        status: 400,
        error: {
          error: "Refusing to fetch from a private or loopback address",
          code: "BLOCKED_HOST",
        },
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    let res: Response;
    try {
      res = await fetch(currentUrl.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : "fetch failed";
      const code: ExtractError["code"] = err instanceof Error &&
          err.name === "AbortError"
        ? "TIMEOUT"
        : "FETCH_FAILED";
      return {
        ok: false,
        status: 502,
        error: { error: message, code },
      };
    }
    clearTimeout(timeout);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || hop === MAX_REDIRECTS) {
        return {
          ok: false,
          status: 502,
          error: {
            error: "Too many redirects or missing Location header",
            code: "FETCH_FAILED",
          },
        };
      }
      try {
        currentUrl = new URL(location, currentUrl);
      } catch {
        return {
          ok: false,
          status: 400,
          error: { error: "Invalid redirect target", code: "INVALID_URL" },
        };
      }
      continue;
    }

    if (!res.ok) {
      return {
        ok: false,
        status: 502,
        error: {
          error: `Upstream returned ${res.status} ${res.statusText}`,
          code: "FETCH_FAILED",
        },
      };
    }

    return { ok: true, response: res };
  }

  return {
    ok: false,
    status: 502,
    error: {
      error: "Exceeded redirect limit",
      code: "FETCH_FAILED",
    },
  };
}

export const handler = async (req: Request, _ctx: FreshContext) => {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed", code: "BAD_REQUEST" }, 405);
  }

  const urlStr = new URL(req.url).searchParams.get("url");
  if (!urlStr) {
    return json({ error: "URL is required", code: "BAD_REQUEST" }, 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlStr);
  } catch {
    return json({ error: "URL is not valid", code: "INVALID_URL" }, 400);
  }

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return json({
      error: "Only http and https URLs are accepted",
      code: "INVALID_URL",
    }, 400);
  }

  if (isPrivateHost(targetUrl.hostname)) {
    return json({
      error: "Refusing to fetch from a private or loopback address",
      code: "BLOCKED_HOST",
    }, 400);
  }

  try {
    const result = await fetchWithGuard(targetUrl);
    if (!result.ok) return json(result.error, result.status);

    const contentLength = Number(result.response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return json({
        error: "Upstream response exceeds size limit",
        code: "TOO_LARGE",
      }, 502);
    }

    const html = await result.response.text();
    if (html.length > MAX_BODY_BYTES) {
      return json({
        error: "Upstream response exceeds size limit",
        code: "TOO_LARGE",
      }, 502);
    }

    const hostname = targetUrl.hostname.toLowerCase();

    const title = extractTag(
      html,
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i,
    ) ||
      extractTag(
        html,
        /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i,
      ) ||
      extractTag(/<title[^>]*>([^<]*)<\/title>/i) ||
      "Untitled";

    const summary = extractTag(
      html,
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i,
    ) ||
      extractTag(
        html,
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
      ) ||
      extractTag(
        html,
        /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']*)["']/i,
      ) ||
      `Extracted from ${hostname}`;

    const image = extractTag(
      html,
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i,
    ) ||
      extractTag(
        html,
        /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']*)["']/i,
      );

    return json({
      title: title || "Untitled",
      summary,
      image,
      source: hostname,
      type: classifyHost(hostname),
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[extract] unexpected error:", error);
    return json({
      error: `Extraction failed: ${message}`,
      code: "INTERNAL",
    }, 500);
  }
};
