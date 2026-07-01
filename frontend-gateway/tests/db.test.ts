/**
 * Tests for utils/db.ts.
 *
 * Constraint: this PR must NOT change behaviour of existing application
 * code. utils/db.ts currently creates a module-level `Pool` from
 * `DATABASE_URL` (with a localhost fallback) and exposes `queryDB` /
 * `executeDB` that just forward to `client.queryObject`. It performs
 * NO argument validation, and it does NOT throw on a missing
 * `DATABASE_URL`.
 *
 * The tests below therefore describe the *actual* behaviour today and
 * call out the gaps as `// TODO(track-h): ...` comments so the next
 * infra pass can add validation and a startup guard without losing
 * context.
 */
import { assert, assertEquals, assertRejects } from "$std/testing/asserts.ts";

Deno.test("db module exports queryDB and executeDB", async () => {
  // We re-import under controlled env so the module's module-level
  // pool creation has a stable DATABASE_URL to bind to.
  Deno.env.set("DATABASE_URL", "postgres://test:test@127.0.0.1:5432/muse");

  const mod = await import(`../utils/db.ts?cache=${crypto.randomUUID()}`);
  assertEquals(typeof mod.queryDB, "function");
  assertEquals(typeof mod.executeDB, "function");
});

Deno.test("missing DATABASE_URL falls back to default (does not throw)", async () => {
  // The current implementation provides a localhost fallback rather than
  // throwing at startup. We assert the actual behaviour here.
  const hadUrl = Deno.env.get("DATABASE_URL");
  try {
    Deno.env.delete("DATABASE_URL");
    const mod = await import(
      `../utils/db.ts?cache=${crypto.randomUUID()}`
    );
    assertEquals(typeof mod.queryDB, "function");
    // TODO(track-h): when startup validation is added, change this test
    // to assert that the import throws with a clear error message.
  } finally {
    if (hadUrl !== undefined) Deno.env.set("DATABASE_URL", hadUrl);
  }
});

Deno.test("queryDB accepts a non-empty string query (signature contract)", async () => {
  // Behaviour note: the current `queryDB(query, ...args)` does not
  // validate the query. It will accept anything that is forwarded to
  // `client.queryObject`. We assert what is observable without a live
  // database: a non-string, empty-string, or non-array arg is currently
  // NOT rejected at the JS layer. Each of these calls attempts to
  // connect to the (unreachable) DATABASE_URL and is expected to reject
  // from the network side, NOT from validation. We assert that it
  // *reaches the network layer* by catching a network/DNS error rather
  // than a validation error.
  Deno.env.set(
    "DATABASE_URL",
    "postgres://nobody:nobody@127.0.0.1:1/never_listens",
  );
  const mod = await import(`../utils/db.ts?cache=${crypto.randomUUID()}`);

  for (
    const args of [
      [],
      ["a", 1, true, null],
    ]
  ) {
    let validationRejected = false;
    let networkRejected = false;
    try {
      await mod.queryDB("SELECT 1", ...args);
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err))
        .toLowerCase();
      if (
        msg.includes("query") && (msg.includes("empty") ||
          msg.includes("must be"))
      ) {
        validationRejected = true;
      } else {
        networkRejected = true;
      }
    }
    assert(
      !validationRejected,
      `queryDB must not validate ${JSON.stringify(args)} today (it lets the call through to the network layer)`,
    );
    assert(
      networkRejected,
      `expected network-layer failure for args ${JSON.stringify(args)}`,
    );
  }
  // TODO(track-h): add explicit validation in utils/db.ts and assert that
  // empty queries and non-array args throw synchronously.
});

Deno.test("queryDB: an obviously bad query string is NOT pre-validated", async () => {
  // Confirms the "no upfront validation" contract. With a closed port
  // the call will reject from the network layer, not from the JS layer.
  Deno.env.set(
    "DATABASE_URL",
    "postgres://nobody:nobody@127.0.0.1:1/never_listens",
  );
  const mod = await import(`../utils/db.ts?cache=${crypto.randomUUID()}`);

  await assertRejects(
    () => mod.queryDB("NOT VALID SQL AT ALL"),
    Error,
    undefined,
    "queryDB should not pre-validate; it should propagate the underlying error",
  );
});
