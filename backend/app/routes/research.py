from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.vision import research_product, research_with_manual

router = APIRouter()


class ResearchRequest(BaseModel):
    product_name: str
    manual_file_id: str | None = None  # optional PDF/image of manual


@router.post("/research")
async def research(body: ResearchRequest):
    """Research a product by name, optionally enriched with a manual/datasheet.

    Use this when the user knows the product name but doesn't have a photo,
    or when the product is too obscure for image recognition.
    """
    try:
        if body.manual_file_id:
            result = await research_with_manual(body.product_name, body.manual_file_id)
        else:
            result = await research_product(body.product_name)
        return result
    except Exception as e:
        raise HTTPException(500, f"Research failed: {e}")
