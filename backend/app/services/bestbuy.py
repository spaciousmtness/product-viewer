"""Best Buy Products API integration.

Free tier: 50,000 calls/day, 5 req/sec.
Docs: https://bestbuyapis.github.io/api-documentation/
"""

import httpx

from app.config import config

import re

BESTBUY_API_BASE = "https://api.bestbuy.com/v1"


def _parse_number(val: str | int | float | None) -> float | None:
    """Extract a number from a value like '0.66 inches' or '4.7 pounds'."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    match = re.search(r"[\d.]+", str(val))
    return float(match.group()) if match else None


async def search_product(query: str, limit: int = 3) -> list[dict]:
    """Search Best Buy catalog by product name. Returns list of product specs.

    Each result includes: name, sku, upc, dimensions, weight, description,
    manufacturer, modelNumber, image, and any available specs.
    """
    if not config.bestbuy_api_key:
        return []

    # Fields we want from Best Buy
    show_fields = ",".join([
        "name", "sku", "upc", "manufacturer", "modelNumber",
        "shortDescription", "longDescription",
        "height", "width", "depth", "weight",
        "color", "image", "categoryPath",
        "features.feature",
    ])

    params = {
        "format": "json",
        "apiKey": config.bestbuy_api_key,
        "show": show_fields,
        "pageSize": str(limit),
    }

    # Best Buy search syntax — filter to physical products for better results
    search_query = query.replace("&", "and").replace("?", "")
    url = f"{BESTBUY_API_BASE}/products(search={search_query}&type=HardGood)"

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError:
            return []

    data = resp.json()
    products = data.get("products", [])

    # Normalize into our format
    results = []
    for p in products:
        result = {
            "source": "bestbuy",
            "name": p.get("name"),
            "sku": p.get("sku"),
            "upc": p.get("upc"),
            "manufacturer": p.get("manufacturer"),
            "modelNumber": p.get("modelNumber"),
            "description": p.get("shortDescription") or p.get("longDescription"),
            "image": p.get("image"),
            "color": p.get("color"),
            "category": _extract_category(p.get("categoryPath", [])),
        }

        # Physical dimensions (Best Buy returns as strings like "0.66 inches")
        dims = {}
        for key in ("height", "width", "depth"):
            val = p.get(key)
            if val:
                dims[f"{key}_raw"] = val
                num = _parse_number(val)
                if num is not None:
                    dims[f"{key}_in"] = num
                    dims[f"{key}_mm"] = round(num * 25.4, 1)
        weight_val = p.get("weight")
        if weight_val:
            dims["weight_raw"] = weight_val
            num = _parse_number(weight_val)
            if num is not None:
                dims["weight_lbs"] = num
                dims["weight_g"] = round(num * 453.592, 1)
        if dims:
            result["dimensions"] = dims

        # Features list
        features = p.get("features", [])
        if features:
            result["features"] = [
                f["feature"] for f in features if f.get("feature")
            ][:10]

        results.append(result)

    return results


def _extract_category(category_path: list) -> str | None:
    """Pull the most specific category from Best Buy's category path."""
    if not category_path:
        return None
    # Category path is like [{"name": "Electronics"}, {"name": "Cameras"}, ...]
    # Take the last (most specific) one
    if isinstance(category_path[-1], dict):
        return category_path[-1].get("name")
    return str(category_path[-1])


async def lookup_by_upc(upc: str) -> dict | None:
    """Look up a single product by UPC barcode."""
    if not config.bestbuy_api_key:
        return None

    show_fields = ",".join([
        "name", "sku", "upc", "manufacturer", "modelNumber",
        "shortDescription", "longDescription",
        "height", "width", "depth", "weight",
        "color", "image", "categoryPath",
        "features.feature",
    ])

    url = f"{BESTBUY_API_BASE}/products(upc={upc})"
    params = {
        "format": "json",
        "apiKey": config.bestbuy_api_key,
        "show": show_fields,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError:
            return None

    data = resp.json()
    products = data.get("products", [])
    if not products:
        return None

    # Re-use search_product normalization by running through the same flow
    results = await search_product(products[0].get("name", ""), limit=1)
    return results[0] if results else None
