"""
Mock SAM3 adapter for development without a GPU.
Generates plausible-looking random bounding boxes.
"""
from __future__ import annotations
import random
from PIL import Image
from .sam3_adapter import DetectionResult


class MockAdapter:
    """Generates random annotations that look like plausible SAM3 outputs."""

    model_loaded = True

    def predict(
        self,
        image: Image.Image,
        class_prompts: list[dict],
        confidence_threshold: float = 0.35,
        max_detections: int = 50,
    ) -> list[DetectionResult]:
        W, H = image.size
        n = random.randint(1, min(5, max_detections))
        results: list[DetectionResult] = []

        for _ in range(n):
            cls = random.choice(class_prompts)
            x1 = random.uniform(0, W * 0.7)
            y1 = random.uniform(0, H * 0.7)
            x2 = x1 + random.uniform(W * 0.1, min(W * 0.4, W - x1))
            y2 = y1 + random.uniform(H * 0.1, min(H * 0.4, H - y1))
            confidence = random.uniform(0.45, 0.98)

            if confidence < confidence_threshold:
                continue

            results.append(DetectionResult(
                class_id=cls["id"],
                class_name=cls["name"],
                confidence=confidence,
                bbox_xyxy=[x1, y1, x2, y2],
            ))

        return results

    @property
    def available_memory_gb(self):
        return None
