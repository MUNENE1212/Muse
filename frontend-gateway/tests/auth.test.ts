/**
 * Tests for utils/auth.ts.
 *
 * - `hashPassword` / `comparePassword` round-trip via bcrypt.
 * - `createSession` / `getSessionUser` round-trip via Deno KV.
 *
 * The auth module calls `Deno.openKv()` at module-load time without a
 * path argument, which on a fresh Deno process uses a per-script default
 * location. In a `deno test` invocation that location is sandboxed per
 * test process, so the kv handle the module grabbed and the kv handle
 * we open in the test refer to the same data. That makes a clean
 * round-trip possible without any production-code changes.
 */
import { assert, assertEquals, assertNotEquals, assertStringIncludes } from "$std/testing/asserts.ts";

import {
  comparePassword,
  createSession,
  DEMO_USER_ID,
  getSessionUser,
  hashPassword,
  isDemoUser,
} from "../utils/auth.ts";

Deno.test("hashPassword produces a bcrypt-format hash", async () => {
  const hash = await hashPassword("correct horse battery staple");

  assert(typeof hash === "string");
  assertNotEquals(hash, "correct horse battery staple");
  // bcrypt hashes are $2a$ / $2b$ / $2y$ prefixed.
  assertStringIncludes(hash, "$2");
  // Bcrypt hashes are 60 chars long.
  assertEquals(hash.length, 60);
});

Deno.test("comparePassword round-trips a freshly hashed password", async () => {
  const password = "p@ssw0rd-" + crypto.randomUUID();
  const hash = await hashPassword(password);

  assertEquals(await comparePassword(password, hash), true);
  assertEquals(await comparePassword(password + "x", hash), false);
});

Deno.test("comparePassword returns false for malformed hashes (does not throw)", async () => {
  // The bcrypt library is permissive; we just assert it doesn't throw
  // and reports "not equal". This keeps the test useful as a smoke test.
  const result = await comparePassword("anything", "not-a-bcrypt-hash");
  assertEquals(result, false);
});

Deno.test("createSession returns a UUID and getSessionUser round-trips it", async () => {
  const userId = "user-" + crypto.randomUUID();
  const sessionId = await createSession(userId);

  // UUID v4 shape: 8-4-4-4-12 hex.
  assertEquals(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(sessionId),
    true,
    "sessionId should be a UUID",
  );

  // Build a fake request carrying the session cookie.
  const req = new Request("https://muse.test/internal", {
    headers: { cookie: `muse_session=${sessionId}` },
  });

  const resolved = await getSessionUser(req);
  assertEquals(resolved, userId);
});

Deno.test("getSessionUser returns null when no session cookie is present", async () => {
  const req = new Request("https://muse.test/internal");
  const resolved = await getSessionUser(req);
  assertEquals(resolved, null);
});

Deno.test("getSessionUser prioritises the demo cookie over the KV lookup", async () => {
  // Even if we also send a real session cookie, the demo marker wins.
  const realSession = await createSession("real-user-id");
  const req = new Request("https://muse.test/internal", {
    headers: {
      cookie: `muse_session=${realSession}; muse_demo_session=1`,
    },
  });

  assertEquals(await getSessionUser(req), DEMO_USER_ID);
});

Deno.test("isDemoUser recognises the sentinel and rejects everything else", () => {
  assertEquals(isDemoUser(DEMO_USER_ID), true);
  assertEquals(isDemoUser(null), false);
  assertEquals(isDemoUser("some-other-id"), false);
});
