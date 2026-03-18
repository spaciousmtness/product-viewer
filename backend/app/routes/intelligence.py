"""v2 API — Master Intelligence Pipeline.

The "one button, everything" endpoint. Runs ALL data sources in parallel
and returns a unified intelligence object with data from every source.
"""

import asyncio
import logging
import time

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.octopart import search_components
from app.services.patents import search_patents
from app.services.teardown import search_teardowns
from app.services.materials import lookup_material
from app.services.fcc import search_fcc
from app.services.barcode import lookup_barcode
from app.services.bestbuy import search_product as bestbuy_search
from app.services.icecat import search_product as icecat_search
from app.services.wikipedia import search_product as wiki_search

logger = logging.getLogger(__name__)

router = APIRouter()


class IntelligenceRequest(BaseModel):
    product_name: str
    brand: str | None = None
    model_number: str | None = None
    file_id: str | None = None
    upc: str | None = None
    materials: list[str] | None = None


@router.post("/intelligence")
async def run_intelligence_pipeline(body: IntelligenceRequest):
    """Run the full product intelligence pipeline.

    Executes ALL data sources in parallel:
    - Best Buy, ICECAT, Wikipedia (spec databases)
    - Octopart (electronic components)
    - USPTO (patents)
    - iFixit (teardowns)
    - FCC (regulatory filings)
    - UPCitemdb (barcode lookup)
    - Materials database (material properties)

    Returns a unified intelligence object. Each source that fails
    gracefully returns empty/null — the pipeline never blocks on
    a single source failure.
    """
    start = time.monotonic()

    # Build the query string — use the most specific combination available
    query = body.product_name
    if body.brand:
        query = f"{body.brand} {query}"
    if body.model_number:
        query = f"{query} {body.model_number}"

    # ── Launch ALL sources in parallel ───────────────────────────────
    tasks = {
        "bestbuy": bestbuy_search(body.product_name, limit=3),
        "icecat": icecat_search(body.product_name, brand=body.brand),
        "wikipedia": wiki_search(body.product_name),
        "components": search_components(query, limit=5),
        "patents": search_patents(query, limit=5),
        "teardowns": search_teardowns(body.product_name, limit=5),
        "fcc": search_fcc(query, limit=5),
    }

    # Add barcode lookup if UPC provided
    if body.upc:
        tasks["barcode"] = lookup_barcode(body.upc)

    # Add material lookups if materials specified
    material_names = body.materials or []
    for i, mat in enumerate(material_names[:5]):
        tasks[f"material_{i}"] = lookup_material(mat)

    # Run everything in parallel with return_exceptions=True
    keys = list(tasks.keys())
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    # ── Collect results ─────────────────────────────────────────────
    gathered = {}
    errors = []
    for key, result in zip(keys, results):
        if isinstance(result, Exception):
            logger.warning("Intelligence source %s failed: %s", key, result)
            errors.append({"source": key, "error": str(result)})
            gathered[key] = None
        else:
            gathered[key] = result

    # ── Assemble the unified intelligence object ────────────────────
    # Merge material lookups back into a single list
    materials_data = []
    for key in list(gathered.keys()):
        if key.startswith("material_"):
            val = gathered.pop(key)
            if val is not None:
                materials_data.append(val)

    elapsed_ms = round((time.monotonic() - start) * 1000)

    # Count how many sources returned data
    sources_with_data = []
    sources_empty = []
    for key, val in gathered.items():
        if val is None or val == [] or val == {}:
            sources_empty.append(key)
        else:
            sources_with_data.append(key)
    if materials_data:
        sources_with_data.append("materials")

    return {
        "query": {
            "product_name": body.product_name,
            "brand": body.brand,
            "model_number": body.model_number,
            "upc": body.upc,
        },
        "specs": {
            "bestbuy": gathered.get("bestbuy"),
            "icecat": gathered.get("icecat"),
            "wikipedia": gathered.get("wikipedia"),
        },
        "components": gathered.get("components"),
        "patents": gathered.get("patents"),
        "teardowns": gathered.get("teardowns"),
        "fcc": gathered.get("fcc"),
        "barcode": gathered.get("barcode"),
        "materials": materials_data,
        "meta": {
            "elapsed_ms": elapsed_ms,
            "sources_with_data": sources_with_data,
            "sources_empty": sources_empty,
            "errors": errors,
            "total_sources": len(keys),
        },
    }
