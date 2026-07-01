// Regression test for the postgres queryObject args API bug.
// The deno-postgres client.queryObject() takes a single { text, args } object,
// NOT positional (queryString, ...args). Calling it positionally returns rows
// truncated to 1-char strings instead of erroring, which silently corrupts writes.
import { assert, assertEquals, assertExists } from "$std/testing/asserts.ts";
import { test } from "node:test";

const TEST_DB_URL = Deno.env.get("TEST_DATABASE_URL") ??
  "postgres://ardalink:ardalink_dev_only@127.0.0.1:15432/muse";

Deno.test("queryDB returns full strings from RETURNING (no 1-char truncation)", async () => {
  const { queryDB } = await import("../../utils/db.ts");
  const marker = `regr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fullEmail = `${marker}@test.local`;
  const fullUsername = `u_${marker}_abcdef`;
  const fullPasswordHash = `${marker}_bcrypt_hash_60_chars_xxxxxxxxxxxxxxxxxxxxxxx`;

  try {
    await queryDB(
      `INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)`,
      fullEmail,
      fullUsername,
      fullPasswordHash,
    );
    const rows = await queryDB(
      `SELECT email, username, password_hash FROM users WHERE email = $1`,
      fullEmail,
    );
    assertEquals(rows.length, 1, "expected exactly one row back");
    const row = rows[0] as Record<string, string>;
    assertEquals(row.email, fullEmail, `email should be full length (got ${row.email?.length})`);
    assertEquals(row.username, fullUsername, `username should be full length (got ${row.username?.length})`);
    assertEquals(row.password_hash, fullPasswordHash, `password_hash should be full length (got ${row.password_hash?.length})`);
  } finally {
    await queryDB(`DELETE FROM users WHERE email = $1`, fullEmail);
  }
});

Deno.test("executeDB INSERT...RETURNING returns full strings (no 1-char truncation)", async () => {
  const { executeDB } = await import("../../utils/db.ts");
  const marker = `regr-exec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fullEmail = `${marker}@test.local`;
  const fullUsername = `u_${marker}_abcdef`;
  const fullHash = `${marker}_hash_with_more_than_one_char`;

  try {
    const result = await executeDB(
      `INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)
       RETURNING email, username, password_hash`,
      fullEmail,
      fullUsername,
      fullHash,
    );
    const rows = result.rows as Array<Record<string, string>>;
    assertEquals(rows.length, 1);
    const row = rows[0];
    assertExists(row);
    assertEquals(row.email, fullEmail, "RETURNING email should be full length");
    assertEquals(row.username, fullUsername, "RETURNING username should be full length");
    assertEquals(row.password_hash, fullHash, "RETURNING password_hash should be full length");
  } finally {
    const { queryDB } = await import("../../utils/db.ts");
    await queryDB(`DELETE FROM users WHERE email = $1`, fullEmail);
  }
});
