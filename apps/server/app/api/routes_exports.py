from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import Response
from typing import Optional

from app.core.security import verify_api_key
from app.storage.db import db, new_id, now
from app.schemas.export import ExportCreate, ExportResponse
from app.services.yolo_exporter import build_yolo_zip

router = APIRouter(dependencies=[Depends(verify_api_key)])

_export_bytes: dict[str, bytes] = {}


@router.post("/api/exports", response_model=ExportResponse, status_code=201)
async def create_export(body: ExportCreate, background_tasks: BackgroundTasks):
    if body.dataset_id not in db.datasets:
        raise HTTPException(404, "Dataset not found")

    dataset_images = [img for img in db.images.values() if img["dataset_id"] == body.dataset_id]
    all_annotations = [ann for ann in db.annotations.values() if any(img["id"] == ann["image_id"] for img in dataset_images)]

    filtered_anns = [
        a for a in all_annotations
        if a["confidence"] >= body.min_confidence
        and (body.include_rejected or a["review_status"] != "rejected")
    ]

    exp_id = new_id()
    exp = {
        "id": exp_id,
        "dataset_id": body.dataset_id,
        "format": body.format,
        "status": "pending",
        "download_url": None,
        "file_size_bytes": None,
        "image_count": len(dataset_images),
        "annotation_count": len(filtered_anns),
        "min_confidence": body.min_confidence,
        "include_rejected": body.include_rejected,
        "created_at": now(),
        "completed_at": None,
    }
    db.exports[exp_id] = exp

    async def _build():
        try:
            exp["status"] = "running"
            dataset = db.datasets[body.dataset_id]
            zip_bytes = build_yolo_zip(
                dataset=dataset,
                images=dataset_images,
                annotations=all_annotations,
                export_format=str(body.format),
                min_confidence=body.min_confidence,
                include_rejected=body.include_rejected,
                splits=list(body.splits),
            )
            _export_bytes[exp_id] = zip_bytes
            exp["status"] = "completed"
            exp["completed_at"] = now()
            exp["download_url"] = f"/api/exports/{exp_id}/download"
            exp["file_size_bytes"] = len(zip_bytes)
        except Exception as e:
            exp["status"] = "failed"
            exp["error_message"] = str(e)

    background_tasks.add_task(_build)
    return exp


@router.get("/api/exports", response_model=list[ExportResponse])
async def list_exports(datasetId: Optional[str] = Query(None)):
    exps = sorted(db.exports.values(), key=lambda e: e["created_at"], reverse=True)
    if datasetId:
        exps = [e for e in exps if e["dataset_id"] == datasetId]
    return exps


@router.get("/api/exports/{export_id}", response_model=ExportResponse)
async def get_export(export_id: str):
    exp = db.exports.get(export_id)
    if not exp:
        raise HTTPException(404, "Export not found")
    return exp


@router.get("/api/exports/{export_id}/download")
async def download_export(export_id: str):
    exp = db.exports.get(export_id)
    if not exp or exp["status"] != "completed":
        raise HTTPException(404, "Export not ready")
    zip_bytes = _export_bytes.get(export_id)
    if not zip_bytes:
        raise HTTPException(404, "Export file not found")
    dataset = db.datasets.get(exp["dataset_id"], {})
    filename = f"{dataset.get('name', 'dataset').replace(' ', '_')}_yolo.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
