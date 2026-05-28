from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from typing import Optional
from pathlib import Path
import aiofiles

from app.core.security import verify_api_key
from app.core.config import settings
from app.storage.db import db, new_id, now
from app.schemas.dataset import (
    DatasetCreate, DatasetResponse, DatasetListResponse,
    ImageResponse, ImageListResponse, UploadResponse,
)

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.get("/api/datasets", response_model=DatasetListResponse)
async def list_datasets(page: int = 1, limit: int = 20):
    all_ds = sorted(db.datasets.values(), key=lambda d: d["created_at"], reverse=True)
    start = (page - 1) * limit
    items = all_ds[start : start + limit]
    return {"items": items, "total": len(all_ds), "page": page, "limit": limit}


@router.post("/api/datasets", response_model=DatasetResponse, status_code=201)
async def create_dataset(body: DatasetCreate):
    now_ts = now()
    ds = {
        "id": new_id(),
        "name": body.name,
        "description": body.description,
        "classes": [c.model_dump() for c in body.classes],
        "image_count": 0,
        "annotated_count": 0,
        "train_split": body.train_split,
        "val_split": body.val_split,
        "test_split": body.test_split,
        "output_mode": body.output_mode,
        "prompt_type": body.prompt_type,
        "created_at": now_ts,
        "updated_at": now_ts,
    }
    db.datasets[ds["id"]] = ds
    ds_dir = Path(settings.data_root) / ds["id"]
    ds_dir.mkdir(parents=True, exist_ok=True)
    return ds


@router.get("/api/datasets/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(dataset_id: str):
    ds = db.datasets.get(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return ds


@router.delete("/api/datasets/{dataset_id}", status_code=204)
async def delete_dataset(dataset_id: str):
    if dataset_id not in db.datasets:
        raise HTTPException(404, "Dataset not found")
    del db.datasets[dataset_id]


@router.get("/api/datasets/{dataset_id}/images", response_model=ImageListResponse)
async def list_dataset_images(
    dataset_id: str,
    split: Optional[str] = Query("all"),
    page: int = 1,
    limit: int = 50,
):
    if dataset_id not in db.datasets:
        raise HTTPException(404, "Dataset not found")
    imgs = [img for img in db.images.values() if img["dataset_id"] == dataset_id]
    if split and split != "all":
        imgs = [img for img in imgs if img["split"] == split]
    start = (page - 1) * limit
    return {"items": imgs[start : start + limit], "total": len(imgs), "page": page, "limit": limit}


@router.post("/api/datasets/{dataset_id}/upload", response_model=UploadResponse)
async def upload_images(dataset_id: str, files: list[UploadFile] = File(...)):
    ds = db.datasets.get(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")

    splits = ["train", "val", "test"]
    uploaded = 0
    errors: list[str] = []

    for i, file in enumerate(files):
        if not file.content_type or not file.content_type.startswith("image/"):
            errors.append(f"{file.filename}: not an image")
            continue

        save_dir = Path(settings.data_root) / dataset_id
        save_dir.mkdir(parents=True, exist_ok=True)
        save_path = save_dir / (file.filename or f"image_{new_id()}.jpg")

        try:
            content = await file.read()
            async with aiofiles.open(save_path, "wb") as f:
                await f.write(content)

            from PIL import Image as PILImage
            with PILImage.open(save_path) as pil_img:
                width, height = pil_img.size

            img_id = new_id()
            db.images[img_id] = {
                "id": img_id,
                "dataset_id": dataset_id,
                "filename": save_path.name,
                "width": width,
                "height": height,
                "split": splits[i % 3],
                "annotation_count": 0,
                "review_status": "pending",
                "url": f"/api/datasets/{dataset_id}/images/{img_id}/file",
                "created_at": now(),
            }
            uploaded += 1
        except Exception as exc:
            errors.append(f"{file.filename}: {exc}")

    ds["image_count"] += uploaded
    ds["updated_at"] = now()

    return {"uploaded": uploaded, "failed": len(errors), "errors": errors}


@router.get("/api/datasets/{dataset_id}/images/{image_id}/file")
async def serve_image(dataset_id: str, image_id: str):
    from fastapi.responses import FileResponse
    img = db.images.get(image_id)
    if not img or img["dataset_id"] != dataset_id:
        raise HTTPException(404, "Image not found")
    path = Path(settings.data_root) / dataset_id / img["filename"]
    if not path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(path)
