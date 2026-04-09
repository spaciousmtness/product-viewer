"""Annotation storage service.

Stores product annotations as JSON files in the catalog directory.
Each product slug gets its own annotations.json file.
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone

from app.config import config

logger = logging.getLogger(__name__)

VALID_TYPES = {"dimension", "note", "callout", "material", "tolerance"}
VALID_CONFIDENCES = {"verified", "estimated", "manual"}


def _annotations_path(product_slug: str) -> str:
    """Get the path to the annotations JSON file for a product."""
    return os.path.join(config.catalog_dir, product_slug, "annotations.json")


def _load_annotations(product_slug: str) -> list[dict]:
    """Load annotations from disk."""
    path = _annotations_path(product_slug)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to load annotations for %s: %s", product_slug, exc)
        return []


def _save_annotations(product_slug: str, annotations: list[dict]) -> None:
    """Persist annotations to disk."""
    path = _annotations_path(product_slug)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(annotations, f, indent=2)


async def save_annotation(product_slug: str, annotation: dict) -> dict:
    """Create a new annotation for a product.

    The annotation dict should contain type, x, y, text, and optionally
    value and confidence fields.
    Returns the saved annotation with generated id and timestamps.
    """
    now = datetime.now(timezone.utc).isoformat()

    record = {
        "id": str(uuid.uuid4()),
        "type": annotation.get("type", "note"),
        "x": annotation.get("x", 0.0),
        "y": annotation.get("y", 0.0),
        "text": annotation.get("text", ""),
        "value": annotation.get("value", ""),
        "confidence": annotation.get("confidence", "manual"),
        "created_at": now,
        "updated_at": now,
    }

    annotations = _load_annotations(product_slug)
    annotations.append(record)
    _save_annotations(product_slug, annotations)

    return record


async def get_annotations(product_slug: str) -> list[dict]:
    """Get all annotations for a product."""
    return _load_annotations(product_slug)


async def update_annotation(annotation_id: str, product_slug: str, data: dict) -> dict | None:
    """Update an existing annotation by ID.

    Returns the updated annotation or None if not found.
    """
    annotations = _load_annotations(product_slug)

    for ann in annotations:
        if ann.get("id") == annotation_id:
            # Update allowed fields
            for field in ("type", "x", "y", "text", "value", "confidence"):
                if field in data:
                    ann[field] = data[field]
            ann["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save_annotations(product_slug, annotations)
            return ann

    return None


async def delete_annotation(annotation_id: str, product_slug: str) -> bool:
    """Delete an annotation by ID.

    Returns True if the annotation was found and deleted.
    """
    annotations = _load_annotations(product_slug)
    original_len = len(annotations)
    annotations = [a for a in annotations if a.get("id") != annotation_id]

    if len(annotations) < original_len:
        _save_annotations(product_slug, annotations)
        return True

    return False
