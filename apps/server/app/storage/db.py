"""
In-memory database for development/mock mode.
Replace with SQLAlchemy + PostgreSQL for production.
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any, Optional


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.utcnow()


class InMemoryDB:
    def __init__(self):
        self.datasets: dict[str, dict[str, Any]] = {}
        self.images: dict[str, dict[str, Any]] = {}
        self.jobs: dict[str, dict[str, Any]] = {}
        self.annotations: dict[str, dict[str, Any]] = {}
        self.exports: dict[str, dict[str, Any]] = {}
        self._seed()

    def _seed(self):
        ds_id = new_id()
        ts = now()
        self.datasets[ds_id] = {
            "id": ds_id,
            "name": "Sample Dataset",
            "description": "Seed data for development",
            "classes": [{"id": 0, "name": "object", "prompt": "a salient object", "color": "#ef4444"}],
            "image_count": 0,
            "annotated_count": 0,
            "train_split": 0.8,
            "val_split": 0.1,
            "test_split": 0.1,
            "output_mode": "bbox_and_segmentation",
            "prompt_type": "text",
            "created_at": ts,
            "updated_at": ts,
        }


db = InMemoryDB()
