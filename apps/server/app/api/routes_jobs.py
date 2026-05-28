from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from typing import Optional

from app.core.security import verify_api_key
from app.storage.db import db, new_id, now
from app.schemas.job import (
    AutoLabelJobCreate, JobResponse, JobListResponse,
)
from app.services.job_runner import run_auto_label_job

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.get("/api/jobs", response_model=JobListResponse)
async def list_jobs(
    status: Optional[str] = Query(None),
    page: int = 1,
    limit: int = 20,
):
    all_jobs = sorted(db.jobs.values(), key=lambda j: j["created_at"], reverse=True)
    if status:
        all_jobs = [j for j in all_jobs if j["status"] == status]
    start = (page - 1) * limit
    return {"items": all_jobs[start : start + limit], "total": len(all_jobs), "page": page, "limit": limit}


@router.post("/api/jobs/auto-label", response_model=JobResponse, status_code=201)
async def create_auto_label_job(body: AutoLabelJobCreate, background_tasks: BackgroundTasks):
    if body.dataset_id not in db.datasets:
        raise HTTPException(404, "Dataset not found")

    dataset = db.datasets[body.dataset_id]
    dataset_images = [img for img in db.images.values() if img["dataset_id"] == body.dataset_id]

    job_id = new_id()
    job = {
        "id": job_id,
        "dataset_id": body.dataset_id,
        "status": "queued",
        "progress": 0.0,
        "processed_images": 0,
        "total_images": len(dataset_images) or dataset.get("image_count", 0),
        "failed_images": 0,
        "classes": [c.model_dump() for c in body.classes],
        "config": body.config.model_dump(),
        "error_message": None,
        "created_at": now(),
        "started_at": None,
        "completed_at": None,
    }
    db.jobs[job_id] = job

    background_tasks.add_task(run_auto_label_job, job_id)

    return job


@router.get("/api/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    job = db.jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.post("/api/jobs/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(job_id: str):
    job = db.jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] in ("running", "queued"):
        job["status"] = "cancelled"
        job["completed_at"] = now()
    return job


@router.post("/api/jobs/{job_id}/resume", response_model=JobResponse)
async def resume_job(job_id: str):
    job = db.jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] == "paused":
        job["status"] = "queued"
    return job
