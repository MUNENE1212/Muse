/**
 * Tests for the perspective feed filter.
 *
 * The function under test (`filterPerspectivesByFollowing`) is a pure
 * transformation, so we can exercise every branch without mocks.
 */
import { assertEquals } from "$std/testing/asserts.ts";

import { filterPerspectivesByFollowing } from "../signals/feed-filter.ts";

interface FakePerspective {
  id: string;
  author: { id: string; name: string };
  content: string;
}

function makePerspectives(): FakePerspective[] {
  return [
    { id: "p1", author: { id: "u-alice", name: "Alice" }, content: "hi" },
    { id: "p2", author: { id: "u-bob", name: "Bob" }, content: "ho" },
    { id: "p3", author: { id: "u-carol", name: "Carol" }, content: "he" },
    { id: "p4", author: { id: "u-dave", name: "Dave" }, content: "ha" },
  ];
}

Deno.test("filterPerspectivesByFollowing keeps only perspectives whose author id is followed", () => {
  const perspectives = makePerspectives();
  const following = ["u-alice", "u-carol"];

  const out = filterPerspectivesByFollowing(
    perspectives,
    following,
    "following",
  );

  assertEquals(out.map((p) => p.id), ["p1", "p3"]);
});

Deno.test("filterPerspectivesByFollowing returns everything when filterType is 'all'", () => {
  const perspectives = makePerspectives();
  const following = ["u-alice"]; // would normally prune most of them

  const out = filterPerspectivesByFollowing(perspectives, following, "all");
  assertEquals(out.length, perspectives.length);
  assertEquals(out, perspectives);
});

Deno.test("filterPerspectivesByFollowing does not crash on a perspective with a missing author id", () => {
  const broken: FakePerspective[] = [
    { id: "p-good", author: { id: "u-alice", name: "Alice" }, content: "ok" },
    // Deno/TS will not let us assign `undefined` to a typed field, so we
    // cast at the call-site to mirror what happens when upstream data is
    // missing fields at runtime.
    {
      id: "p-broken",
      author: undefined as unknown as { id: string; name: string },
      content: "?",
    },
  ];

  const out = filterPerspectivesByFollowing(
    broken,
    ["u-alice"],
    "following",
  );

  // The broken perspective is dropped (it cannot match an id), the
  // good one is kept. We only assert the call doesn't throw and the
  // well-formed entry is preserved.
  assertEquals(out.map((p) => p.id), ["p-good"]);
});

Deno.test("filterPerspectivesByFollowing with empty following list returns []", () => {
  const perspectives = makePerspectives();
  const out = filterPerspectivesByFollowing(perspectives, [], "following");
  assertEquals(out, []);
});

Deno.test("filterPerspectivesByFollowing with empty perspectives returns []", () => {
  const out = filterPerspectivesByFollowing([], ["u-alice"], "following");
  assertEquals(out, []);
});

Deno.test("filterPerspectivesByFollowing does not mutate the input array", () => {
  const perspectives = makePerspectives();
  const snapshot = JSON.stringify(perspectives);

  filterPerspectivesByFollowing(perspectives, ["u-alice"], "following");
  filterPerspectivesByFollowing(perspectives, ["u-bob"], "all");

  assertEquals(JSON.stringify(perspectives), snapshot);
});
