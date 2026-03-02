import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import config
from app.services.catalog import save_product_record, list_catalog, get_record

router = APIRouter()


class SaveRequest(BaseModel):
    recognition: dict
    db_specs: Optional[dict] = None
    file_ids: list[str]
    model_url: Optional[str] = None
    generation_method: str = "image_to_model"


@router.post("/catalog/save")
async def save_to_catalog(body: SaveRequest):
    """Save current product record to the catalog."""
    try:
        manifest = await save_product_record(
            recognition=body.recognition,
            db_specs=body.db_specs,
            file_ids=body.file_ids,
            model_url=body.model_url,
            generation_method=body.generation_method,
        )
        return {"slug": manifest["slug"], "manifest": manifest}
    except Exception as e:
        raise HTTPException(500, f"Failed to save: {e}")


@router.get("/catalog")
async def list_products():
    """List all products in the catalog."""
    return {"products": list_catalog()}


@router.get("/catalog/{slug}")
async def get_product(slug: str):
    """Get full manifest for a catalog record."""
    record = get_record(slug)
    if not record:
        raise HTTPException(404, "Product not found in catalog")
    return record


@router.get("/catalog/{slug}/models/{filename}")
async def serve_model(slug: str, filename: str):
    """Serve a model file from the catalog."""
    path = os.path.join(config.catalog_dir, slug, "models", filename)
    if not os.path.isfile(path):
        raise HTTPException(404, "Model file not found")
    return FileResponse(path)


@router.get("/catalog/{slug}/photos/{filename}")
async def serve_photo(slug: str, filename: str):
    """Serve a photo from the catalog."""
    path = os.path.join(config.catalog_dir, slug, "photos", filename)
    if not os.path.isfile(path):
        raise HTTPException(404, "Photo not found")
    return FileResponse(path)
