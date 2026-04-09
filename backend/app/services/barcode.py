"""Barcode/UPC lookup service.

Uses the UPCitemdb API to look up product information by barcode.
Free tier: 100 req/day. Optional API key for higher limits.
Docs: https://www.upcitemdb.com/api
"""

import logging

import httpx

from app.config import config

logger = logging.getLogger(__name__)

UPCITEMDB_URL = "https://api.upcitemdb.com/prod/trial/lookup"
UPCITEMDB_AUTHED_URL = "https://api.upcitemdb.com/prod/v1/lookup"


async def lookup_barcode(upc: str) -> dict | None:
    """Look up a product by UPC/EAN barcode.

    Returns product_name, brand, category, description, images, and offers.
    Falls back to None if the barcode is not found or the API fails.
    """
    upc = upc.strip()
    if not upc:
        return None

    # Choose URL and headers based on whether we have an API key
    if config.upcitemdb_api_key:
        url = UPCITEMDB_AUTHED_URL
        headers = {
            "Accept": "application/json",
            "user_key": config.upcitemdb_api_key,
        }
    else:
        url = UPCITEMDB_URL
        headers = {"Accept": "application/json"}

    params = {"upc": upc}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("UPCitemdb lookup failed for %s: %s", upc, exc)
        return None

    data = resp.json()

    items = data.get("items", [])
    if not items:
        return None

    item = items[0]

    # Extract offers
    offers = []
    for offer in item.get("offers", [])[:5]:
        offers.append({
            "merchant": offer.get("merchant"),
            "title": offer.get("title"),
            "price": offer.get("price"),
            "currency": offer.get("currency"),
            "link": offer.get("link"),
        })

    return {
        "source": "upcitemdb",
        "upc": item.get("upc") or upc,
        "ean": item.get("ean"),
        "product_name": item.get("title", ""),
        "brand": item.get("brand", ""),
        "category": item.get("category", ""),
        "description": item.get("description", ""),
        "images": item.get("images", []),
        "offers": offers,
        "weight": item.get("weight"),
        "size": item.get("size"),
    }
