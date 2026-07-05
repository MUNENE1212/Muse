# MUSE Caching Strategy

## Overview

MUSE implements a multi-layer caching strategy using Redis to reduce:
- External API calls (scraping, LLM)
- Database queries
- Expensive computations

**Target: 40%+ cache hit rate for production workload**

---

## Cache Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Engine Service                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌─────────────────────────────────┐  │
│  │   Request    │─────▶│   Cache Layer (Redis)           │  │
│  │              │      │  - 64MB max memory              │  │
│  └──────────────┘      │  - LRU eviction policy          │  │
│         │              │  - TTL-based expiration         │  │
│         │ miss         │  - Fallback to memory cache     │  │
│         ▼              └─────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Processing Layer                          │  │
│  │  • Scrapers (trafilatura, youtube-transcript-api)     │  │
│  │  • Document parser (unstructured)                      │  │
│  │  • LLM Synthesis (LangChain + Zhipu)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Cache Results                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Cache Categories

### 1. Web Scraping Cache
```python
# TTL: 24 hours
# Key: scrape:web:{sha256(url)}
# Example: scrape:web:a3f5b2c1...

@cached_scrape(prefix="web")
async def scrape_webpage(url: str):
    return await trafilatura.fetch_url(url)
```

**Rationale:** Web pages change infrequently, 24h TTL balances freshness with performance.

---

### 2. Social Media Cache
```python
# TTL: 12 hours
# Key: scrape:social:{sha256(url)}
# Example: scrape:social:f9e4d3c2...

@cached_social_scrape(prefix="social")
async def scrape_social_media(url: str):
    # Playwright scraping (expensive!)
    return await playwright_scrape(url)
```

**Rationale:** Social media changes faster than static pages. 12h TTL.

---

### 3. YouTube Transcript Cache
```python
# TTL: 7 days
# Key: scrape:youtube:{sha256(video_id)}
# Example: scrape:youtube:b2a3f4e1...

@cached_youtube(prefix="youtube")
async def scrape_youtube_transcript(url: str):
    return await YouTubeTranscriptApi.get_transcript(video_id)
```

**Rationale:** Video transcripts rarely change. 7-day TTL significantly reduces API calls.

---

### 4. Document Parsing Cache
```python
# TTL: 30 days
# Key: parse:document:{sha256(file_bytes)}:{filename}
# Example: parse:document:c4d5e6f7...:report.pdf

@cached_document(prefix="document")
async def parse_document(file_bytes: bytes, filename: str):
    return await unstructured.parse(file_bytes)
```

**Rationale:** Uploaded documents are immutable. 30-day TTL since same file = same result.

---

### 5. LLM Synthesis Cache
```python
# TTL: 7 days
# Key: synthesis:room:{room_id}:{sha256(artifact_ids)}
# Example: synthesis:room:abc123:d5e6f7a8...

@cached_llm(prefix="synthesis")
async def synthesize_artifacts(artifacts: list[dict]):
    # Expensive LLM call!
    return await llm_chain.invoke(artifacts)
```

**Rationale:** Synthesis of the same artifacts produces identical results. 7-day TTL since artifacts don't change in a room.

---

## Redis Configuration

### docker-compose.yml
```yaml
redis:
  image: redis:7-alpine
  command: >
    redis-server
    --maxmemory 48mb
    --maxmemory-policy allkeys-lru
    --save ""
    --appendonly no
```

**Settings explained:**
- `--maxmemory 48mb`: Limit to 48MB (leaves headroom in 64MB container)
- `--maxmemory-policy allkeys-lru`: Evict least-recently-used keys when full
- `--save ""`: Disable RDB snapshots (not needed for cache)
- `--appendonly no`: Disable AOF (not needed for cache)

---

## Cache Key Design

### Pattern: `{category}:{type}:{hash}`

| Category | Type | Hash Source | Example |
|----------|------|-------------|---------|
| scrape | web | SHA256(url) | `scrape:web:a3f5b2c1...` |
| scrape | youtube | SHA256(video_id) | `scrape:youtube:b2a3f4e1...` |
| scrape | social | SHA256(url) | `scrape:social:f9e4d3c2...` |
| parse | document | SHA256(bytes) + filename | `parse:document:c4d5...:report.pdf` |
| synthesis | room | SHA256(sorted artifact_ids) | `synthesis:room:abc123:d5e6...` |

### Benefits
- **Deterministic:** Same input = same key
- **Collision-resistant:** SHA256 prevents accidental conflicts
- **Queryable:** Pattern-based invalidation (e.g., `scrape:*`)

---

## API Endpoints

### Check Cache Status
```bash
GET /api/cache/stats

Response:
{
  "status": "connected",
  "total_keys": 1523,
  "hits": 12450,
  "misses": 8234,
  "hit_rate": 0.602,
  "memory_used_human": "42.12M"
}
```

