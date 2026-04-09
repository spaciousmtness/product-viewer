"""v2 API — Barcode/UPC product lookup."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.barcode import lookup_barcode

router = APIRouter()


class BarcodeLookupRequest(BaseModel):
    upc: str


@router.post("/barcode/lookup")
async def lookup(body: BarcodeLookupRequest):
    """Look up a product by UPC/EAN barcode.

    Returns product_name, brand, category, description,
    images, and offers.
    """
    result = await lookup_barcode(body.upc)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No product found for barcode: {body.upc}",
        )
    return result
