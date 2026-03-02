"""Web research service: search for product images and classify angles."""

import base64
import json
import os
import re
import uuid
from typing import Optional

import httpx

from app.config import config

ANGLE_CLASSIFICATION_PROMPT = """Look at this product image. What viewing angle does it show?

Classify as exactly ONE of:
- "front" — the primary face/screen/display side
- "left" — left side profile view
- "back" — the rear/back of the product
- "right" — right side profile view
- "top" — top-down view
- "other" — 3/4 angle, lifestyle, detail shot, or unclear

Also check: is the product ISOLATED (only the product visible), or does the image contain hands, people, arms, fingers, body parts, or other objects touching/holding the product?

Rate image quality for 3D reconstruction on a scale of 1-5:
- 5: Clean studio shot, white/neutral background, product fills frame, NOTHING else visible
- 4: Good product shot, neutral background, product isolated, minimal distractions
- 3: Product is clear but has some background clutter (table, desk, etc.)
- 2: Product is held by a hand or person, or product is partially obscured by other objects
- 1: Thumbnail, watermarked, low-res, product is small in frame, or heavily cluttered

IMPORTANT: Any image showing human hands, fingers, arms, or body parts holding or touching the product MUST be rated quality 2 or lower. We need ONLY the product for 3D reconstruction.

Return ONLY JSON: {"angle": "front", "quality": 4, "isolated": true}"""


async def _bing_image_search(query: str, max_results: int = 15) -> list[dict]:
    """Run a single Bing Image search. Returns list of {url, title}."""
    search_url = "https://www.bing.com/images/search"
    params = {
        "q": query,
        "qft": "+filterui:imagesize-large+filterui:photo-photo",
        "form": "IRFLTR",
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }
    results = []
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(search_url, params=params, headers=headers)
            resp.raise_for_status()
            html = resp.text

        pattern = r'murl&quot;:&quot;(https?://[^&]+?)&quot;'
        urls = re.findall(pattern, html)

        seen = set()
        for url in urls[:max_results]:
            if url not in seen:
                seen.add(url)
                results.append({"url": url, "title": ""})
    except Exception as e:
        print(f"[web_research] Bing search failed for '{query}': {e}")
    return results


async def search_product_images(
    product_name: str,
    brand: Optional[str] = None,
    max_results: int = 20,
) -> list[dict]:
    """Search Bing Images for product photos from multiple angles.

    Runs multiple queries to get front, side, and back views.
    Returns list of {url, title}.
    """
    query = product_name
    if brand:
        query = f"{brand} {product_name}"

    # Multiple search queries to get different angles
    queries = [
        f"{query} product isolated white background",
        f"{query} rear back view",
        f"{query} side view profile",
    ]

    all_results: list[dict] = []
    seen_urls: set[str] = set()

    for q in queries:
        results = await _bing_image_search(q, max_results=10)
        for r in results:
            if r["url"] not in seen_urls:
                seen_urls.add(r["url"])
                all_results.append(r)

    # Fallback: DuckDuckGo if nothing found
    if not all_results:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        }
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={"q": query, "format": "json", "iax": "images", "ia": "images"},
                    headers=headers,
                )
                data = resp.json()
                if data.get("Image"):
                    all_results.append({"url": data["Image"], "title": data.get("Heading", "")})
                for r in data.get("Results", []):
                    if r.get("Icon", {}).get("URL"):
                        all_results.append({"url": r["Icon"]["URL"], "title": r.get("Text", "")})
        except Exception as e:
            print(f"[web_research] DuckDuckGo fallback failed: {e}")

    print(f"[web_research] Found {len(all_results)} image URLs for '{query}' across {len(queries)} queries")
    return all_results[:max_results]


async def download_image(url: str) -> Optional[str]:
    """Download an image URL and save to upload dir. Returns file_id or None."""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()

        content_type = resp.headers.get("content-type", "")
        if "image" not in content_type:
            return None

        # Determine extension
        ext = ".jpg"
        if "png" in content_type:
            ext = ".png"
        elif "webp" in content_type:
            ext = ".webp"

        # Must be at least 10KB to be a real product photo
        if len(resp.content) < 10_000:
            return None

        file_id = str(uuid.uuid4())
        path = os.path.join(config.upload_dir, f"{file_id}{ext}")
        with open(path, "wb") as f:
            f.write(resp.content)

        return file_id

    except Exception as e:
        print(f"[web_research] Failed to download {url[:80]}: {e}")
        return None


