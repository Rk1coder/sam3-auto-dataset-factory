from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from typing import Optional

from app.core.security import verify_api_key
from app.storage.db import db, new_id, now
from app.schemas.annotation import (
    AnnotationCreate, AnnotationUpdate, AnnotationResponse, ReprocessRequest,
)

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.get("/api/images/{image_id}/annotations", response_model=list[AnnotationResponse])
async def list_annotations(
    image_id: str,
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
):
    return [
        a for a in db.annotations.values()
        if a["image_id"] == image_id and a["confidence"] >= min_confidence
    ]


@router.post("/api/images/{image_id}/annotations", response_model=AnnotationResponse, status_code=201)
async def create_annotation(image_id: str, body: AnnotationCreate):
    if image_id not in db.images:
        raise HTTPException(404, "Image not found")
    ann_id = new_id()
    ann = {
        "id": ann_id,
        "image_id": image_id,
        "class_id": body.class_id,
        "class_name": body.class_name,
        "confidence": body.confidence,
        "bbox_xyxy": body.bbox_xyxy,
        "polygon": body.polygon,
        "mask_area": body.mask_area,
        "point_count": len(body.polygon) if body.polygon else None,
        "review_status": "accepted",
        "source": "manual",
        "created_at": now(),
    }
    db.annotations[ann_id] = ann
    img = db.images.get(image_id)
    if img:
        img["annotation_count"] = sum(1 for a in db.annotations.values() if a["image_id"] == image_id)
    return ann


@router.put("/api/annotations/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(annotation_id: str, body: AnnotationUpdate):
    ann = db.annotations.get(annotation_id)
    if not ann:
        raise HTTPException(404, "Annotation not found")
    for field, value in body.model_dump(exclude_none=True).items():
        ann[field] = value
    return ann


@router.delete("/api/annotations/{annotation_id}", status_code=204)
async def delete_annotation(annotation_id: str):
    if annotation_id not in db.annotations:
        raise HTTPException(404, "Annotation not found")
    ann = db.annotations[annotation_id]
    img = db.images.get(ann["image_id"])
    del db.annotations[annotation_id]
    if img:
        img["annotation_count"] = sum(1 for a in db.annotations.values() if a["image_id"] == img["id"])


@router.post("/api/images/{image_id}/reprocess")
async def reprocess_image(image_id: str, body: ReprocessRequest, background_tasks: BackgroundTasks):
    img = db.images.get(image_id)
    if not img:
        raise HTTPException(404, "Image not found")

    to_delete = [a["id"] for a in db.annotations.values() if a["image_id"] == image_id and a["source"] == "auto"]
    for ann_id in to_delete:
        del db.annotations[ann_id]

    async def _reprocess():
        from app.services.job_runner import get_adapter
        from PIL import Image as PILImage
        from pathlib import Path

        adapter = get_adapter()
        class_prompts = [{"id": c["class_id"], "name": c["class_name"], "prompt": c["prompt"]} for c in body.classes]

        img_path = Path("data") / img["dataset_id"] / img["filename"]
        pil_image = PILImage.open(img_path).convert("RGB") if img_path.exists() else PILImage.new("RGB", (640, 480))

        detections = adapter.predict(pil_image, class_prompts, body.confidence_threshold)
        for det in detections:
            ann_id = new_id()
            db.annotations[ann_id] = {
                "id": ann_id, "image_id": image_id, "class_id": det.class_id, "class_name": det.class_name,
                "confidence": det.confidence, "bbox_xyxy": det.bbox_xyxy, "polygon": det.polygon,
                "mask_area": det.mask_area, "point_count": len(det.polygon) if det.polygon else None,
                "review_status": "pending", "source": "auto", "created_at": now(),
            }
        img["annotation_count"] = sum(1 for a in db.annotations.values() if a["image_id"] == image_id)

    background_tasks.add_task(_reprocess)

    return {"image_id": image_id, "status": "reprocessing", "annotation_count": img["annotation_count"]}
