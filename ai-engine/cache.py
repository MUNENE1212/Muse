# ============================================
# MUSE AI Engine - Redis Cache Layer
# ============================================
# Provides caching for:
#   - Scrape results (TTL: 24h)
#   - LLM synthesis results (TTL: 7d)
#   - Document parsing (TTL: 30d)
#   - API responses (TTL: 1h)
# ============================================

import hashlib
import json
import logging
import os
from functools import wraps
from typing import Any, Callable, Optional, TypeVar

import redis.asyncio as aioredis

logger = logging.getLogger("muse.cache")

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_TTL_DEFAULT = int(os.getenv("CACHE_TTL_DEFAULT", "3600"))  # 1 hour
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "true").lower() == "true"

# TTL configurations (in seconds)
CACHE_TTLS = {
    "scrape": 86400,      # 24 hours
    "scrape_social": 43200,  # 12 hours (social media changes faster)
    "llm_synthesis": 604800,  # 7 days (expensive to recompute)
    "document_parse": 2592000,  # 30 days (documents don't change)
    "api_response": 3600,  # 1 hour
    "youtube_transcript": 604800,  # 7 days (rarely change)
}

_client: Optional[aioredis.Redis] = None


async def get_client() -> aioredis.Redis:
    """Get or create Redis client connection."""
    global _client
    if _client is None:
        try:
            _client = await aioredis.from_url(
                REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=10,
            )
            await _client.ping()
            logger.info("Redis cache connected")
        except Exception as exc:
            logger.warning("Redis connection failed: %s. Cache disabled.", exc)
            _client = None
    return _client


