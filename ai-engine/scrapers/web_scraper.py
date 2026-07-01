import asyncio
import json

import trafilatura
from bs4 import BeautifulSoup
import requests

from url_safety import ResolvedURL, UnsafeURLError, resolve_url


async def scrape_webpage(url: str) -> dict:
    try:
        resolved = resolve_url(url)
    except UnsafeURLError as exc:
        return {
            "status": "error",
            "type": "web_article",
            "message": str(exc),
            "url": url,
        }

    try:
        downloaded = await asyncio.to_thread(_fetch_html, resolved)
        if not downloaded:
            return {
                "status": "error",
                "type": "web_article",
                "message": "Failed to download URL contents",
                "url": url,
            }

        result = await asyncio.to_thread(
            trafilatura.extract,
            downloaded,
            False,
            False,
            False,
            "json",
        )

        if result:
            data = json.loads(result)
            return {
                "status": "success",
                "type": "web_article",
                "title": data.get("title", "Unknown Title"),
                "author": data.get("author", "Unknown Author"),
                "content": data.get("text", ""),
                "url": url,
            }

        soup = BeautifulSoup(downloaded, "html.parser")
        for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
            script.decompose()

        text = soup.get_text(separator="\n")
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = "\n".join(chunk for chunk in chunks if chunk)

        return {
            "status": "success",
            "type": "web_article",
            "title": soup.title.string if soup.title else "Unknown Title",
            "author": "Unknown",
            "content": text[:50000],
            "url": url,
        }

    except Exception as exc:
        return {
            "status": "error",
            "type": "web_article",
            "message": str(exc),
            "url": url,
        }


def _fetch_html(resolved: ResolvedURL) -> str | None:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Host": resolved.host_header,
    }
    response = requests.get(
        resolved.safe_url,
        headers=headers,
        timeout=10,
        allow_redirects=False,
    )
    if response.status_code >= 400:
        return None
    return response.text
