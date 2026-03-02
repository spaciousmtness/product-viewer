"""Product catalog — saves product records for sharing and reuse.

Each product record is a directory with:
  manifest.json   — identity, specs, provenance
  photos/         — original uploaded images
  models/         — GLB and STL files
"""

import json
import os
import re
import shutil
from datetime import datetime, timezone

import httpx

from app.config import config


def slugify(text: str) -> str:
    """Turn a product name into a filesystem-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text[:80].strip("-")


def _catalog_path(slug: str) -> str:
    return os.path.join(config.catalog_dir, slug)


async def save_product_record(
    recognition: dict,
    db_specs: dict | None,
    file_ids: list[str],
    model_url: str | None,
    generation_method: str = "image_to_model",
) -> dict:
    """Save a complete product record to the catalog.

    Returns the manifest dict with the catalog path.
    """
    os.makedirs(config.catalog_dir, exist_ok=True)

    # Build slug from product name
    product_name = recognition.get("productName", "unknown-product")
    base_slug = slugify(product_name)

    # Add model number if available for uniqueness
    model_num = recognition.get("modelNumber")
    if model_num:
        base_slug = f"{base_slug}-{slugify(model_num)}"

    # Ensure uniqueness
    slug = base_slug
    counter = 1
    while os.path.exists(_catalog_path(slug)):
        slug = f"{base_slug}-{counter}"
        counter += 1

    record_dir = _catalog_path(slug)
    photos_dir = os.path.join(record_dir, "photos")
    models_dir = os.path.join(record_dir, "models")
    os.makedirs(photos_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    # Copy source photos
    photo_files = []
    for file_id in file_ids:
        for f in os.listdir(config.upload_dir):
            if f.startswith(file_id):
                src = os.path.join(config.upload_dir, f)
                dst = os.path.join(photos_dir, f)
                shutil.copy2(src, dst)
                photo_files.append(f)
                break

    # Download model GLB if we have a URL
    model_files = []
    if model_url:
        glb_path = os.path.join(models_dir, "model.glb")
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.get(model_url)
                resp.raise_for_status()
                with open(glb_path, "wb") as f:
                    f.write(resp.content)
                model_files.append("model.glb")
        except httpx.HTTPError:
            pass  # Model download failed, continue without it

    # Build manifest
    manifest = {
        "version": "1.0",
        "slug": slug,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "visual": {
            "condition": recognition.get("condition"),
            "colorway": recognition.get("colorway"),
            "formFactor": recognition.get("formFactor"),
        },
        "identity": {
            "productName": recognition.get("productName"),
            "brand": recognition.get("brand"),
            "category": recognition.get("category"),
            "modelNumber": recognition.get("modelNumber"),
            "yearRange": recognition.get("yearRange"),
            "releaseYear": recognition.get("releaseYear"),
            "msrpAtRelease": recognition.get("msrpAtRelease"),
            "manufacturingOrigin": recognition.get("manufacturingOrigin"),
            "culturalNote": recognition.get("culturalNote"),
            "materials": recognition.get("materials"),
            "features": recognition.get("features"),
        },
        "dimensions": {},
        "model": {
            "files": model_files,
            "sourceImages": photo_files,
            "generationMethod": generation_method,
            "modelUrl": model_url,
        },
        "provenance": {
            "recognitionSource": "claude-sonnet-4",
            "generationSource": "tripo3d-v2",
        },
    }

    # Merge dimensions from recognition
    if recognition.get("dimensions"):
        manifest["dimensions"]["fromRecognition"] = recognition["dimensions"]
    if recognition.get("weight"):
        manifest["dimensions"]["weightFromRecognition"] = recognition["weight"]

    # Merge verified specs from product database
    if db_specs:
        manifest["provenance"]["specSource"] = db_specs.get("source", "bestbuy")
        manifest["dbSpecs"] = db_specs
        # Prefer DB dimensions over recognition guesses
        if db_specs.get("dimensions"):
            manifest["dimensions"]["verified"] = db_specs["dimensions"]

    # Write manifest
    manifest_path = os.path.join(record_dir, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    return manifest


def list_catalog() -> list[dict]:
    """List all product records in the catalog. Returns summary for each."""
    if not os.path.exists(config.catalog_dir):
        return []

    records = []
    for slug in sorted(os.listdir(config.catalog_dir)):
        manifest_path = os.path.join(config.catalog_dir, slug, "manifest.json")
        if not os.path.isfile(manifest_path):
            continue
        with open(manifest_path) as f:
            manifest = json.load(f)
        records.append({
            "slug": slug,
            "productName": manifest.get("identity", {}).get("productName"),
            "brand": manifest.get("identity", {}).get("brand"),
            "category": manifest.get("identity", {}).get("category"),
            "createdAt": manifest.get("createdAt"),
            "hasModel": len(manifest.get("model", {}).get("files", [])) > 0,
            "hasVerifiedSpecs": "dbSpecs" in manifest,
        })

    return records


def get_record(slug: str) -> dict | None:
    """Get full manifest for a catalog record."""
    manifest_path = os.path.join(config.catalog_dir, slug, "manifest.json")
    if not os.path.isfile(manifest_path):
        return None
    with open(manifest_path) as f:
        return json.load(f)
