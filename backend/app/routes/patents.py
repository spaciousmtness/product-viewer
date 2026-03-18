"""v2 API — USPTO patent search."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.patents import search_patents

router = APIRouter()


class PatentSearchRequest(BaseModel):
    query: str
    limit: int = 5


@router.post("/patents/search")
async def search(body: PatentSearchRequest):
    """Search USPTO patents.

    Returns patent_number, title, abstract, inventors, assignee,
    filing_date, patent_type, and thumbnail URL.
    """
    results = await search_patents(body.query, limit=body.limit)
    return {
        "query": body.query,
        "source": "uspto",
        "results": results,
        "count": len(results),
    }
