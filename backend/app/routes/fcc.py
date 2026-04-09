"""v2 API — FCC filing data search."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.fcc import search_fcc

router = APIRouter()


class FCCSearchRequest(BaseModel):
    query: str
    limit: int = 5


@router.post("/fcc/search")
async def search(body: FCCSearchRequest):
    """Search FCC EAS database for device filings.

    Returns fcc_id, applicant, product_description, grant_date,
    equipment_class, and test report availability.
    """
    results = await search_fcc(body.query, limit=body.limit)
    return {
        "query": body.query,
        "source": "fcc",
        "results": results,
        "count": len(results),
    }
