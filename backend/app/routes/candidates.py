from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.vision import recognize_candidates, research_candidates, confirm_product

router = APIRouter()


class CandidatesRequest(BaseModel):
    file_id: str


class ResearchCandidatesRequest(BaseModel):
    product_name: str


class ConfirmRequest(BaseModel):
    product_name: str
    brand: str | None = None
    file_id: str | None = None


@router.post("/recognize/candidates")
async def get_candidates(body: CandidatesRequest):
    """Return top 3 candidate identifications for an image."""
    try:
        result = await recognize_candidates(body.file_id)
        return result
    except Exception as e:
        raise HTTPException(500, f"Candidate recognition failed: {e}")


@router.post("/research/candidates")
async def get_research_candidates(body: ResearchCandidatesRequest):
    """Return top 3 candidate interpretations for a product name."""
    try:
        result = await research_candidates(body.product_name)
        return result
    except Exception as e:
        raise HTTPException(500, f"Candidate research failed: {e}")


@router.post("/recognize/confirm")
async def confirm_recognition(body: ConfirmRequest):
    """Generate full dossier for a confirmed product identity."""
    try:
        result = await confirm_product(body.product_name, body.brand, body.file_id)
        return result
    except Exception as e:
        raise HTTPException(500, f"Confirmation failed: {e}")
