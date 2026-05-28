from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.security import verify_api_key
from app.storage.db import db

router = APIRouter(dependencies=[Depends(verify_api_key)])


class DashboardStats(BaseModel):
    total_datasets: int
    total_images: int
    total_annotations: int
    completed_jobs: int
    pending_review: int
    running_jobs: int
    recent_exports: int
    server_status: str
    model_loaded: bool


@router.get("/api/stats/dashboard", response_model=DashboardStats)
async def get_dashboard_stats():
    from app.services.job_runner import get_adapter
    try:
        adapter = get_adapter()
        model_loaded = getattr(adapter, "model_loaded", False)
    except Exception:
        model_loaded = False

    return {
        "total_datasets": len(db.datasets),
        "total_images": len(db.images),
        "total_annotations": len(db.annotations),
        "completed_jobs": sum(1 for j in db.jobs.values() if j["status"] == "completed"),
        "pending_review": sum(1 for a in db.annotations.values() if a["review_status"] == "pending"),
        "running_jobs": sum(1 for j in db.jobs.values() if j["status"] == "running"),
        "recent_exports": len(db.exports),
        "server_status": "ok",
        "model_loaded": model_loaded,
    }
