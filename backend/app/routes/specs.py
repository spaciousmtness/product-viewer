import asyncio

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.bestbuy import search_product as bestbuy_search
from app.services.icecat import search_product as icecat_search
from app.services.wikipedia import search_product as wiki_search

router = APIRouter()


class SpecsRequest(BaseModel):
    product_name: str
    model_number: str | None = None
    brand: str | None = None


@router.post("/specs/lookup")
async def lookup_specs(body: SpecsRequest):
    """Look up verified product specs from multiple databases.

    Searches Best Buy, ICECAT, and Wikipedia in parallel.
    Best Buy: consumer electronics. ICECAT: instruments, industrial.
    Wikipedia: product history, cultural context, supplemental specs.
    """
    # Run all three databases in parallel
    bestbuy_results, icecat_result, wiki_result = await asyncio.gather(
        _search_bestbuy(body),
        _search_icecat(body),
        _search_wiki(body),
        return_exceptions=True,
    )

    # Collect results from all sources
    results = []

    # ICECAT first (often most detailed for instruments)
    if isinstance(icecat_result, dict):
        results.append(icecat_result)

    # Best Buy (good for consumer electronics)
    if isinstance(bestbuy_results, list):
        results.extend(bestbuy_results)

    # Wikipedia (cultural context, history, supplemental)
    if isinstance(wiki_result, dict):
        results.append(wiki_result)

    return {
        "query": body.product_name,
        "sources": ["bestbuy", "icecat", "wikipedia"],
        "results": results,
        "count": len(results),
    }


async def _search_bestbuy(body: SpecsRequest) -> list[dict]:
    """Multi-strategy Best Buy search."""
    results = await bestbuy_search(body.product_name, limit=3)
    if results:
        return results

    if body.model_number and body.brand:
        results = await bestbuy_search(f"{body.brand} {body.model_number}", limit=3)
        if results:
            return results

    if body.brand:
        results = await bestbuy_search(body.brand, limit=3)
        if results:
            return results

    return []


async def _search_icecat(body: SpecsRequest) -> dict | None:
    """Try ICECAT lookup — needs brand + model for direct lookup."""
    if body.model_number and body.brand:
        result = await icecat_search(body.model_number, brand=body.brand)
        if result:
            return result

    result = await icecat_search(body.product_name, brand=body.brand)
    if result:
        return result

    return None


async def _search_wiki(body: SpecsRequest) -> dict | None:
    """Search Wikipedia for product context."""
    # Use the most specific query available
    if body.brand and body.model_number:
        result = await wiki_search(f"{body.brand} {body.model_number}")
        if result:
            return result

    return await wiki_search(body.product_name)
