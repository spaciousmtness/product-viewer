from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.tripo import create_task, create_multiview_task, create_text_task

router = APIRouter()


class GenerateRequest(BaseModel):
    file_id: Optional[str] = None
    file_ids: Optional[dict[str, str]] = None  # angle → file_id
    prompt: Optional[str] = None  # text conditioning from recognition
    provider: str = "tripo"


@router.post("/generate")
async def generate_3d(body: GenerateRequest):
    """Initiate image-to-3D generation via Tripo3D.

    Single image: provide file_id.
    Multi-view: provide file_ids dict mapping angle (front/left/back/right) to file_id.
    Optionally include prompt (from recognition) to condition the generation.
    """
    try:
        if body.file_ids and len(body.file_ids) > 1:
            task_id = await create_multiview_task(body.file_ids, prompt=body.prompt)
        elif body.file_id:
            task_id = await create_task(body.file_id, prompt=body.prompt)
        elif body.file_ids and len(body.file_ids) == 1:
            task_id = await create_task(
                list(body.file_ids.values())[0], prompt=body.prompt
            )
        elif body.prompt:
            # Text-to-model: no image, just a description
            task_id = await create_text_task(body.prompt)
        else:
            raise HTTPException(400, "Provide file_id, file_ids, or prompt")
        return {"taskId": task_id}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Generation failed: {e}")
