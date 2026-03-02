"""
Product Viewer — Image-to-3D pipeline backend.
Thin API proxy: holds API keys, relays to Tripo3D + Claude Vision.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import config
from app.routes import upload, recognize, generate, status, catalog, specs, research, candidates, web_research


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(config.upload_dir, exist_ok=True)
    os.makedirs(config.catalog_dir, exist_ok=True)
    yield


app = FastAPI(
    title="Product Viewer",
    description="Image-to-3D pipeline — upload, recognize, generate",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/v1", tags=["upload"])
app.include_router(recognize.router, prefix="/api/v1", tags=["recognize"])
app.include_router(generate.router, prefix="/api/v1", tags=["generate"])
app.include_router(status.router, prefix="/api/v1", tags=["status"])
app.include_router(catalog.router, prefix="/api/v1", tags=["catalog"])
app.include_router(specs.router, prefix="/api/v1", tags=["specs"])
app.include_router(research.router, prefix="/api/v1", tags=["research"])
app.include_router(candidates.router, prefix="/api/v1", tags=["candidates"])
app.include_router(web_research.router, prefix="/api/v1", tags=["web_research"])


@app.get("/health")
def health():
    return {"service": "product-viewer", "status": "ok"}
