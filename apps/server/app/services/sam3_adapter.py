"""
SAM3 adapter — wraps the real SAM3 model for segmentation inference.
Requires: torch, transformers or the sam3 package.
Set USE_MOCK=true to bypass and use MockAdapter instead.
"""
from __future__ import annotations
import logging
from pathlib import Path
from PIL import Image
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)


def _normalize_label(value: object) -> str:
    return str(value).strip().lower().rstrip(".")


def mask_to_bbox_xyxy(mask: np.ndarray) -> list[float]:
    ys, xs = np.where(mask)
    if len(xs) == 0 or len(ys) == 0:
        return [0.0, 0.0, 0.0, 0.0]
    return [float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())]


def mask_to_polygon(mask: np.ndarray, max_points: int = 96) -> list[list[float]]:
    try:
        from skimage import measure

        contours = measure.find_contours(mask.astype(np.uint8), 0.5)
    except Exception:
        contours = []

    if not contours:
        x1, y1, x2, y2 = mask_to_bbox_xyxy(mask)
        return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]

    contour = max(contours, key=len)
    step = max(1, int(np.ceil(len(contour) / max_points)))
    polygon = [[float(x), float(y)] for y, x in contour[::step]]

    if len(polygon) < 3:
        x1, y1, x2, y2 = mask_to_bbox_xyxy(mask)
        return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]

    return polygon


def _to_numpy_mask(mask: object) -> np.ndarray:
    if hasattr(mask, "detach"):
        mask = mask.detach().cpu().numpy()
    array = np.asarray(mask)
    array = np.squeeze(array)
    return array.astype(bool)


class DetectionResult:
    def __init__(
        self,
        class_id: int,
        class_name: str,
        confidence: float,
        bbox_xyxy: list[float],
        polygon: Optional[list[list[float]]] = None,
        mask_area: Optional[float] = None,
        mask: Optional[np.ndarray] = None,
    ):
        self.class_id = class_id
        self.class_name = class_name
        self.confidence = confidence
        self.bbox_xyxy = bbox_xyxy
        self.polygon = polygon
        self.mask_area = mask_area
        self.mask = mask  # HxW bool array or None


