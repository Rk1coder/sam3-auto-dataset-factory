from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum


class ReviewStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class AnnotationSource(str, Enum):
    auto = "auto"
    manual = "manual"


class AnnotationCreate(BaseModel):
    class_id: int
    class_name: str
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    bbox_xyxy: list[float] = Field(..., min_length=4, max_length=4)
    polygon: Optional[list[list[float]]] = None
    mask_area: Optional[float] = None


class AnnotationUpdate(BaseModel):
    class_id: Optional[int] = None
    class_name: Optional[str] = None
    review_status: Optional[ReviewStatus] = None
    bbox_xyxy: Optional[list[float]] = None
    polygon: Optional[list[list[float]]] = None


class AnnotationResponse(BaseModel):
    id: str
    image_id: str
    class_id: int
    class_name: str
    confidence: float
    bbox_xyxy: list[float]
    polygon: Optional[list[list[float]]]
    mask_area: Optional[float]
    point_count: Optional[int]
    review_status: ReviewStatus
    source: AnnotationSource
    created_at: datetime

    model_config = {"from_attributes": True}


class ReprocessRequest(BaseModel):
    classes: list[dict]
    confidence_threshold: float = Field(0.35, ge=0.0, le=1.0)
