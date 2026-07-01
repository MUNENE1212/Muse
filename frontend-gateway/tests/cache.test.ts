/**
 * Tests for the TTL-based in-memory cache in utils/cache.ts.
 *
 * The cache today uses a simple `Date.now() - timestamp > ttl` check to
 * expire entries. We exercise that with `std/testing/time.ts::FakeTime` so
 * the tests are deterministic and don't actually sleep.
 *
 * NOTE on "over-capacity eviction": the current implementation has no
 * upper bound on the number of entries. We therefore assert the actual
 * behaviour (entries are retained until TTL expires) and leave a hook
 * for the future bounded-LRU test once `setCache` accepts a capacity
 * option. This keeps the tests honest about the codebase as it stands.
 */
import { assert, assertEquals } from "$std/testing/asserts.ts";
import { FakeTime } from "$std/testing/time.ts";

import {
  clearAllCache,
  clearCache,
  getCache,
  setCache,
} from "../utils/cache.ts";

Deno.test("setCache + getCache returns the stored value within TTL", () => {
  using _t = new FakeTime();

  setCache("k1", { hello: "world" }, 5_000);
  const got = getCache<{ hello: string }>("k1");

  assert(got !== null, "cache hit expected within TTL");
  assertEquals(got.hello, "world");
});

Deno.test("getCache returns null and evicts entry after TTL expiry", () => {
  using _t = new FakeTime(0);

  setCache("k2", 42, 1_000);
  assertEquals(getCache<number>("k2"), 42);

  // Advance past TTL (1000ms + 1ms).
  _t.tick(1_001);

  const after = getCache<number>("k2");
  assertEquals(after, null, "entry must be evicted once TTL elapses");
  // Second read should also be null (idempotent).
  assertEquals(getCache<number>("k2"), null);
});

Deno.test("clearCache removes a specific entry", () => {
  using _t = new FakeTime();

  setCache("a", 1, 60_000);
  setCache("b", 2, 60_000);

  clearCache("a");
  assertEquals(getCache<number>("a"), null);
  assertEquals(getCache<number>("b"), 2);
});

Deno.test("clearAllCache wipes the cache", () => {
  using _t = new FakeTime();

  setCache("x", "x", 60_000);
  setCache("y", "y", 60_000);
  clearAllCache();

  assertEquals(getCache<string>("x"), null);
  assertEquals(getCache<string>("y"), null);
});

Deno.test("over-capacity: current cache has no cap; entries persist", () => {
  // The current implementation stores everything in a plain object and
  // never evicts based on count. This test documents that contract so a
  // future change to add a bounded LRU is a visible behaviour change.
  using _t = new FakeTime();

  for (let i = 0; i < 500; i++) {
    setCache(`key:${i}`, { i }, 60_000);
  }

  let hits = 0;
  for (let i = 0; i < 500; i++) {
    if (getCache<{ i: number }>(`key:${i}`) !== null) hits++;
  }
  assertEquals(hits, 500, "no capacity-based eviction should occur yet");
});

Deno.test("TTL boundary: entry is valid at ttl-1ms and invalid at ttl+1ms", () => {
  using _t = new FakeTime(10_000);

  setCache("boundary", "v", 2_000);
  _t.tick(1_999);
  assertEquals(getCache<string>("boundary"), "v");
  _t.tick(2); // total 2001ms elapsed
  assertEquals(getCache<string>("boundary"), null);
});