### Invalidate by Pattern
```bash
POST /api/cache/invalidate
Body: { "pattern": "scrape:web:*" }

Response:
{
  "status": "success",
  "invalidated": 234
}
```

### Flush All Cache
```bash
POST /api/cache/flush

Response:
{
  "status": "success"
}
```

### Bypass Cache
```bash
POST /api/scrape
Body: {
  "url": "https://example.com",
  "bypass_cache": true  # Force fresh scrape
}
```

---

## TTL Configuration

| Operation | TTL | Reason |
|-----------|-----|--------|
| Web scraping | 24h | Pages change slowly |
| Social scraping | 12h | Social updates faster |
| YouTube transcripts | 7d | Videos rarely edited |
| Document parsing | 30d | Immutable uploads |
| LLM synthesis | 7d | Artifacts don't change |
| API responses | 1h | Default fallback |

**Environment override:**
```bash
# .env
CACHE_TTL_DEFAULT=3600  # 1 hour
```

---

## Fallback Strategy

When Redis is unavailable, the cache falls back to an in-memory LRU cache:

```python
# Automatic fallback
_fallback_cache = MemoryCache(max_size=1000)

# Usage
result = await get_with_fallback(cache_key)  # Redis → Memory
await set_with_fallback(cache_key, value, ttl)  # Redis → Memory
```

**Behavior:**
- Redis available: Full distributed caching
- Redis down: In-memory cache per container
- Both down: Cache bypassed, direct execution

---

## Monitoring

### Key Metrics
```bash
# Cache hit rate (target: >40%)
curl https://api.muse.com/api/cache/stats | jq .hit_rate

# Memory usage (target: <80% of 48MB = ~38MB)
curl https://api.muse.com/api/cache/stats | jq .memory_used_human

# Total keys (capacity indicator)
curl https://api.muse.com/api/cache/stats | jq .total_keys
```

### Logging
```
# Cache hits
[INFO] Cache hit: scrape:web:a3f5b2c1...

# Cache misses
[INFO] Cache miss: scrape:web:d4e5f6a7...

# Cache storage
[INFO] Cached: scrape:web:a3f5b2c1... (TTL: 86400s)

# Cache invalidation
[INFO] Invalidated 234 keys matching: scrape:web:*
```

---

## Cache Invalidation Strategies

### 1. Time-Based (TTL)
Automatic expiration after configured TTL.

### 2. Manual Pattern
```bash
# Invalidate all web scrapes
curl -X POST https://api.muse.com/api/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"pattern": "scrape:web:*"}'
```

### 3. Complete Flush
```bash
# Emergency flush (rare)
curl -X POST https://api.muse.com/api/cache/flush
```

### 4. Per-Request Bypass
```bash
# Force fresh data
curl -X POST https://api.muse.com/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "bypass_cache": true}'
```

---

## Best Practices

### DO:
- ✅ Cache expensive operations (scraping, LLM)
- ✅ Use appropriate TTLs for content type
- ✅ Monitor hit rates and memory usage
- ✅ Provide bypass option for fresh data
- ✅ Use fallback cache for resilience

### DON'T:
- ❌ Cache user-specific data without privacy consideration
- ❌ Set TTL too low (defeats purpose) or too high (stale data)
- ❌ Cache without size limits (causes OOM)
- ❌ Assume cache is always available

---

## Performance Impact

### Expected Improvements

| Operation | Before (no cache) | After (cache hit) | Improvement |
|-----------|-------------------|-------------------|-------------|
| Web scrape | 2-5s | 5ms | **400x faster** |
| YouTube transcript | 1-3s | 5ms | **400x faster** |
| Document parse | 5-10s | 5ms | **1000x faster** |
| LLM synthesis | 10-30s | 5ms | **2000x faster** |

### Resource Savings

With 40% hit rate:
- **40% fewer API calls** to external services
- **40% reduction** in scraping bandwidth
- **40% reduction** in LLM API costs (if using paid API)
- **Significant reduction** in database load

---

## Integration Checklist

For developers adding new cached operations:

1. **Choose appropriate TTL** based on content volatility
2. **Use cache decorators** (`@cached_scrape`, `@cached_llm`, etc.)
3. **Generate cache keys** using `_make_key()` or custom function
4. **Add bypass option** for endpoints that need fresh data
5. **Document cache behavior** in API docs
6. **Test cache hit/miss** scenarios
7. **Monitor cache metrics** in production

---

## Troubleshooting

### High miss rate
- Check if TTL is too short
- Verify cache keys are consistent
- Check Redis connection stability

### Memory constantly at limit
- Reduce maxmemory or increase container limit
- Review TTL settings (may be too long)
- Check for cache key explosion

### Stale data
- Reduce TTL for volatile content
- Implement manual invalidation
- Add cache versioning to keys

### Redis connection failures
- Check Redis service health
- Verify network connectivity
- Check connection pool limits
- Fallback to memory cache activates automatically
