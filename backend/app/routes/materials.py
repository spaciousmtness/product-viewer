"""v2 API — Materials properties lookup."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.materials import lookup_material

router = APIRouter()


class MaterialLookupRequest(BaseModel):
    material_name: str


@router.post("/materials/lookup")
async def lookup(body: MaterialLookupRequest):
    """Look up material properties by name.

    Returns material_type, grade, density, tensile_strength,
    thermal_properties, common_applications, and typical uses.
    """
    result = await lookup_material(body.material_name)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Material not found: {body.material_name}",
        )
    return result
