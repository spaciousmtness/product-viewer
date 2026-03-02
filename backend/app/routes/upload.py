import os
import subprocess
import uuid
import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from app.config import config


def _convert_heic_to_jpeg(heic_path: str) -> str:
    """Convert HEIC to JPEG using macOS sips. Returns new jpeg path."""
    jpeg_path = os.path.splitext(heic_path)[0] + ".jpeg"
    subprocess.run(
        ["sips", "-s", "format", "jpeg", heic_path, "--out", jpeg_path],
        capture_output=True, check=True,
    )
    os.remove(heic_path)
    return jpeg_path

router = APIRouter()


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image file. Returns a file_id and image_url."""
    allowed = file.content_type and (
        file.content_type.startswith("image/") or file.content_type == "application/pdf"
    )
    if not allowed:
        raise HTTPException(400, "File must be an image or PDF")

    contents = await file.read()
    if len(contents) > config.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"File exceeds {config.max_upload_mb}MB limit")

    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "image.png")[1] or ".png"
    path = os.path.join(config.upload_dir, f"{file_id}{ext}")

    with open(path, "wb") as f:
        f.write(contents)

    # Convert HEIC to JPEG (Claude API doesn't support HEIC)
    if ext.lower() == ".heic":
        path = _convert_heic_to_jpeg(path)
        ext = ".jpeg"

    return {
        "fileId": file_id,
        "imageUrl": f"/api/v1/uploads/{file_id}{ext}",
    }


class UrlUpload(BaseModel):
    url: str


@router.post("/upload/url")
async def upload_url(body: UrlUpload):
    """Download an image from a URL. Returns a file_id and image_url."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        try:
            resp = await client.get(body.url)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(400, f"Failed to download: {e}")

    content_type = resp.headers.get("content-type", "")
    if "image" not in content_type and not body.url.lower().endswith(
        (".png", ".jpg", ".jpeg", ".webp", ".heic")
    ):
        raise HTTPException(400, "URL does not appear to be an image")

    file_id = str(uuid.uuid4())
    # Determine extension from content-type or URL
    ext = ".jpg"
    if "png" in content_type:
        ext = ".png"
    elif "webp" in content_type:
        ext = ".webp"

    path = os.path.join(config.upload_dir, f"{file_id}{ext}")
    with open(path, "wb") as f:
        f.write(resp.content)

    return {
        "fileId": file_id,
        "imageUrl": f"/api/v1/uploads/{file_id}{ext}",
    }


@router.get("/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve an uploaded file."""
    from fastapi.responses import FileResponse

    path = os.path.join(config.upload_dir, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "File not found")
    return FileResponse(path)