class SAM3Adapter:
    """Real SAM3 concept segmentation adapter with a detector fallback mode."""

    def __init__(self, model_id: str, checkpoint_dir: Path, device: str, hf_token: str = ""):
        self.model_id = model_id
        self.checkpoint_dir = checkpoint_dir
        self.device = device
        self.hf_token = hf_token
        self._model = None
        self._processor = None
        self._backend = "sam3" if "sam3" in model_id.lower() else "grounding_dino"
        self.model_loaded = False

    def load_model(self) -> None:
        try:
            hub_kwargs = {"token": self.hf_token} if self.hf_token else {}

            if self._backend == "sam3":
                try:
                    from transformers import Sam3Model, Sam3Processor  # type: ignore
                except ImportError as exc:
                    raise ImportError(
                        "SAM3 requires a Transformers build with Sam3Model/Sam3Processor. "
                        "Upgrade transformers and ensure you have access to facebook/sam3."
                    ) from exc

                logger.info("Loading SAM3 PCS model: %s on %s", self.model_id, self.device)
                self._processor = Sam3Processor.from_pretrained(
                    self.model_id, cache_dir=str(self.checkpoint_dir), **hub_kwargs
                )
                self._model = Sam3Model.from_pretrained(
                    self.model_id, cache_dir=str(self.checkpoint_dir), **hub_kwargs
                ).to(self.device)
            else:
                from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor  # type: ignore

                logger.info("Loading detection fallback model: %s on %s", self.model_id, self.device)
                self._processor = AutoProcessor.from_pretrained(
                    self.model_id, cache_dir=str(self.checkpoint_dir), **hub_kwargs
                )
                self._model = AutoModelForZeroShotObjectDetection.from_pretrained(
                    self.model_id, cache_dir=str(self.checkpoint_dir), **hub_kwargs
                ).to(self.device)

            self.model_loaded = True
            logger.info("%s model loaded successfully", self._backend)
        except ImportError:
            logger.error("torch or transformers not installed. Install GPU requirements to use real inference.")
            raise
        except Exception as exc:
            logger.error("Failed to load SAM3: %s", exc)
            raise

    def predict(
        self,
        image: Image.Image,
        class_prompts: list[dict],
        confidence_threshold: float = 0.35,
        max_detections: int = 50,
    ) -> list[DetectionResult]:
        if not self.model_loaded:
            self.load_model()

        if self._backend == "sam3":
            return self._predict_sam3(
                image=image,
                class_prompts=class_prompts,
                confidence_threshold=confidence_threshold,
                max_detections=max_detections,
            )

        return self._predict_grounding_dino(
            image=image,
            class_prompts=class_prompts,
            confidence_threshold=confidence_threshold,
            max_detections=max_detections,
        )

    def _predict_sam3(
        self,
        image: Image.Image,
        class_prompts: list[dict],
        confidence_threshold: float,
        max_detections: int,
    ) -> list[DetectionResult]:
        import torch  # type: ignore

        detections: list[DetectionResult] = []

        for class_prompt in class_prompts:
            if len(detections) >= max_detections:
                break

            prompt = class_prompt.get("prompt") or class_prompt.get("name")
            inputs = self._processor(images=image, text=prompt, return_tensors="pt").to(self.device)

            with torch.no_grad():
                outputs = self._model(**inputs)

            results = self._processor.post_process_instance_segmentation(
                outputs,
                threshold=confidence_threshold,
                mask_threshold=0.5,
                target_sizes=inputs.get("original_sizes").tolist(),
            )[0]

            masks = results.get("masks", [])
            boxes = results.get("boxes", [])
            scores = results.get("scores", [])

            for index, mask in enumerate(masks):
                if len(detections) >= max_detections:
                    break

                score = float(scores[index]) if index < len(scores) else confidence_threshold
                if score < confidence_threshold:
                    continue

                mask_array = _to_numpy_mask(mask)
                mask_area = float(mask_array.sum())
                if mask_area <= 0:
                    continue

                if index < len(boxes):
                    box = boxes[index]
                    if hasattr(box, "detach"):
                        box = box.detach().cpu().tolist()
                    bbox = [float(v) for v in box]
                else:
                    bbox = mask_to_bbox_xyxy(mask_array)

                detections.append(DetectionResult(
                    class_id=class_prompt["id"],
                    class_name=class_prompt["name"],
                    confidence=score,
                    bbox_xyxy=bbox,
                    polygon=mask_to_polygon(mask_array),
                    mask_area=mask_area,
                    mask=mask_array,
                ))

        return detections

    def _predict_grounding_dino(
        self,
        image: Image.Image,
        class_prompts: list[dict],
        confidence_threshold: float,
        max_detections: int,
    ) -> list[DetectionResult]:
        import torch  # type: ignore

        text_prompts = [c["prompt"] for c in class_prompts]
        inputs = self._processor(images=image, text=text_prompts, return_tensors="pt").to(self.device)

        with torch.no_grad():
            outputs = self._model(**inputs)

        results = self._processor.post_process_grounded_object_detection(
            outputs,
            inputs.input_ids,
            threshold=confidence_threshold,
            text_threshold=confidence_threshold * 0.7,
            target_sizes=[image.size[::-1]],
        )[0]

        def class_index_for_label(label: object, fallback_index: int) -> int:
            if hasattr(label, "item"):
                try:
                    return int(label.item()) % len(class_prompts)
                except Exception:
                    pass

            normalized = _normalize_label(label)
            for idx, class_prompt in enumerate(class_prompts):
                candidates = (
                    class_prompt.get("prompt", ""),
                    class_prompt.get("name", ""),
                )
                if any(_normalize_label(candidate) == normalized for candidate in candidates):
                    return idx

            return fallback_index % len(class_prompts)

        labels = results.get("text_labels") or results.get("labels") or []

        detections: list[DetectionResult] = []
        for det_index, (score, label, box) in enumerate(zip(results["scores"], labels, results["boxes"])):
            if len(detections) >= max_detections:
                break
            class_idx = class_index_for_label(label, det_index)
            detections.append(DetectionResult(
                class_id=class_prompts[class_idx]["id"],
                class_name=class_prompts[class_idx]["name"],
                confidence=float(score),
                bbox_xyxy=[float(v) for v in box],
            ))

        return detections

    @property
    def available_memory_gb(self) -> Optional[float]:
        try:
            import torch  # type: ignore
            if torch.cuda.is_available():
                return torch.cuda.mem_get_info()[0] / (1024**3)
        except Exception:
            pass
        return None
