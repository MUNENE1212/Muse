// API response caching for performance

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const MAX_CACHE_ENTRIES = 1000;

// Map preserves insertion order, so we can evict the oldest entry by
// re-inserting after every write and deleting the first key when full.
const cache = new Map<string, CacheEntry<unknown>>();

function touchLRU(key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  cache.delete(key);
  cache.set(key, entry);
}

function evictIfFull() {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// Set cache entry with TTL (time to live in milliseconds)
export const setCache = <T>(key: string, data: T, ttl: number = 5000) => {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
  touchLRU(key);
  evictIfFull();
};

// Get cache entry if valid
export const getCache = <T>(key: string): T | null => {
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    cache.delete(key);
    return null;
  }

  touchLRU(key);
  return entry.data;
};

// Clear specific cache entry
export const clearCache = (key: string) => {
  cache.delete(key);
};

// Clear all cache (also exposed as clearCache() for test ergonomics)
export const clearAllCache = () => {
  cache.clear();
};

export const clearCacheAll = clearAllCache;

// Cached API fetch
export const cachedFetch = async <T>(
  url: string,
  ttl: number = 5000,
): Promise<T | null> => {
  const cached = getCache<T>(url);
  if (cached) return cached;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as T;
    setCache(url, data, ttl);
    return data;
  } catch {
    return null;
  }
};

// Batch requests with caching
export const batchCachedFetch = async <T>(
  urls: string[],
  ttl: number = 5000,
): Promise<(T | null)[]> => {
  return Promise.all(urls.map((url) => cachedFetch<T>(url, ttl)));
};