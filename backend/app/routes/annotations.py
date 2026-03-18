"""v2 API — Product annotation CRUD."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.annotations import (
    save_annotation,
    get_annotations,
    update_annotation,
    delete_annotation,
)

router = APIRouter()


class AnnotationCreate(BaseModel):
    type: str = "note"
    x: float = 0.0
    y: float = 0.0
    text: str = ""
    value: str = ""
    confidence: str = "manual"


class AnnotationUpdate(BaseModel):
    type: str | None = None
    x: float | None = None
    y: float | None = None
    text: str | None = None
    value: str | None = None
    confidence: str | None = None


@router.post("/annotations/{slug}")
async def create(slug: str, body: AnnotationCreate):
    """Create a new annotation for a product."""
    result = await save_annotation(slug, body.model_dump())
    return result


@router.get("/annotations/{slug}")
async def list_annotations(slug: str):
    """List all annotations for a product."""
    annotations = await get_annotations(slug)
    return {"slug": slug, "annotations": annotations, "count": len(annotations)}


@router.patch("/annotations/{slug}/{annotation_id}")
async def update(slug: str, annotation_id: str, body: AnnotationUpdate):
    """Update an existing annotation."""
    data = body.model_dump(exclude_none=True)
    result = await update_annotation(annotation_id, slug, data)
    if result is None:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return result


@router.delete("/annotations/{slug}/{annotation_id}")
async def delete(slug: str, annotation_id: str):
    """Delete an annotation."""
    deleted = await delete_annotation(annotation_id, slug)
    if not deleted:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return {"deleted": True, "annotation_id": annotation_id}
