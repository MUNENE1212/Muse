# ============================================
# MUSE AI Engine - Main Application (With Caching)
# ============================================
# This version includes Redis caching for all expensive operations
# ============================================

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from scrapers import scrape_webpage, scrape_youtube_transcript, scrape_social_media, parse_document
from database import get_room_artifacts, save_threads, init_pool, close_pool
from synthesizer import synthesize_artifacts
from url_safety import UnsafeURLError, resolve_url
from cache import cached, cached_scrape, cached_social_scrape, cached_youtube, cached_document, close_cache, invalidate_pattern


logger = logging.getLogger("muse.ai_engine")

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
UPLOAD_CHUNK_SIZE = 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".xlsx", ".pptx", ".html"}


def _configure_logging() -> None:
    root = logging.getLogger()
    if root.handlers:
        return
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()
    logger.info("Starting Muse AI Engine")
    try:
        await init_pool()
        logger.info("Database pool initialized")
    except Exception as exc:
        logger.warning("Database pool init skipped: %s", exc)

    yield

    await close_pool()
    await close_cache()
    logger.info("Muse AI Engine stopped")


app = FastAPI(title="Muse AI Engine", version="1.0.0", lifespan=lifespan)


class AnalysisRequest(BaseModel):
    content: str | None = None
    text: str | None = None
    user_id: str | None = None


class ScrapeRequest(BaseModel):
    url: str
    bypass_cache: bool = False  # Allow bypassing cache for fresh data


class SynthesizeRequest(BaseModel):
    room_id: str
    bypass_cache: bool = False


class CacheInvalidateRequest(BaseModel):
    pattern: str


def _resolve_content(request: AnalysisRequest) -> str:
    return (request.content or request.text or "").strip()


def _unsafe_url_response(message: str) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error": "unsafe_url", "message": message},
    )


@app.get("/")
def read_root():
    return {"status": "AI Engine is running", "cache": "enabled"}


@app.get("/api/cache/stats")
async def cache_stats():
    """Get cache statistics."""
    from cache import get_cache_stats
    return await get_cache_stats()


@app.post("/api/cache/invalidate")
async def cache_invalidate(request: CacheInvalidateRequest):
    """Invalidate cache entries by pattern."""
    count = await invalidate_pattern(request.pattern)
    return {"status": "success", "invalidated": count}


@app.post("/api/cache/flush")
async def cache_flush():
    """Flush all cache entries."""
    from cache import flush_cache
    success = await flush_cache()
    return {"status": "success" if success else "failed"}


# ============================================
# Cached Scrape Endpoints
# ============================================

def _make_scrape_key(url: str) -> str:
    """Generate cache key for URL scraping."""
    import hashlib
    return f"scrape:web:{hashlib.sha256(url.encode()).hexdigest()}"


def _make_youtube_key(url: str) -> str:
    """Generate cache key for YouTube transcripts."""
    import hashlib
    return f"scrape:youtube:{hashlib.sha256(url.encode()).hexdigest()}"


def _make_social_key(url: str) -> str:
    """Generate cache key for social media scraping."""
    import hashlib
    return f"scrape:social:{hashlib.sha256(url.encode()).hexdigest()}"


@app.post("/api/scrape")
async def scrape_url(request: ScrapeRequest):
    """Scrape URL with caching."""
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Missing URL")

    try:
        resolve_url(url)
    except UnsafeURLError as exc:
        return _unsafe_url_response(str(exc))

    # Check cache first (unless bypass requested)
    if not request.bypass_cache:
        from cache import get_with_fallback
        cache_key = _make_scrape_key(url)
        cached_result = await get_with_fallback(cache_key)
        if cached_result:
            logger.info("Cache hit for scrape: %s", url)
            return cached_result

    # Route to appropriate scraper
    if "youtube.com" in url or "youtu.be" in url:
        result = await scrape_youtube_transcript(url)
        cache_key = _make_youtube_key(url)
        cache_ttl = 604800  # 7 days for YouTube
    elif any(domain in url for domain in ["twitter.com", "x.com", "reddit.com", "linkedin.com", "instagram.com"]):
        result = await scrape_social_media(url)
        cache_key = _make_social_key(url)
        cache_ttl = 43200  # 12 hours for social media
    else:
        result = await scrape_webpage(url)
        cache_key = _make_scrape_key(url)
        cache_ttl = 86400  # 24 hours for web pages

    if result.get("status") == "error":
        message = result.get("message", "Scrape failed")
        if result.get("error_code") == "unsafe_url":
            return _unsafe_url_response(message)
        raise HTTPException(status_code=400, detail=message)

    # Cache successful results
    if result.get("status") == "success":
        from cache import set_with_fallback
        await set_with_fallback(cache_key, result, cache_ttl)

    return result


