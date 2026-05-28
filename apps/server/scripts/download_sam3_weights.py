"""
Pre-download SAM3 model weights to the checkpoint directory.
Run once before starting the server without internet access.

Usage:
  python scripts/download_sam3_weights.py [--model facebook/sam3] [--dir ./checkpoints]
"""
import argparse
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def download(model_id: str, cache_dir: str, hf_token: str | None) -> None:
    try:
        from huggingface_hub import snapshot_download  # type: ignore
    except ImportError:
        logger.error("huggingface_hub not installed. Run: pip install huggingface_hub")
        sys.exit(1)

    logger.info("Downloading %s to %s", model_id, cache_dir)
    path = snapshot_download(
        repo_id=model_id,
        cache_dir=cache_dir,
        token=hf_token or None,
        ignore_patterns=["*.msgpack", "flax_model*"],
    )
    logger.info("Downloaded to: %s", path)


def main():
    parser = argparse.ArgumentParser(description="Download SAM3 weights")
    parser.add_argument("--model", default="facebook/sam3")
    parser.add_argument("--dir", default="./checkpoints")
    args = parser.parse_args()

    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        logger.warning("HF_TOKEN not set. Download may fail for gated models.")

    download(args.model, args.dir, hf_token)


if __name__ == "__main__":
    main()
