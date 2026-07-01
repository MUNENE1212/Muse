interface LinkParseResult {
  title: string;
  description: string;
  image?: string;
  url: string;
  source: string;
  favicon?: string;
  type: "article" | "image" | "video" | "document" | "unknown";
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const HOST_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BLOCKED_HOSTS = ["x.com", "twitter.com", "linkedin.com"];

function classifyType(hostname: string): LinkParseResult["type"] {
  if (hostname.includes("youtube.com") || hostname.includes("vimeo.com")) {
    return "video";
  }
  if (hostname.includes("github.com")) return "document";
  if (
    /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(hostname)
  ) {
    return "image";
  }
  return "article";
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTag(html: string, regex: RegExp): string {
  const match = html.match(regex);
  if (!match || !match[1]) return "";
  return decodeEntities(match[1].trim());
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": HOST_UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  });
  if (!response.ok) {
    throw new Error(`Upstream responded ${response.status}`);
  }
  return await response.text();
}

async function parseLinkMetadata(
  url: string,
): Promise<LinkParseResult> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!/^https?:$/.test(target.protocol)) {
    throw new Error("Only http(s) URLs are supported");
  }

  const hostname = target.hostname.toLowerCase();

  if (BLOCKED_HOSTS.some((h) => hostname.includes(h))) {
    throw new Error(
      `Source ${hostname} blocks server-side requests; paste the content directly.`,
    );
  }

  const html = await fetchHtml(target.toString());

  const title = extractTag(
      html,
      /<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i,
    ) ||
    extractTag(
      html,
      /<meta[^>]*name=["']twitter:title["'][^>]*content=["'](.*?)["']/i,
    ) ||
    extractTag(/<title[^>]*>(.*?)<\/title>/i);

  const description = extractTag(
      html,
      /<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i,
    ) ||
    extractTag(
      html,
      /<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i,
    ) ||
    extractTag(
      html,
      /<meta[^>]*name=["']twitter:description["'][^>]*content=["'](.*?)["']/i,
    );

  const image = extractTag(
    html,
    /<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["']/i,
  ) ||
    extractTag(
      html,
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["'](.*?)["']/i,
    );

  const favicon = extractTag(
    html,
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["'](.*?)["']/i,
  );

  if (!title) {
    throw new Error("Could not extract a title from the page");
  }

  return {
    title,
    description,
    image: image || undefined,
    url: target.toString(),
    source: hostname,
    favicon: favicon || undefined,
    type: classifyType(hostname),
  };
}

export const handler = async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";

    if (!url) {
      return jsonResponse({ error: "URL required" }, 400);
    }

    const metadata = await parseLinkMetadata(url);

    return jsonResponse(metadata as unknown as Record<string, unknown>, 200);
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : "Failed to parse link";
    return jsonResponse({ error: message }, 400);
  }
};