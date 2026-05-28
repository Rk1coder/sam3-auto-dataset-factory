from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum


class ExportFormat(str, Enum):
    detection = "detection"
    segmentation = "segmentation"
    both = "both"


class ExportCreate(BaseModel):
    dataset_id: str
    format: ExportFormat = ExportFormat.both
    min_confidence: float = Field(0.0, ge=0.0, le=1.0)
    include_rejected: bool = False
    splits: list[str] = ["train", "val", "test"]


class ExportResponse(BaseModel):
    id: str
    dataset_id: str
    format: ExportFormat
    status: str
    download_url: Optional[str]
    file_size_bytes: Optional[int]
    image_count: int
    annotation_count: int
    min_confidence: float
    include_rejected: bool
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}