async def classify_image_angle(file_id: str) -> dict:
    """Use Claude Vision to classify the viewing angle and quality of an image.

    Returns {"angle": "front"|"left"|"back"|"right"|"top"|"other", "quality": 1-5}
    """
    # Find the image file
    image_path = None
    for f in os.listdir(config.upload_dir):
        if f.startswith(file_id):
            image_path = os.path.join(config.upload_dir, f)
            break

    if not image_path:
        return {"angle": "other", "quality": 1}

    # Read and encode
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode()

    ext = os.path.splitext(image_path)[1].lower()
    media_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }.get(ext, "image/jpeg")

    # Call Claude Haiku (fast + cheap) for angle classification
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": config.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 100,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": image_data,
                                },
                            },
                            {"type": "text", "text": ANGLE_CLASSIFICATION_PROMPT},
                        ],
                    }
                ],
            },
        )
        resp.raise_for_status()

    text = resp.json()["content"][0]["text"].strip()
    # Parse JSON from response
    try:
        # Handle potential markdown code blocks
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text)
        quality = result.get("quality", 3)
        isolated = result.get("isolated", True)
        # Force low quality if not isolated (hands, people, etc.)
        if not isolated and quality > 2:
            quality = 2
        return {
            "angle": result.get("angle", "other"),
            "quality": quality,
            "isolated": isolated,
        }
    except (json.JSONDecodeError, IndexError):
        return {"angle": "other", "quality": 3, "isolated": True}


async def collect_reference_images(
    product_name: str,
    brand: Optional[str] = None,
    max_download: int = 12,
    max_classified: int = 10,
) -> dict:
    """Full pipeline: search → download → classify → return best images by angle.

    Returns {
        "images": [{"file_id": str, "angle": str, "quality": int, "source_url": str}],
        "angle_map": {"front": "file_id", ...},  # best image per angle
        "total_found": int,
        "total_downloaded": int,
    }
    """
    # 1. Search for images
    search_results = await search_product_images(product_name, brand, max_results=20)

    if not search_results:
        return {
            "images": [],
            "angle_map": {},
            "total_found": 0,
            "total_downloaded": 0,
        }

    # 2. Download top images (allow up to 2 per domain for variety)
    domain_count: dict[str, int] = {}
    downloaded = []
    MAX_PER_DOMAIN = 2

    for result in search_results:
        if len(downloaded) >= max_download:
            break

        url = result["url"]
        try:
            domain = url.split("/")[2]
            if domain_count.get(domain, 0) >= MAX_PER_DOMAIN:
                continue
            domain_count[domain] = domain_count.get(domain, 0) + 1
        except IndexError:
            continue

        file_id = await download_image(url)
        if file_id:
            downloaded.append({
                "file_id": file_id,
                "source_url": url,
                "title": result.get("title", ""),
            })

    if not downloaded:
        return {
            "images": [],
            "angle_map": {},
            "total_found": len(search_results),
            "total_downloaded": 0,
        }

    print(f"[web_research] Downloaded {len(downloaded)} images, classifying angles...")

    # 3. Classify angles and quality
    classified = []
    for img in downloaded[:max_classified]:
        classification = await classify_image_angle(img["file_id"])
        classified.append({
            **img,
            "angle": classification["angle"],
            "quality": classification["quality"],
        })
        print(f"  {img['file_id'][:8]}... → angle={classification['angle']}, quality={classification['quality']}")

    # 4. Build angle map — pick the highest quality ISOLATED image for each angle
    # Only use front/left/back/right (Tripo's valid angles)
    # Minimum quality 3 — must be a clean product shot, no hands/people
    MIN_QUALITY = 3
    valid_angles = {"front", "left", "back", "right"}
    angle_map: dict[str, str] = {}
    angle_quality: dict[str, int] = {}

    for img in classified:
        angle = img["angle"]
        if angle not in valid_angles:
            continue
        if img["quality"] < MIN_QUALITY:
            print(f"  Skipping {img['file_id'][:8]}... quality={img['quality']} < {MIN_QUALITY}")
            continue
        if angle not in angle_map or img["quality"] > angle_quality.get(angle, 0):
            angle_map[angle] = img["file_id"]
            angle_quality[angle] = img["quality"]

    # If no front view found, use the highest quality image as front (even if < MIN_QUALITY)
    if "front" not in angle_map and classified:
        best = max(classified, key=lambda x: x["quality"])
        if best["quality"] >= MIN_QUALITY:
            angle_map["front"] = best["file_id"]

    print(f"[web_research] Angle map: {list(angle_map.keys())} ({len(angle_map)} angles)")

    return {
        "images": classified,
        "angle_map": angle_map,
        "total_found": len(search_results),
        "total_downloaded": len(downloaded),
    }
