import { Router, type IRouter } from "express";
import { annotations, images, randomUUID, now, type Annotation } from "./store";

const router: IRouter = Router();

router.get("/images/:imageId/annotations", (req, res) => {
  const minConfidence = parseFloat(String(req.query.minConfidence ?? "0"));
  const all = Array.from(annotations.values())
    .filter(a => a.image_id === req.params.imageId && a.confidence >= minConfidence);
  res.json(all);
});

router.post("/images/:imageId/annotations", (req, res) => {
  const body = req.body;
  if (!images.has(req.params.imageId)) { res.status(404).json({ error: "Image not found" }); return; }
  if (body.class_id === undefined || !body.bbox_xyxy) {
    res.status(400).json({ error: "class_id and bbox_xyxy are required" });
    return;
  }

  const ann: Annotation = {
    id: randomUUID(),
    image_id: req.params.imageId,
    class_id: body.class_id,
    class_name: body.class_name ?? `class_${body.class_id}`,
    confidence: 1.0,
    bbox_xyxy: body.bbox_xyxy,
    polygon: body.polygon ?? null,
    mask_area: null,
    point_count: body.polygon ? body.polygon.length : null,
    review_status: "accepted",
    source: "manual",
    created_at: now(),
  };
  annotations.set(ann.id, ann);
  res.status(201).json(ann);
});

router.put("/annotations/:annotationId", (req, res) => {
  const ann = annotations.get(req.params.annotationId);
  if (!ann) { res.status(404).json({ error: "Not found" }); return; }
  const body = req.body;
  if (body.class_id !== undefined) ann.class_id = body.class_id;
  if (body.class_name !== undefined) ann.class_name = body.class_name;
  if (body.review_status !== undefined) ann.review_status = body.review_status;
  if (body.bbox_xyxy !== undefined) ann.bbox_xyxy = body.bbox_xyxy;
  if (body.polygon !== undefined) ann.polygon = body.polygon;
  res.json(ann);
});

router.delete("/annotations/:annotationId", (req, res) => {
  if (!annotations.has(req.params.annotationId)) { res.status(404).json({ error: "Not found" }); return; }
  annotations.delete(req.params.annotationId);
  res.status(204).end();
});

router.post("/images/:imageId/reprocess", (req, res) => {
  const img = images.get(req.params.imageId);
  if (!img) { res.status(404).json({ error: "Image not found" }); return; }
  const body = req.body;
  if (!body.classes) { res.status(400).json({ error: "classes required" }); return; }

  const toDelete = Array.from(annotations.values())
    .filter(a => a.image_id === req.params.imageId && a.source === "auto")
    .map(a => a.id);
  toDelete.forEach(id => annotations.delete(id));

  const cls = body.classes[0];
  const ann: Annotation = {
    id: randomUUID(),
    image_id: req.params.imageId,
    class_id: cls.class_id,
    class_name: cls.class_name,
    confidence: 0.7 + Math.random() * 0.25,
    bbox_xyxy: [80, 60, 300, 240],
    polygon: null, mask_area: 15000, point_count: null,
    review_status: "pending", source: "auto", created_at: now(),
  };
  annotations.set(ann.id, ann);

  res.json({ image_id: req.params.imageId, status: "reprocessed", annotation_count: 1 });
});

export default router;
