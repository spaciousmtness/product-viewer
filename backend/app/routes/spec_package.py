"""v2 API — Manufacturing spec package PDF generation."""

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

from app.services.spec_package import generate_spec_package

router = APIRouter()


class SpecPackageRequest(BaseModel):
    product_name: str
    brand: str | None = None
    model_number: str | None = None
    category: str | None = None
    description: str | None = None
    dimensions: dict | None = None
    weight: str | None = None
    materials: list | None = None
    features: list | None = None
    specs: dict | None = None
    technical_specs: dict | None = None
    components: list | None = None
    manufacturing: dict | None = None
    surface_finish: list | str | None = None
    assembly_notes: list | str | None = None
    colorway: str | None = None
    color: str | None = None
    regulatory: dict | None = None
    fcc: list | None = None
    teardowns: list | None = None
    sources: list | None = None


@router.post("/spec-package/generate")
async def generate(body: SpecPackageRequest):
    """Generate a manufacturing specification PDF.

    Accepts combined product data from recognition, specs, manufacturing,
    and component analysis. Returns a downloadable PDF file.
    """
    product_data = body.model_dump(exclude_none=True)
    pdf_bytes = await generate_spec_package(product_data)

    # Build a clean filename
    slug = body.product_name.lower().replace(" ", "-")[:40]
    filename = f"spec-package-{slug}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
