"""Wikipedia REST API integration.

Free, no API key needed. Good for product history, cultural context,
and supplemental specs for well-known products.

API docs: https://en.wikipedia.org/api/rest_v1/
"""

import httpx

WIKI_API_BASE = "https://en.wikipedia.org/api/rest_v1"
WIKI_SEARCH_BASE = "https://en.wikipedia.org/w/api.php"
# Wikipedia requires a descriptive User-Agent per their API policy
HEADERS = {"User-Agent": "ProductViewer/0.3 (https://github.com/product-viewer; productviewer@localhost)"}


async def search_product(query: str) -> dict | None:
    """Search Wikipedia for a product and return a summary.

    Returns normalized data with description, image, and extract,
    or None if no relevant article found.
    """
    if not query:
        return None

    # Step 1: Search for the best matching article
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srlimit": "3",
        "format": "json",
    }

    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
        try:
            resp = await client.get(WIKI_SEARCH_BASE, params=params)
            resp.raise_for_status()
        except httpx.HTTPError:
            return None

    data = resp.json()
    results = data.get("query", {}).get("search", [])
    if not results:
        return None

    # Step 2: Get the summary for the best match
    title = results[0]["title"]
    return await _get_summary(title)


async def _get_summary(title: str) -> dict | None:
    """Fetch the REST API summary for a Wikipedia article."""
    url = f"{WIKI_API_BASE}/page/summary/{title.replace(' ', '_')}"

    async with httpx.AsyncClient(timeout=10, headers=HEADERS, follow_redirects=True) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except httpx.HTTPError:
            return None

    data = resp.json()

    if data.get("type") == "disambiguation":
        return None

    result = {
        "source": "wikipedia",
        "name": data.get("title"),
        "description": data.get("description"),
        "extract": data.get("extract"),
        "url": data.get("content_urls", {}).get("desktop", {}).get("page"),
    }

    # Thumbnail image
    thumb = data.get("thumbnail")
    if thumb:
        result["image"] = thumb.get("source")

    # Original image
    original = data.get("originalimage")
    if original:
        result["originalImage"] = original.get("source")

    return result
