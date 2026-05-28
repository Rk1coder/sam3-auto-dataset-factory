from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.security import verify_api_key
from app.core.config import settings
from app.services.job_runner import get_adapter

router = APIRouter()


class HealthResponse(BaseModel):
    status: str


class ServerInfoResponse(BaseModel):
    status: str
    device: str
    model_loaded: bool
    model_name: str
    max_batch_size: int
    available_memory_gb: Optional[float]
    mock_mode: bool


@router.get("/api/healthz", response_model=HealthResponse)
async def health_check():
    return {"status": "ok"}


@router.get(
    "/api/server-info",
    response_model=ServerInfoResponse,
    dependencies=[Depends(verify_api_key)],
)
async def get_server_info():
    try:
        adapter = get_adapter()
        return {
            "status": "ok",
            "device": settings.device,
            "model_loaded": getattr(adapter, "model_loaded", False),
            "model_name": settings.sam3_model_id,
            "max_batch_size": settings.max_batch_size,
            "available_memory_gb": getattr(adapter, "available_memory_gb", None),
            "mock_mode": settings.use_mock,
        }
    except Exception:
        return {
            "status": "error",
            "device": settings.device,
            "model_loaded": False,
            "model_name": settings.sam3_model_id,
            "max_batch_size": settings.max_batch_size,
            "available_memory_gb": None,
            "mock_mode": settings.use_mock,
        }
