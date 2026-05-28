"""
Background job runner for auto-labeling jobs.
Runs in a thread pool to avoid blocking the FastAPI event loop.
"""
from __future__ import annotations
import logging
import threading
from pathlib import Path
from PIL import Image as PILImage
from typing import TYPE_CHECKING

from app.storage.db import db, new_id, now
from app.core.config import settings

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_adapter = None
_adapter_lock = threading.Lock()


def get_adapter():
    global _adapter
    if _adapter is not None:
        return _adapter
    with _adapter_lock:
        if _adapter is not None:
            return _adapter
        if settings.use_mock:
            from app.services.mock_adapter import MockAdapter
            _adapter = MockAdapter()
            logger.info("Using mock SAM3 adapter")
        else:
            from app.services.sam3_adapter import SAM3Adapter
            _adapter = SAM3Adapter(
                model_id=settings.sam3_model_id,
                checkpoint_dir=settings.sam3_checkpoint_dir,
                device=settings.device,
                hf_token=settings.hf_token,
            )
            logger.info("Using real SAM3 adapter on %s", settings.device)
        return _adapter


def run_auto_label_job(job_id: str) -> None:
    """Synchronous job runner. Run via asyncio.to_thread from the API."""
    job = db.jobs.get(job_id)
    if not job:
        logger.error("Job %s not found", job_id)
        return

    dataset = db.datasets.get(job["dataset_id"])
    if not dataset:
        job["status"] = "failed"
        job["error_message"] = "Dataset not found"
        return

    class_prompts = [
        {"id": c["class_id"], "name": c["class_name"], "prompt": c["prompt"]}
        for c in job["classes"]
    ]
    config = job["config"]
    confidence_threshold = config.get("confidence_threshold", 0.35)
    max_detections = config.get("max_detections_per_image", 50)

    job["status"] = "running"
    job["started_at"] = now()

    dataset_images = [img for img in db.images.values() if img["dataset_id"] == job["dataset_id"]]
    job["total_images"] = len(dataset_images)

    adapter = get_adapter()
    if not settings.use_mock and hasattr(adapter, "load_model") and not getattr(adapter, "model_loaded", False):
        try:
            adapter.load_model()
        except Exception as exc:
            message = str(exc)
            job["status"] = "failed"
            job["failed_images"] = len(dataset_images)
            job["progress"] = 1.0
            job["completed_at"] = now()
            job["error_message"] = message
            logger.error("Job %s failed before processing images: %s", job_id, message)
            return

    processed = 0
    failed = 0
    last_error = None

    for img_record in dataset_images:
        if db.jobs.get(job_id, {}).get("status") == "cancelled":
            logger.info("Job %s cancelled", job_id)
            return

        try:
            img_path = Path(settings.data_root) / job["dataset_id"] / img_record["filename"]

            if img_path.exists():
                pil_image = PILImage.open(img_path).convert("RGB")
            else:
                pil_image = PILImage.new("RGB", (640, 480))

            detections = adapter.predict(
                image=pil_image,
                class_prompts=class_prompts,
                confidence_threshold=confidence_threshold,
                max_detections=max_detections,
            )

            for det in detections:
                ann_id = new_id()
                db.annotations[ann_id] = {
                    "id": ann_id,
                    "image_id": img_record["id"],
                    "class_id": det.class_id,
                    "class_name": det.class_name,
                    "confidence": det.confidence,
                    "bbox_xyxy": det.bbox_xyxy,
                    "polygon": det.polygon,
                    "mask_area": det.mask_area,
                    "point_count": len(det.polygon) if det.polygon else None,
                    "review_status": "pending",
                    "source": "auto",
                    "created_at": now(),
                }

            img_record["annotation_count"] = len(
                [a for a in db.annotations.values() if a["image_id"] == img_record["id"]]
            )
            processed += 1

        except Exception as exc:
            logger.error("Failed to process image %s: %s", img_record["id"], exc)
            failed += 1
            last_error = str(exc)

        job["processed_images"] = processed
        job["failed_images"] = failed
        job["progress"] = processed / max(job["total_images"], 1)

    job["status"] = "failed" if processed == 0 and failed > 0 else "completed"
    job["progress"] = 1.0
    job["completed_at"] = now()
    if job["status"] == "failed":
        job["error_message"] = last_error or "All images failed to process"
    dataset["annotated_count"] = min(dataset["annotated_count"] + processed, dataset["image_count"])
    logger.info("Job %s completed: %d processed, %d failed", job_id, processed, failed)