# ============================================
# Cached Upload Endpoint
# ============================================

def _validate_upload_filename(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "error": "unsupported_file_type",
                "message": (
                    f"Extension {ext!r} is not allowed. "
                    f"Allowed: {sorted(ALLOWED_UPLOAD_EXTENSIONS)}"
                ),
            },
        )
    return ext


async def _read_upload_with_cap(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(UPLOAD_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                    "error": "file_too_large",
                    "message": (
                        f"Upload exceeds maximum size of {MAX_UPLOAD_BYTES} bytes "
                        f"({MAX_UPLOAD_BYTES // (1024 * 1024)} MB)."
                    ),
                },
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _make_document_key(file_bytes: bytes, filename: str) -> str:
    """Generate cache key for document parsing."""
    import hashlib
    content_hash = hashlib.sha256(file_bytes).hexdigest()
    return f"parse:document:{content_hash}:{filename}"


@app.post("/api/upload-document")
async def upload_document(file: UploadFile = File(...)):
    """Upload and parse document with caching."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    _validate_upload_filename(file.filename)
    file_bytes = await _read_upload_with_cap(file)

    # Check cache
    cache_key = _make_document_key(file_bytes, file.filename)
    from cache import get_with_fallback
    cached_result = await get_with_fallback(cache_key)
    if cached_result:
        logger.info("Cache hit for document: %s", file.filename)
        return cached_result

    # Parse document
    result = await parse_document(file_bytes, file.filename)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))

    # Cache successful result
    if result.get("status") == "success":
        from cache import set_with_fallback
        await set_with_fallback(cache_key, result, 2592000)  # 30 days

    return result


# ============================================
# Cached Synthesis Endpoint
# ============================================

def _make_synthesis_key(room_id: str, artifact_ids: list[str]) -> str:
    """Generate cache key for synthesis results."""
    import hashlib
    # Sort IDs for consistent key
    ids_str = ",".join(sorted(artifact_ids))
    return f"synthesis:room:{room_id}:{hashlib.sha256(ids_str.encode()).hexdigest()}"


@app.post("/api/synthesize")
async def synthesize_room(request: SynthesizeRequest):
    """Synthesize artifacts with caching."""
    try:
        artifacts = await get_room_artifacts(request.room_id)
        if not artifacts:
            return {
                "status": "success",
                "message": "No artifacts found to synthesize.",
                "threads_generated": 0,
            }

        # Generate cache key from artifact IDs
        artifact_ids = [str(a.get("id", "")) for a in artifacts]
        cache_key = _make_synthesis_key(request.room_id, artifact_ids)

        # Check cache (unless bypass requested)
        if not request.bypass_cache:
            from cache import get_with_fallback
            cached_result = await get_with_fallback(cache_key)
            if cached_result:
                logger.info("Cache hit for synthesis: room %s", request.room_id)
                return {
                    "status": "success",
                    "threads_generated": len(cached_result),
                    "cached": True,
                }

        # Run synthesis
        db_threads = await synthesize_artifacts(artifacts)

        # Cache result (expensive operation!)
        if db_threads:
            from cache import set_with_fallback
            await set_with_fallback(cache_key, db_threads, 604800)  # 7 days
            await save_threads(request.room_id, db_threads)

        return {
            "status": "success",
            "threads_generated": len(db_threads),
            "cached": False,
        }
    except Exception as exc:
        logger.exception("Synthesis failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================
# Analyze Endpoint (Legacy, simple)
# ============================================

@app.post("/api/analyze")
def analyze_content(request: AnalysisRequest):
    content = _resolve_content(request)

    if not content:
        return {
            "status": "error",
            "message": "Missing content to analyze",
        }

    return {
        "status": "success",
        "patterns_detected": ["placeholder_pattern"],
        "sentiment": "neutral",
        "keywords": content.split()[:5],
    }


@app.post("/analyze")
def analyze_content_legacy(request: AnalysisRequest):
    return analyze_content(request)
