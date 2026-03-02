import os
from typing import Optional

import httpx

from app.config import config

TRIPO_API_BASE = "https://api.tripo3d.ai/v2/openapi"

VALID_ANGLES = ("front", "left", "back", "right")


def _find_image(file_id: str) -> str:
    """Locate an uploaded image by file_id prefix. Returns absolute path."""
    for f in os.listdir(config.upload_dir):
        if f.startswith(file_id):
            return os.path.join(config.upload_dir, f)
    raise ValueError(f"Image not found for file_id: {file_id}")


async def _upload_to_tripo(image_path: str) -> str:
    """Upload a single image to Tripo and return its image_token."""
    with open(image_path, "rb") as f:
        image_data = f.read()

    ext = os.path.splitext(image_path)[1].lower()
    media_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }.get(ext, "image/jpeg")

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{TRIPO_API_BASE}/upload",
            headers={"Authorization": f"Bearer {config.tripo_api_key}"},
            files={"file": (f"image{ext}", image_data, media_type)},
        )
        resp.raise_for_status()
        return resp.json()["data"]["image_token"]


def _generation_params() -> dict:
    """Default generation parameters — tuned for blueprint/prototype quality.

    Priority: accurate geometry + correct proportions > photorealistic textures.
    We want a dimensionally useful reference model for prototyping and iteration.
    """
    return {
        "model_version": "v2.5-20250123",
        "texture": True,
        "texture_alignment": "geometry",       # derive textures from geometry, not project raw photos
        "texture_quality": "detailed",         # higher-res texture maps
        "auto_size": True,                     # real-world dimensions (meters)
        "quad": False,                         # keep GLB output (quad → FBX only)
        "pbr": True,                           # PBR materials for correct material appearance
        "orientation": "align_image",
        "face_limit": 80000,                   # higher poly for sharp edges and small features
    }


async def create_task(file_id: str, prompt: str | None = None) -> str:
    """Create a single-image image-to-3D task on Tripo3D. Returns task_id.

    If prompt is provided, it conditions the generation with text describing
    the object (product name, dimensions, materials, form factor).
    """
    image_path = _find_image(file_id)
    file_token = await _upload_to_tripo(image_path)

    payload: dict = {
        "type": "image_to_model",
        "file": {"type": "image", "file_token": file_token},
        **_generation_params(),
    }
    if prompt:
        payload["prompt"] = prompt

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{TRIPO_API_BASE}/task",
            headers={
                "Authorization": f"Bearer {config.tripo_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if not resp.is_success:
            print(f"[tripo] image_to_model error {resp.status_code}: {resp.text}")
            resp.raise_for_status()

    return resp.json()["data"]["task_id"]


async def create_multiview_task(
    file_ids: dict[str, str], prompt: str | None = None
) -> str:
    """Create a multi-view image-to-3D task. file_ids maps angle→file_id.

    Angles: front (required), left, back, right (optional).
    If prompt is provided, it conditions the generation with text.
    Returns task_id.
    """
    if "front" not in file_ids:
        raise ValueError("front image is required for multiview generation")

    # Upload each angle image and collect tokens
    tokens: dict[str, str] = {}
    for angle, fid in file_ids.items():
        if angle not in VALID_ANGLES:
            raise ValueError(f"Invalid angle: {angle}. Must be one of {VALID_ANGLES}")
        image_path = _find_image(fid)
        tokens[angle] = await _upload_to_tripo(image_path)

    # Build files list: one dict per angle in order (front, left, back, right).
    # Empty dict {} for missing angles — matches Tripo SDK convention.
    files_list: list[dict] = []
    for angle in VALID_ANGLES:
        if angle in tokens:
            files_list.append({"type": "jpg", "file_token": tokens[angle]})
        else:
            files_list.append({})

    payload: dict = {
        "type": "multiview_to_model",
        "files": files_list,
        **_generation_params(),
    }
    if prompt:
        payload["prompt"] = prompt

    print(f"[tripo] multiview payload: {len(files_list)} slots, "
          f"angles={[a for a in VALID_ANGLES if a in tokens]}")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{TRIPO_API_BASE}/task",
            headers={
                "Authorization": f"Bearer {config.tripo_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if not resp.is_success:
            body = resp.text
            print(f"[tripo] multiview error {resp.status_code}: {body}")
            resp.raise_for_status()

    return resp.json()["data"]["task_id"]


async def create_text_task(prompt: str) -> str:
    """Create a text-to-3D task on Tripo3D. No image needed. Returns task_id."""
    payload = {
        "type": "text_to_model",
        "prompt": prompt,
        **_generation_params(),
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{TRIPO_API_BASE}/task",
            headers={
                "Authorization": f"Bearer {config.tripo_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()

    return resp.json()["data"]["task_id"]


async def poll_task(task_id: str) -> dict:
    """Poll a Tripo3D task for status. Returns status dict."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{TRIPO_API_BASE}/task/{task_id}",
            headers={"Authorization": f"Bearer {config.tripo_api_key}"},
        )
        resp.raise_for_status()

    data = resp.json()["data"]
    status = data["status"]

    result = {
        "status": status,
        "progress": data.get("progress", 0) / 100 if data.get("progress") else 0,
    }

    if status == "success":
        result["status"] = "succeeded"
        # Get the GLB download URL — check multiple response formats
        output = data.get("output", {})
        model_url = (
            output.get("model")
            or output.get("pbr_model")
            or (data.get("result", {}).get("pbr_model", {}) or {}).get("url")
        )
        if model_url:
            result["modelUrl"] = model_url

    elif status == "failed":
        result["error"] = data.get("message", "Generation failed")

    elif status in ("queued", "running"):
        result["status"] = "queued" if status == "queued" else "processing"

    return result
