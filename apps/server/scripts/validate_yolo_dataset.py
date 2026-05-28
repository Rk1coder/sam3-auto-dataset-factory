"""
Validate a YOLO-format dataset directory.
Checks that every image has a corresponding label file and vice versa.

Usage:
  python scripts/validate_yolo_dataset.py --dataset /path/to/yolo/dataset
"""
import argparse
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def validate(dataset_dir: Path) -> bool:
    ok = True
    for split in ("train", "val", "test"):
        img_dir = dataset_dir / "images" / split
        lbl_dir = dataset_dir / "labels" / split

        if not img_dir.exists():
            logger.warning("Missing images/%s directory", split)
            continue

        images = {p.stem for p in img_dir.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp"}}
        labels = {p.stem for p in lbl_dir.iterdir() if p.suffix == ".txt"} if lbl_dir.exists() else set()

        orphan_imgs = images - labels
        orphan_lbls = labels - images

        logger.info("[%s] %d images, %d labels", split, len(images), len(labels))

        if orphan_imgs:
            logger.warning("[%s] %d images missing labels: %s...", split, len(orphan_imgs), list(orphan_imgs)[:3])
            ok = False
        if orphan_lbls:
            logger.warning("[%s] %d labels missing images: %s...", split, len(orphan_lbls), list(orphan_lbls)[:3])
            ok = False

    data_yaml = dataset_dir / "data.yaml"
    if not data_yaml.exists():
        logger.error("data.yaml not found!")
        ok = False
    else:
        logger.info("data.yaml: OK")

    return ok


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True, help="Path to YOLO dataset root")
    args = parser.parse_args()

    path = Path(args.dataset)
    if not path.exists():
        logger.error("Dataset directory not found: %s", path)
        raise SystemExit(1)

    valid = validate(path)
    if valid:
        logger.info("Dataset is valid!")
    else:
        logger.error("Dataset has issues. Fix them before training.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
