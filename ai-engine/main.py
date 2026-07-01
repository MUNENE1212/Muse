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
    try:
        yield
    finally:
        await close_pool()
        logger.info("Muse AI Engine stopped")


app = FastAPI(title="Muse AI Engine", version="1.0.0", lifespan=lifespan)


class AnalysisRequest(BaseModel):
    content: str | None = None
    text: str | None = None
    user_id: str | None = None


class ScrapeRequest(BaseModel):
    url: str


class SynthesizeRequest(BaseModel):
    room_id: str


def _resolve_content(request: AnalysisRequest) -> str:
    return (request.content or request.text or "").strip()


def _unsafe_url_response(message: str) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error": "unsafe_url", "message": message},
    )


@app.get("/")
def read_root():
    return {"status": "AI Engine is running"}


@app.post("/api/scrape")
async def scrape_url(request: ScrapeRequest):
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Missing URL")

    try:
        resolve_url(url)
    except UnsafeURLError as exc:
        return _unsafe_url_response(str(exc))

    if "youtube.com" in url or "youtu.be" in url:
        result = await scrape_youtube_transcript(url)
    elif any(domain in url for domain in ["twitter.com", "x.com", "reddit.com", "linkedin.com", "instagram.com"]):
        result = await scrape_social_media(url)
    else:
        result = await scrape_webpage(url)

    if result.get("status") == "error":
        message = result.get("message", "Scrape failed")
        if result.get("error_code") == "unsafe_url":
            return _unsafe_url_response(message)
        raise HTTPException(status_code=400, detail=message)

    return result


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


@app.post("/api/upload-document")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    _validate_upload_filename(file.filename)
    file_bytes = await _read_upload_with_cap(file)

    result = await parse_document(file_bytes, file.filename)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))

    return result


@app.post("/api/synthesize")
async def synthesize_room(request: SynthesizeRequest):
    try:
        artifacts = await get_room_artifacts(request.room_id)
        if not artifacts:
            return {
                "status": "success",
                "message": "No artifacts found to synthesize.",
                "threads_generated": 0,
            }

        db_threads = await synthesize_artifacts(artifacts)

        if db_threads:
            await save_threads(request.room_id, db_threads)

        return {"status": "success", "threads_generated": len(db_threads)}
    except Exception as exc:
        logger.exception("Synthesis failed")
        raise HTTPException(status_code=500, detail=str(exc))


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
