"""ICECAT Open Catalog API integration.

Free open catalog with ~200K+ products. Strong on electronics,
instruments, and industrial equipment.

API docs: https://iceclog.com/manual-for-icecat-json-product-requests/
"""

import httpx

from app.config import config

ICECAT_API_BASE = "https://live.icecat.biz/api"


async def lookup_product(
    brand: str,
    product_code: str,
    lang: str = "EN",
) -> dict | None:
    """Look up a product by brand + model/product code.

    Returns normalized product data or None if not found.
    """
    if not brand or not product_code:
        return None

    params = {
        "shopname": config.icecat_username,
        "lang": lang,
        "Brand": brand,
        "ProductCode": product_code,
        "content": "",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(ICECAT_API_BASE, params=params)
            resp.raise_for_status()
        except httpx.HTTPError:
            return None

    data = resp.json()

    # ICECAT returns {"msg": "OK", "data": {...}} on success
    # or {"msg": "...", "data": {}} with an error message
    if data.get("msg") != "OK" or not data.get("data"):
        return None

    return _normalize(data["data"])


async def lookup_by_gtin(gtin: str, lang: str = "EN") -> dict | None:
    """Look up a product by GTIN (EAN/UPC barcode)."""
    if not gtin:
        return None

    params = {
        "shopname": config.icecat_username,
        "lang": lang,
        "GTIN": gtin,
        "content": "",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(ICECAT_API_BASE, params=params)
            resp.raise_for_status()
        except httpx.HTTPError:
            return None

    data = resp.json()
    if data.get("msg") != "OK" or not data.get("data"):
        return None

    return _normalize(data["data"])


async def search_product(query: str, brand: str | None = None) -> dict | None:
    """Try to find a product using brand + model extracted from a query string.

    This is a convenience wrapper — ICECAT doesn't have free-text search,
    so we parse the query into brand + product code and do a direct lookup.
    """
    if brand:
        # Try the query as a product code with the given brand
        result = await lookup_product(brand, query)
        if result:
            return result

        # Try stripping brand from query to get just the model
        query_lower = query.lower()
        brand_lower = brand.lower()
        if query_lower.startswith(brand_lower):
            model = query[len(brand):].strip()
            if model:
                result = await lookup_product(brand, model)
                if result:
                    return result

    # Try splitting query into "brand model"
    parts = query.split(None, 1)
    if len(parts) == 2:
        result = await lookup_product(parts[0], parts[1])
        if result:
            return result

    return None


def _normalize(data: dict) -> dict:
    """Normalize ICECAT response into our standard format."""
    general = data.get("GeneralInfo", {})

    result = {
        "source": "icecat",
        "name": general.get("Title") or general.get("BrandPartCode"),
        "brand": general.get("BrandInfo", {}).get("BrandName"),
        "modelNumber": general.get("BrandPartCode"),
        "category": general.get("Category", {}).get("Name", {}).get("Value"),
        "description": general.get("SummaryDescription", {}).get("LongSummaryDescription")
            or general.get("SummaryDescription", {}).get("ShortSummaryDescription"),
        "ean": general.get("GTIN", [None])[0] if isinstance(general.get("GTIN"), list) else general.get("GTIN"),
        "icecatId": general.get("IcecatId"),
    }

    # Image
    image_info = data.get("Image", {})
    if image_info.get("HighPic"):
        result["image"] = image_info["HighPic"]
    elif image_info.get("MediumPic"):
        result["image"] = image_info["MediumPic"]

    # Extract specs from FeaturesGroups
    dimensions = {}
    specs = {}
    features_groups = data.get("FeaturesGroups", [])
    for group in features_groups:
        group_name = group.get("FeatureGroup", {}).get("Name", {}).get("Value", "")
        features = group.get("Features", [])
        for feature in features:
            fname = feature.get("Feature", {}).get("Name", {}).get("Value", "")
            fval = feature.get("Value")
            funit = feature.get("Feature", {}).get("Measure", {}).get("Signs", {}).get("_", "")

            if not fname or fval is None:
                continue

            display_val = f"{fval} {funit}".strip() if funit else str(fval)

            # Capture physical dimensions specifically
            fname_lower = fname.lower()
            if "height" in fname_lower and _is_dimension(fval):
                dimensions["height_raw"] = display_val
                dimensions["height_mm"] = _to_mm(fval, funit)
            elif "width" in fname_lower and _is_dimension(fval):
                dimensions["width_raw"] = display_val
                dimensions["width_mm"] = _to_mm(fval, funit)
            elif "depth" in fname_lower and _is_dimension(fval):
                dimensions["depth_raw"] = display_val
                dimensions["depth_mm"] = _to_mm(fval, funit)
            elif "weight" in fname_lower:
                dimensions["weight_raw"] = display_val
                if _is_number(fval):
                    num = float(fval)
                    if "kg" in funit.lower():
                        dimensions["weight_g"] = round(num * 1000, 1)
                    elif "g" in funit.lower():
                        dimensions["weight_g"] = round(num, 1)
                    elif "lb" in funit.lower() or "pound" in funit.lower():
                        dimensions["weight_g"] = round(num * 453.592, 1)
            else:
                # Store as general spec
                specs[fname] = display_val

    if dimensions:
        result["dimensions"] = dimensions
    if specs:
        # Keep only the most useful specs (first 20)
        result["specs"] = dict(list(specs.items())[:20])

    return result


def _is_number(val) -> bool:
    try:
        float(val)
        return True
    except (ValueError, TypeError):
        return False


def _is_dimension(val) -> bool:
    """Check if a value looks like a dimension number."""
    return _is_number(val) and float(val) > 0


def _to_mm(val, unit: str) -> float | None:
    """Convert a dimension value to mm."""
    try:
        num = float(val)
    except (ValueError, TypeError):
        return None
    unit_lower = unit.lower()
    if "mm" in unit_lower:
        return round(num, 1)
    if "cm" in unit_lower:
        return round(num * 10, 1)
    if "m" in unit_lower and "mm" not in unit_lower and "cm" not in unit_lower:
        return round(num * 1000, 1)
    if "in" in unit_lower or '"' in unit_lower:
        return round(num * 25.4, 1)
    # If unit is mm-scale (value < 2000), assume mm
    if num < 2000:
        return round(num, 1)
    return None
