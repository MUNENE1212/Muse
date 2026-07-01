import asyncio
import re

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter

from url_safety import is_safe_url


def extract_video_id(url: str) -> str | None:
    regex = r"(?:v=|\/)([0-9A-Za-z_-]{11}).*"
    match = re.search(regex, url)
    if match:
        return match.group(1)
    return None


async def scrape_youtube_transcript(url: str) -> dict:
    if not is_safe_url(url):
        return {
            "status": "error",
            "type": "youtube_transcript",
            "message": "URL failed safety validation",
            "url": url,
        }

    try:
        video_id = extract_video_id(url)
        if not video_id:
            return {
                "status": "error",
                "message": "Could not extract valid YouTube video ID.",
                "url": url,
            }

        transcript = await asyncio.to_thread(
            YouTubeTranscriptApi.get_transcript, video_id
        )

        formatter = TextFormatter()
        text_formatted = formatter.format_transcript(transcript)
        clean_text = re.sub(r"\n+", " ", text_formatted)

        return {
            "status": "success",
            "type": "youtube_transcript",
            "title": f"YouTube Video ({video_id})",
            "author": "Unknown Channel",
            "content": clean_text,
            "url": url,
        }

    except Exception as exc:
        return {
            "status": "error",
            "type": "youtube_transcript",
            "message": str(exc),
            "url": url,
        }
