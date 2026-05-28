from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Any
from enum import Enum


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"
    paused = "paused"


class JobClass(BaseModel):
    class_id: int
    class_name: str
    prompt: str


class AutoLabelConfig(BaseModel):
    output_mode: str = "bbox_and_segmentation"
    confidence_threshold: float = Field(0.35, ge=0.0, le=1.0)
    min_mask_area: int = Field(80, ge=0)
    max_detections_per_image: int = Field(50, ge=1, le=500)
    polygon_simplification_epsilon: float = 0.002
    save_intermediate_masks: bool = True
    review_required: bool = True


class AutoLabelJobCreate(BaseModel):
    dataset_id: str
    classes: list[JobClass]
    config: AutoLabelConfig = Field(default_factory=AutoLabelConfig)


class JobResponse(BaseModel):
    id: str
    dataset_id: str
    status: JobStatus
    progress: float
    processed_images: int
    total_images: int
    failed_images: int
    classes: list[JobClass]
    config: dict[str, Any]
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
    page: int
    limit: int
