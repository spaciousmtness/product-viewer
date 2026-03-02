"""Routes for web image research — collect reference images for a confirmed product."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.web_research import collect_reference_images

router = APIRouter()


class ResearchImagesRequest(BaseModel):
    product_name: str
    brand: Optional[str] = None


@router.post("/research/images")
async def research_images(body: ResearchImagesRequest):
    """Search the web for reference images of a confirmed product.

    Returns classified images with angle assignments for multiview generation.
    """
    try:
        result = await collect_reference_images(
            product_name=body.product_name,
            brand=body.brand,
        )
        return result
    except Exception as e:
        raise HTTPException(500, f"Image research failed: {e}")
