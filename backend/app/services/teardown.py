"""iFixit teardown data integration.

Searches iFixit for product teardowns — step-by-step disassembly guides
with photos, tools required, and difficulty ratings.
Free, no auth required.
Docs: https://www.ifixit.com/api/2.0/doc/
"""

import logging

import httpx

logger = logging.getLogger(__name__)

IFIXIT_API_BASE = "https://www.ifixit.com/api/2.0"


async def search_teardowns(query: str, limit: int = 5) -> list[dict]:
    """Search iFixit for teardown guides matching the query.

    Returns title, device_name, difficulty, step summary,
    tools_required, and URL.
    """
    params = {
        "query": query,
        "limit": limit,
        "filter": "teardown",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{IFIXIT_API_BASE}/search/{query}",
                params={"filter": "teardown", "limit": limit},
            )
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("iFixit search failed: %s", exc)
        return []

    data = resp.json()
    guides = data.get("results", [])

    results = []
    for guide in guides:
        # The search API returns mixed results; filter for guides
        if guide.get("dataType") not in ("guide", "wiki"):
            continue

        guide_data = guide.get("data", guide)

        # Extract tools from the guide steps or metadata
        tools = []
        if isinstance(guide_data.get("tools"), list):
            tools = [t.get("text", t) if isinstance(t, dict) else str(t)
                     for t in guide_data["tools"]]

        # Step count and first image
        steps = guide_data.get("steps", [])
        step_count = len(steps) if isinstance(steps, list) else guide_data.get("step_count", 0)

        # First image from guide
        image = guide_data.get("image", {})
        image_url = None
        if isinstance(image, dict):
            image_url = image.get("standard") or image.get("medium") or image.get("large")

        results.append({
            "source": "ifixit",
            "guide_id": guide_data.get("guideid") or guide_data.get("id"),
            "title": guide_data.get("title", ""),
            "device_name": guide_data.get("device") or guide_data.get("topic", ""),
            "difficulty": guide_data.get("difficulty", "Unknown"),
            "step_count": step_count,
            "tools_required": tools,
            "image_url": image_url,
            "url": guide_data.get("url", ""),
        })

    return results[:limit]


async def get_teardown(guide_id: int) -> dict | None:
    """Get the full teardown guide with all steps, images, and tools.

    Returns the complete guide data including every step's text and images.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{IFIXIT_API_BASE}/guides/{guide_id}")
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("iFixit guide fetch failed for %d: %s", guide_id, exc)
        return None

    data = resp.json()

    # Parse steps
    steps = []
    for step in data.get("steps", []):
        step_images = []
        for media in step.get("media", {}).get("data", []):
            if isinstance(media, dict):
                step_images.append(
                    media.get("standard") or media.get("medium") or media.get("large", "")
                )

        # Combine text lines
        lines = []
        for line in step.get("lines", []):
            text = line.get("text_rendered") or line.get("text", "")
            if text:
                lines.append(text)

        steps.append({
            "step_number": step.get("orderby", 0),
            "title": step.get("title", ""),
            "text": "\n".join(lines),
            "images": step_images,
        })

    # Tools
    tools = []
    for tool in data.get("tools", []):
        if isinstance(tool, dict):
            tools.append(tool.get("text", str(tool)))
        else:
            tools.append(str(tool))

    # Guide image
    image = data.get("image", {})
    image_url = None
    if isinstance(image, dict):
        image_url = image.get("standard") or image.get("large")

    return {
        "source": "ifixit",
        "guide_id": data.get("guideid"),
        "title": data.get("title", ""),
        "device_name": data.get("device", ""),
        "difficulty": data.get("difficulty", "Unknown"),
        "time_required": data.get("time_required", ""),
        "introduction": data.get("introduction_rendered", ""),
        "conclusion": data.get("conclusion_rendered", ""),
        "tools_required": tools,
        "steps": steps,
        "image_url": image_url,
        "url": data.get("url", ""),
    }
