"""v2 API — iFixit teardown search and retrieval."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.teardown import search_teardowns, get_teardown

router = APIRouter()


class TeardownSearchRequest(BaseModel):
    query: str
    limit: int = 5


@router.post("/teardowns/search")
async def search(body: TeardownSearchRequest):
    """Search iFixit for product teardowns.

    Returns title, device_name, difficulty, step count,
    tools_required, and URL.
    """
    results = await search_teardowns(body.query, limit=body.limit)
    return {
        "query": body.query,
        "source": "ifixit",
        "results": results,
        "count": len(results),
    }


@router.get("/teardowns/{guide_id}")
async def get(guide_id: int):
    """Get a full teardown guide with all steps and images."""
    result = await get_teardown(guide_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Teardown guide not found")
    return result
