import * as bcrypt from "bcrypt";
import { getCookies, setCookie } from "$std/http/cookie.ts";

// Sentinel ID used throughout the app to identify demo sessions.
// When any handler sees this ID, it returns template data instead of hitting the DB.
export const DEMO_USER_ID = "__demo__";

export function isDemoUser(userId: string | null): boolean {
  return userId === DEMO_USER_ID;
}

// Lazily-initialized KV handle so module import never crashes the process.
// On hosts where `--unstable-kv` is unavailable (or KV is not provisioned)
// the first call to getKv() will throw a clear error at request time
// instead of preventing the whole gateway from booting.
let _kvPromise: Promise<Deno.Kv> | null = null;
async function getKv(): Promise<Deno.Kv> {
  if (!_kvPromise) {
    _kvPromise = Deno.openKv();
  }
  return await _kvPromise;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expireInMs = 7 * 24 * 60 * 60 * 1000;
  const kv = await getKv();
  await kv.set(["sessions", sessionId], userId, { expireIn: expireInMs });
  return sessionId;
}

export async function destroySession(sessionId: string): Promise<void> {
  const kv = await getKv();
  await kv.delete(["sessions", sessionId]);
}

export async function getSessionUser(req: Request): Promise<string | null> {
  const cookies = getCookies(req.headers);

  // Demo session takes priority — checked before real KV lookup
  if (cookies["muse_demo_session"] === "1") {
    return DEMO_USER_ID;
  }

  const sessionId = cookies["muse_session"];
  if (!sessionId) return null;

  const kv = await getKv();
  const result = await kv.get<string>(["sessions", sessionId]);
  return result.value;
}

// Strict guard: throws a 401 Response when no session is present.
// Callers can either `await requireSession(req)` and use the returned userId,
// or wrap in try/catch to short-circuit the handler.
export async function requireSession(req: Request): Promise<string> {
  const userId = await getSessionUser(req);
  if (!userId || isDemoUser(userId)) {
    throw unauthorized();
  }
  return userId;
}

// Lenient guard: allows demo sessions to flow through.
// Handlers that support demo mode should call this instead of requireSession.
export async function requireDemoOrSession(req: Request): Promise<string> {
  const userId = await getSessionUser(req);
  if (!userId) {
    throw unauthorized();
  }
  return userId;
}

export function setSessionCookie(headers: Headers, sessionId: string) {
  setCookie(headers, {
    name: "muse_session",
    value: sessionId,
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
}

export function setDemoCookie(headers: Headers) {
  setCookie(headers, {
    name: "muse_demo_session",
    value: "1",
    // Demo session lasts 2 hours
    maxAge: 2 * 60 * 60,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
}

export function clearDemoCookie(headers: Headers) {
  setCookie(headers, {
    name: "muse_demo_session",
    value: "",
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
}