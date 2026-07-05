# Caching Quick Start

## Step 1: Update AI Engine Main File

Replace your `main.py` with the cached version:

```bash
cp ai-engine/main_cached.py ai-engine/main.py
```

Or manually import the cache module in your existing `main.py`:

```python
# Add at top of main.py
from cache import (
    close_cache,
    cached_scrape,
    cached_llm,
    cached_document,
    invalidate_pattern
)

# Update lifespan to close cache
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... existing code ...
    yield
    await close_cache()  # Add this
```

---

## Step 2: Update requirements.txt

Ensure redis is included:

```bash
# Add to requirements-core.txt (if not already present)
redis==5.0.0
```

---

## Step 3: Build and Deploy

```bash
# Build with cache support
docker compose -f deploy/compose/docker-compose.optimized.yml build

# Start services (includes Redis)
docker compose -f deploy/compose/docker-compose.optimized.yml up -d

# Verify Redis is running
docker ps | grep redis

# Check cache status
curl http://localhost:8000/api/cache/stats
```

---

## Step 4: Verify Caching Works

```bash
# First call (cache miss - slower)
time curl -X POST http://localhost:8000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Second call (cache hit - instant)
time curl -X POST http://localhost:8000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Check stats
curl http://localhost:8000/api/cache/stats | jq .
```

Expected output:
```json
{
  "status": "connected",
  "total_keys": 1,
  "hits": 1,
  "misses": 1,
  "hit_rate": 0.5,
  "memory_used_human": "1.23M"
}
```

---

## Step 5: Monitor in Production

```bash
# Watch cache stats in real-time
watch -n 5 'curl -s http://your-domain.com/api/cache/stats | jq .'

# Check Redis memory
docker exec muse-redis-1 redis-cli INFO memory

# View cache keys
docker exec muse-redis-1 redis-cli --scan --pattern 'scrape:*'
```

---

## Common Issues

### Redis connection refused
**Solution:** Ensure Redis container is running:
```bash
docker compose -f deploy/compose/docker-compose.optimized.yml up -d redis
```

### Cache not working
**Solution:** Check `CACHE_ENABLED` environment variable:
```bash
docker compose -f deploy/compose/docker-compose.optimized.yml exec ai-engine env | grep CACHE
```

### High memory usage
**Solution:** Flush cache and adjust TTL:
```bash
curl -X POST http://localhost:8000/api/cache/flush
```
