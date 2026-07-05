# MUSE VPS Performance & Resource Audit

**Date:** 2026-07-04  
**VPS Specs (Target):** 2 vCPU / 4 GB RAM / 40 GB SSD  
**Current Status:** MVP deployed, needs optimization

---

## Executive Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| AI Engine Image Size | 7.62GB | <500MB | 🔴 Critical |
| Total Container Memory (idle) | ~900MB | <1GB | 🟡 OK |
| Database Pool Size | 1-10 | 1-10 | 🟢 Optimal |
| Worker Count | 2 | 1-2 | 🟢 OK |
| Reverse Proxy | Caddy (Alpine) | N/A | 🟢 Optimal |
| Resource Limits | None set | Required | 🔴 Critical |

---

## Critical Issues

### 1. AI Engine Image Size (7.62GB) - **CRITICAL**

**Root Cause:**
- Base image: `python:3.12.7-slim-bookworm` (~200MB)
- `playwright` bundle with Chromium (~300MB+)
- `unstructured[all-docs]` includes Tesseract, Poppler, and many parsers
- Full ML dependencies even when features not used

**Impact:**
- Slow deployment/pull times
- High memory footprint at startup
- Unnecessary bloat for MVP features

---

### 2. No Docker Resource Limits - **CRITICAL**

**Current:** Containers can consume unlimited resources  
**Risk:** Single service can exhaust VPS memory/CPU, causing OOM kills

---

## Component Analysis

### AI Engine (Python/FastAPI)

**Current Dockerfile Issues:**
```dockerfile
# Current problems:
- Uses full python:3.12.7-slim-bookworm
- Installs system packages globally
- playwright install chromium (not needed for MVP scrapers)
- No multi-stage build
- No cleanup of build artifacts
```

**Dependencies Analysis:**
```
Heavy packages:
- playwright (1.42.0) + Chromium: ~300MB
- unstructured[all-docs] (0.13.7): ~500MB+
  - Includes PDF, DOCX, XLSX, PPTX parsers
  - Tesseract OCR + languages
  - Poppler utilities

MVP actual usage:
- trafilatura (web scraping) - Light ✓
- youtube-transcript-api - Light ✓
- requests, beautifulsoup4 - Light ✓
- playwright for social media - Heavy, but limited use
- parse_document for uploads - Heavy, but optional
```

**Memory Usage:**
- Base uvicorn with 2 workers: ~100MB
- With LangChain loaded: ~150MB
- Playwright browser: +200MB per instance

---

### Frontend Gateway (Deno/Fresh)

**Status:** 🟢 Good
- Image: 153MB (acceptable)
- Uses Deno alpine base
- Preact for lightweight frontend
- No major issues

---

### Blockchain Security (Rust)

**Status:** 🟢 Excellent
- Image: 92.6MB (very good)
- Compiled binary in multi-stage build
- Minimal runtime dependencies
- Tokio async runtime

---

### PostgreSQL

**Status:** 🟢 Good
- Image: 294MB (alpine)
- Connection pool: 1-10 (appropriate)
- No custom tuning needed yet

---

## Optimization Strategy

### Priority 1: Reduce AI Engine Image Size

**Target:** <500MB (from 7.62GB)

**Actions:**

1. **Use Python Alpine base**
   ```dockerfile
   FROM python:3.12-alpine
   # Reduces base by ~100MB
   ```

2. **Multi-stage build with cleanup**
   ```dockerfile
   # Build stage with all dependencies
   FROM python:3.12-alpine AS builder
   RUN apk add --no-cache build-base && \
       pip install --no-cache-dir -r requirements.txt
   
   # Runtime stage with only essentials
   FROM python:3.12-alpine
   RUN apk add --no-cache poppler-utils tesseract-ocr libmagic
   COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
   ```

3. **Split requirements.txt**
   ```
   requirements-core.txt    # Core AI engine (light)
   requirements-optional.txt  # Heavy features (playwright, full parsers)
   ```

4. **Conditional playwright installation**
   ```dockerfile
   ARG INSTALL_PLAYWRIGHT=false
   RUN if [ "$INSTALL_PLAYWRIGHT" = "true" ]; then \
       playwright install chromium; \
   fi
   ```

5. **Remove unused dependencies**
   - Move `unstructured[all-docs]` → `unstructured` (core only)
   - Install Tesseract/Poppler only if document upload enabled

**Expected Result:** ~400-500MB image

---

### Priority 2: Add Resource Limits

**docker-compose.prod.yml:**
```yaml
services:
  ai-engine:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  frontend-gateway:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  blockchain-security:
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 128M

  postgres:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

**Total Max Allocation:** ~1.4GB (leaves room for OS and caching)

---

### Priority 3: Optimize Worker Configuration

**Current:** 2 uvicorn workers (hardcoded)

**Strategy:**
```dockerfile
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "1", \
     "--loop", "uvloop", \
     "--log-config", "logging.conf"]
