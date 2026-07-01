import re

from playwright.async_api import async_playwright

from url_safety import UnsafeURLError, resolve_url


async def scrape_social_media(url: str) -> dict:
    try:
        resolved = resolve_url(url)
    except UnsafeURLError as exc:
        return {
            "status": "error",
            "type": "social_media",
            "message": str(exc),
            "url": url,
        }

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                )
            )
            page = await context.new_page()
            await page.goto(resolved.safe_url, wait_until="networkidle", timeout=15000)

            raw_text = await page.locator("body").inner_text()
            title = await page.title()

            await browser.close()

            clean_text = re.sub(r"\n{3,}", "\n\n", raw_text).strip()

            return {
                "status": "success",
                "type": "social_media",
                "title": title,
                "author": "Extracted via Browser",
                "content": clean_text[:20000],
                "url": url,
            }

    except Exception as exc:
        return {
            "status": "error",
            "type": "social_media",
            "message": f"Headless Browser Extraction Failed: {exc}",
            "url": url,
        }
