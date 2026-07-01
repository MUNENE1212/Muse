/**
 * Safe ID generator — monotonic per-prefix counter combined with a random
 * suffix. Survives `crypto.randomUUID` being unavailable (e.g. plain HTTP on
 * some browsers) and avoids the `length + 1` collision pattern when an item
 * has been deleted before the next insertion.
 */

const counters = new Map<string, number>();

function bumpCounter(prefix: string): number {
  const next = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, next);
  return next;
}

function randomSuffix(length = 6): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")
      .slice(0, length);
  }
  return Math.random().toString(36).slice(2, 2 + length);
}

export function generateSafeId(prefix: string): string {
  const counter = bumpCounter(prefix);
  return `${prefix}-${counter.toString(36)}-${randomSuffix()}`;
}