```

**Why 1 worker for MVP:**
- uvloop + async I/O handles concurrent requests efficiently
- Single worker = less memory
- Scale horizontally (add containers) before vertically

---

### Priority 4: Feature Flags for Heavy Features

**Environment-based feature toggles:**

```python
# ai-engine/main.py
ENABLE_SCRAPING = os.getenv("ENABLE_SCRAPING", "true") == "true"
ENABLE_UPLOADS = os.getenv("ENABLE_UPLOADS", "true") == "true"
ENABLE_SOCIAL_SCRAPING = os.getenv("ENABLE_SOCIAL_SCRAPING", "false") == "true"
```

**Benefits:**
- Disable heavy features on low-resource deployments
- Gradual rollout
- A/B testing capability

---

### Priority 5: Database Optimization

**Current:** Good defaults, but add:

```python
# ai-engine/database.py
async def init_pool(
    database_url: str = DATABASE_URL,
    min_size: int = 1,
    max_size: int = int(os.getenv("DB_POOL_MAX", "5")),  # Configurable
    command_timeout: int = 30,
) -> asyncpg.Pool:
```

**For 2 vCPU VPS:**
- Pool size: 3-5 (not 10)
- Statement timeout: 30s
- Connection timeout: 10s

---

### Priority 6: Caching Layer

**Add Redis for MVP caching:**

```yaml
services:
  redis:
    image: redis:7-alpine
    deploy:
      resources:
        limits:
          memory: 64M
```

**Use cases:**
- Cache scrape results (TTL: 24h)
- Cache LLM responses (TTL: 7 days)
- Rate limiting

---

## Deployment Architecture (Optimized)

```
┌─────────────────────────────────────────────────┐
│                   VPS (2 CPU / 4GB RAM)          │
├─────────────────────────────────────────────────┤
│                                                   │
│  Caddy (50MB) ─────────────────────────────────  │
│  ↓                                               │
│  Frontend (150MB, 0.25 CPU, 256MB RAM) ────────  │
│  ↓                                               │
│  AI Engine (400MB, 1 CPU, 512MB RAM) ──────────  │
│  ↓                                               │
│  Redis (64MB, 0.1 CPU, 64MB RAM) ─────────────── │
│  ↓                                               │
│  Blockchain (93MB, 0.25 CPU, 128MB RAM) ──────── │
│  ↓                                               │
│  PostgreSQL (300MB, 0.5 CPU, 512MB RAM) ──────── │
│                                                   │
│  Total: ~1GB container memory                    │
│  Total: ~2 CPUs allocated                         │
│  Remaining: ~3GB for OS, cache, spikes           │
└─────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Critical (This Week)
1. ✅ Audit complete
2. ⏳ Implement multi-stage Docker build for AI Engine
3. ⏳ Add resource limits to docker-compose.prod.yml
4. ⏳ Reduce workers to 1
5. ⏳ Test image size reduction

### Phase 2: Optimization (Next Sprint)
1. Split requirements.txt (core vs optional)
2. Add feature flags
3. Implement Redis caching
4. Database pool tuning
5. Add monitoring (Prometheus + Grafana or simple logs)

### Phase 3: Reliability (Following Sprint)
1. Health check improvements
2. Graceful shutdown handling
3. Retry logic for external APIs
4. Circuit breakers for LLM calls
5. Automated backup verification

---

## Monitoring Checklist

After deployment, monitor these metrics:

```bash
# Container resource usage
docker stats

# Log analysis
docker logs ai-engine --tail 100 | grep -i error

# Database connections
docker exec postgres psql -U muse -c "SELECT count(*) FROM pg_stat_activity;"

# Response times
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/api/health
```

**curl-format.txt:**
```
     time_namelookup:  %{time_namelookup}s\n
        time_connect:  %{time_connect}s\n
     time_appconnect:  %{time_appconnect}s\n
    time_pretransfer:  %{time_pretransfer}s\n
       time_redirect:  %{time_redirect}s\n
  time_starttransfer:  %{time_starttransfer}s\n
                     ----------\n
          time_total:  %{time_total}s\n
```

---

## Cost Comparison

| Resource | Current | Optimized | Savings |
|----------|---------|-----------|---------|
| Storage per deploy | ~8GB | ~1GB | 87.5% |
| Pull time (100Mbps) | ~11 min | ~90 sec | 86% |
| Idle memory | ~900MB | ~600MB | 33% |
| Peak memory | Unknown | ~1.4GB | Controlled |

---

## Next Steps

1. **Review and approve** this audit and strategy
2. **Implement** Phase 1 optimizations
3. **Deploy** to staging environment
4. **Measure** improvements
5. **Iterate** based on real metrics