async def close_cache() -> None:
    """Close Redis connection."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
        logger.info("Redis cache closed")


def _make_key(prefix: str, *args, **kwargs) -> str:
    """Generate a deterministic cache key from function arguments."""
    # Create a stable representation of arguments
    key_parts = [prefix]

    for arg in args:
        if isinstance(arg, (str, int, float, bool)):
            key_parts.append(str(arg))
        elif isinstance(arg, (list, tuple)):
            key_parts.append(str(tuple(arg)))
        elif isinstance(arg, dict):
            key_parts.append(json.dumps(arg, sort_keys=True))
        else:
            # For complex objects, hash their string representation
            key_parts.append(hashlib.sha256(str(arg).encode()).hexdigest()[:16])

    # Handle kwargs (sorted for consistency)
    for k in sorted(kwargs.keys()):
        v = kwargs[k]
        if isinstance(v, (str, int, float, bool)):
            key_parts.append(f"{k}={v}")
        else:
            key_parts.append(f"{k}={hashlib.sha256(str(v).encode()).hexdigest()[:16]}")

    return ":".join(key_parts)


F = TypeVar("F")


def cached(
    ttl: Optional[int] = None,
    prefix: str = "cache",
    key_fn: Optional[Callable[..., str]] = None,
) -> Callable[[F], F]:
    """
    Async function caching decorator.

    Args:
        ttl: Time-to-live in seconds. If None, uses CACHE_TTL_DEFAULT
        prefix: Key prefix for this cache group
        key_fn: Optional function to generate custom cache keys
    """
    def decorator(func: F) -> F:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not CACHE_ENABLED:
                return await func(*args, **kwargs)

            client = await get_client()
            if client is None:
                return await func(*args, **kwargs)

            # Generate cache key
            cache_key = key_fn(*args, **kwargs) if key_fn else _make_key(prefix, *args, **kwargs)

            # Try to get from cache
            try:
                cached_value = await client.get(cache_key)
                if cached_value is not None:
                    logger.debug("Cache hit: %s", cache_key)
                    return json.loads(cached_value)
            except Exception as exc:
                logger.warning("Cache get failed: %s", exc)

            # Cache miss - call function
            logger.debug("Cache miss: %s", cache_key)
            result = await func(*args, **kwargs)

            # Store in cache
            try:
                cache_ttl = ttl or CACHE_TTL_DEFAULT
                await client.setex(
                    cache_key,
                    cache_ttl,
                    json.dumps(result, default=str),
                )
                logger.debug("Cached: %s (TTL: %ds)", cache_key, cache_ttl)
            except Exception as exc:
                logger.warning("Cache set failed: %s", exc)

            return result

        return wrapper
    return decorator


def cached_scrape(prefix: str = "scrape"):
    """Decorator for web scraping results (24h TTL)."""
    return cached(ttl=CACHE_TTLS["scrape"], prefix=prefix)


def cached_social_scrape(prefix: str = "scrape_social"):
    """Decorator for social media scraping (12h TTL)."""
    return cached(ttl=CACHE_TTLS["scrape_social"], prefix=prefix)


def cached_llm(prefix: str = "llm"):
    """Decorator for LLM synthesis results (7d TTL - expensive!)."""
    return cached(ttl=CACHE_TTLS["llm_synthesis"], prefix=prefix)


def cached_document(prefix: str = "document"):
    """Decorator for document parsing (30d TTL)."""
    return cached(ttl=CACHE_TTLS["document_parse"], prefix=prefix)


def cached_youtube(prefix: str = "youtube"):
    """Decorator for YouTube transcripts (7d TTL)."""
    return cached(ttl=CACHE_TTLS["youtube_transcript"], prefix=prefix)


# ============================================
# Cache Management Functions
# ============================================

async def invalidate_pattern(pattern: str) -> int:
    """Invalidate all keys matching a pattern."""
    client = await get_client()
    if client is None:
        return 0

    try:
        keys = []
        async for key in client.scan_iter(match=pattern):
            keys.append(key)

        if keys:
            await client.delete(*keys)
            logger.info("Invalidated %d keys matching: %s", len(keys), pattern)
        return len(keys)
    except Exception as exc:
        logger.warning("Cache invalidation failed: %s", exc)
        return 0


async def get_cache_stats() -> dict[str, Any]:
    """Get cache statistics."""
    client = await get_client()
    if client is None:
        return {"status": "disconnected"}

    try:
        info = await client.info("stats")
        space = await client.info("memory")

        total_keys = 0
        async for key in client.scan_iter():
            total_keys += 1

        return {
            "status": "connected",
            "total_keys": total_keys,
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "hit_rate": (
                info.get("keyspace_hits", 0)
                / max(1, info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0))
            ),
            "memory_used_bytes": space.get("used_memory", 0),
            "memory_used_human": space.get("used_memory_human", "N/A"),
        }
    except Exception as exc:
        logger.warning("Cache stats failed: %s", exc)
        return {"status": "error", "error": str(exc)}


async def flush_cache() -> bool:
    """Flush all cache entries."""
    client = await get_client()
    if client is None:
        return False

    try:
        await client.flushdb()
        logger.info("Cache flushed")
        return True
    except Exception as exc:
        logger.warning("Cache flush failed: %s", exc)
        return False


# Simple in-memory cache for when Redis is unavailable
class MemoryCache:
    """Fallback in-memory cache for when Redis is unavailable."""

    def __init__(self, max_size: int = 1000):
        self._cache: dict[str, tuple[Any, float]] = {}
        self._max_size = max_size
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            value, expiry = self._cache[key]
            import time
            if expiry > time.time():
                self._hits += 1
                return value
            else:
                del self._cache[key]
        self._misses += 1
        return None

    def set(self, key: str, value: Any, ttl: int) -> None:
        import time
        # Evict oldest if at capacity
        if len(self._cache) >= self._max_size:
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][1])
            del self._cache[oldest_key]

        self._cache[key] = (value, time.time() + ttl)

    def delete(self, key: str) -> bool:
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    def stats(self) -> dict[str, Any]:
        total = self._hits + self._misses
        return {
            "type": "memory",
            "size": len(self._cache),
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": self._hits / max(1, total),
        }


# Global fallback cache
_fallback_cache = MemoryCache()


async def get_with_fallback(key: str) -> Optional[Any]:
    """Get value from Redis, fallback to memory cache."""
    client = await get_client()
    if client is not None:
        try:
            value = await client.get(key)
            if value:
                return json.loads(value)
        except Exception:
            pass

    # Fallback to memory
    return _fallback_cache.get(key)


async def set_with_fallback(key: str, value: Any, ttl: int) -> bool:
    """Set value in Redis, fallback to memory cache."""
    client = await get_client()
    if client is not None:
        try:
            await client.setex(key, ttl, json.dumps(value, default=str))
            return True
        except Exception:
            pass

    # Fallback to memory
    _fallback_cache.set(key, value, ttl)
    return False
