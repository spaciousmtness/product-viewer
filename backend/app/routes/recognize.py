from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.vision import recognize_product

router = APIRouter()


class RecognizeRequest(BaseModel):
    file_id: str


@router.post("/recognize")
async def recognize(body: RecognizeRequest):
    """Identify the product in an uploaded image using Claude Vision."""
    try:
        result = await recognize_product(body.file_id)
        return result
    except Exception as e:
        raise HTTPException(500, f"Recognition failed: {e}")
