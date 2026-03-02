from fastapi import APIRouter, HTTPException

from app.services.tripo import poll_task

router = APIRouter()


@router.get("/status/{task_id}")
async def get_status(task_id: str):
    """Poll the status of a 3D generation task."""
    try:
        result = await poll_task(task_id)
        return result
    except Exception as e:
        raise HTTPException(500, f"Status check failed: {e}")
