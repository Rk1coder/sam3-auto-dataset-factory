from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum


class OutputMode(str, Enum):
    bbox_only = "bbox_only"
    segmentation_only = "segmentation_only"
    bbox_and_segmentation = "bbox_and_segmentation"


class PromptType(str, Enum):
    text = "text"
    bbox = "bbox"
    point = "point"


class ClassDefinition(BaseModel):
    id: int
    name: str
    prompt: str
    color: Optional[str] = None


class DatasetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    classes: list[ClassDefinition] = Field(..., min_length=1)
    train_split: float = Field(0.8, ge=0.0, le=1.0)
    val_split: float = Field(0.1, ge=0.0, le=1.0)
    test_split: float = Field(0.1, ge=0.0, le=1.0)
    output_mode: OutputMode = OutputMode.bbox_and_segmentation
    prompt_type: PromptType = PromptType.text


class DatasetResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    classes: list[ClassDefinition]
    image_count: int
    annotated_count: int
    train_split: float
    val_split: float
    test_split: float
    output_mode: OutputMode
    prompt_type: PromptType
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DatasetListResponse(BaseModel):
    items: list[DatasetResponse]
    total: int
    page: int
    limit: int


class ImageSplit(str, Enum):
    train = "train"
    val = "val"
    test = "test"
    all = "all"


class ImageResponse(BaseModel):
    id: str
    dataset_id: str
    filename: str
    width: int
    height: int
    split: str
    annotation_count: int
    review_status: str
    url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ImageListResponse(BaseModel):
    items: list[ImageResponse]
    total: int
    page: int
    limit: int


class UploadResponse(BaseModel):
    uploaded: int
    failed: int
    errors: list[str] = []
