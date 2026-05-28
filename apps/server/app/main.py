"""
SAM3 Auto Dataset Factory — FastAPI GPU inference server.

Modes:
  USE_MOCK=true   → mock adapter (no GPU, random annotations)
  USE_MOCK=false  → real SAM3 (requires torch + transformers + GPU)

Run:
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import logger
from app.api.routes_health import router as health_router
from app.api.routes_datasets import router as datasets_router
from app.api.routes_jobs import router as jobs_router
from app.api.routes_annotations import router as annotations_router
from app.api.routes_exports import router as exports_router
from app.api.routes_stats import router as stats_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    for d in [settings.data_root, settings.export_root, settings.sam3_checkpoint_dir]:
        Path(d).mkdir(parents=True, exist_ok=True)

    logger.info("SAM3 Auto Dataset Factory starting (mock=%s, device=%s)", settings.use_mock, settings.device)

    if not settings.use_mock:
        try:
            from app.services.job_runner import get_adapter
            get_adapter()
        except Exception as exc:
            logger.warning("Could not pre-load SAM3 model: %s", exc)

    yield

    logger.info("Shutting down")


app = FastAPI(
    title="SAM3 Auto Dataset Factory",
    description="GPU-accelerated auto-labeling server using SAM3 (Segment Anything Model 3)",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(datasets_router)
app.include_router(jobs_router)
app.include_router(annotations_router)
app.include_router(exports_router)
app.include_router(stats_router)
