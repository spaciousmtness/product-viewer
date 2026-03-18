"""v2 API — Electronic component search via Octopart/Nexar."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.octopart import search_components

router = APIRouter()


class ComponentSearchRequest(BaseModel):
    query: str
    limit: int = 5


@router.post("/components/search")
async def search(body: ComponentSearchRequest):
    """Search electronic components via Octopart.

    Returns MPN, manufacturer, description, specs, pricing,
    datasheet URLs, and stock availability.
    """
    results = await search_components(body.query, limit=body.limit)
    return {
        "query": body.query,
        "source": "octopart",
        "results": results,
        "count": len(results),
    }
