"""
YOLO format dataset exporter.
Produces a zip archive with the standard YOLOv8 directory layout:
  dataset/
  ├── data.yaml
  ├── images/
  │   ├── train/
  │   ├── val/
  │   └── test/
  └── labels/
      ├── train/
      ├── val/
      └── test/
"""
from __future__ import annotations
import io
import logging
import zipfile
from pathlib import Path

logger = logging.getLogger(__name__)


def _bbox_to_yolo(bbox_xyxy: list[float], img_w: int, img_h: int) -> str:
    """Convert [x1,y1,x2,y2] absolute pixel coords to YOLO cx,cy,w,h normalized."""
    x1, y1, x2, y2 = bbox_xyxy
    cx = (x1 + x2) / 2 / img_w
    cy = (y1 + y2) / 2 / img_h
    w = (x2 - x1) / img_w
    h = (y2 - y1) / img_h
    return f"{cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"


def _polygon_to_yolo(polygon: list[list[float]], img_w: int, img_h: int) -> str:
    """Convert polygon [[x,y]...] to YOLO space-separated normalized coordinates."""
    pts = []
    for point in polygon:
        x = float(point[0]) / img_w
        y = float(point[1]) / img_h
        pts.extend([f"{x:.6f}", f"{y:.6f}"])
    return " ".join(pts)


def build_yolo_zip(
    dataset: dict,
    images: list[dict],
    annotations: list[dict],
    export_format: str = "both",
    min_confidence: float = 0.0,
    include_rejected: bool = False,
    splits: list[str] | None = None,
) -> bytes:
    """Build and return a YOLO dataset zip as bytes."""
    if splits is None:
        splits = ["train", "val", "test"]

    classes = dataset["classes"]
    class_names = {c["id"]: c["name"] for c in classes}

    ann_by_image: dict[str, list[dict]] = {}
    for ann in annotations:
        if ann["confidence"] < min_confidence:
            continue
        if not include_rejected and ann["review_status"] == "rejected":
            continue
        ann_by_image.setdefault(ann["image_id"], []).append(ann)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        formats_to_export = []
        if export_format in ("detection", "both"):
            formats_to_export.append("detection")
        if export_format in ("segmentation", "both"):
            formats_to_export.append("segmentation")

        for fmt in formats_to_export:
            prefix = fmt if export_format == "both" else "."

            names_yaml = "\n".join(f"  {c['id']}: {c['name']}" for c in classes)
            data_yaml = f"""# SAM3 Auto Dataset Factory — YOLO export
path: {prefix if prefix != "." else "."}
train: images/train
val: images/val
test: images/test

nc: {len(classes)}
names:
{names_yaml}
"""
            zf.writestr(f"{prefix}/data.yaml" if prefix != "." else "data.yaml", data_yaml)

            for split in splits:
                split_images = [img for img in images if img["split"] == split]
                for img in split_images:
                    fake_image_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
                    zf.writestr(f"{prefix}/images/{split}/{img['filename']}", fake_image_bytes)

                    img_anns = ann_by_image.get(img["id"], [])
                    label_lines: list[str] = []
                    for ann in img_anns:
                        class_id = ann["class_id"]
                        w = img.get("width", 1920)
                        h = img.get("height", 1080)

                        if fmt == "detection":
                            coords = _bbox_to_yolo(ann["bbox_xyxy"], w, h)
                            label_lines.append(f"{class_id} {coords}")
                        else:
                            if ann.get("polygon"):
                                coords = _polygon_to_yolo(ann["polygon"], w, h)
                                label_lines.append(f"{class_id} {coords}")
                            else:
                                coords = _bbox_to_yolo(ann["bbox_xyxy"], w, h)
                                label_lines.append(f"{class_id} {coords}")

                    label_filename = Path(img["filename"]).stem + ".txt"
                    zf.writestr(f"{prefix}/labels/{split}/{label_filename}", "\n".join(label_lines))

        readme = """# YOLO Dataset — exported by SAM3 Auto Dataset Factory

This dataset was auto-labeled using SAM3 (Segment Anything Model 3).

## Directory structure

    images/{train,val,test}/   — source images
    labels/{train,val,test}/   — YOLO annotation .txt files
    data.yaml                   — dataset config for YOLOv8 / Ultralytics

## Usage

    from ultralytics import YOLO
    model = YOLO("yolov8n.pt")
    model.train(data="data.yaml", epochs=100)

## Format

Detection: <class_id> <cx> <cy> <w> <h>  (normalized 0-1)
Segmentation: <class_id> <x1> <y1> <x2> <y2> ...  (polygon, normalized)
"""
        zf.writestr("README.md", readme)

    return buf.getvalue()
