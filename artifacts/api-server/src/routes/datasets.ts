import { Router, type IRouter } from "express";
import { datasets, images, randomUUID, now, type Dataset } from "./store";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/datasets", (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const limit = parseInt(String(req.query.limit ?? "20"));
  const all = Array.from(datasets.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const start = (page - 1) * limit;
  res.json({ items: all.slice(start, start + limit), total: all.length, page, limit });
});

router.post("/datasets", (req, res) => {
  const body = req.body;
  if (!body.name || !body.classes) {
    res.status(400).json({ error: "name and classes are required" });
    return;
  }
  const d: Dataset = {
    id: randomUUID(),
    name: body.name,
    description: body.description ?? null,
    classes: body.classes,
    image_count: 0,
    annotated_count: 0,
    train_split: body.train_split ?? 0.8,
    val_split: body.val_split ?? 0.1,
    test_split: body.test_split ?? 0.1,
    output_mode: body.output_mode ?? "bbox_and_segmentation",
    prompt_type: body.prompt_type ?? "text",
    created_at: now(),
    updated_at: now(),
  };
  datasets.set(d.id, d);
  req.log.info({ datasetId: d.id }, "Dataset created");
  res.status(201).json(d);
});

router.get("/datasets/:datasetId", (req, res) => {
  const d = datasets.get(req.params.datasetId);
  if (!d) { res.status(404).json({ error: "Not found" }); return; }
  res.json(d);
});

router.delete("/datasets/:datasetId", (req, res) => {
  if (!datasets.has(req.params.datasetId)) { res.status(404).json({ error: "Not found" }); return; }
  datasets.delete(req.params.datasetId);
  logger.info({ datasetId: req.params.datasetId }, "Dataset deleted");
  res.status(204).end();
});

router.get("/datasets/:datasetId/images", (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const limit = parseInt(String(req.query.limit ?? "50"));
  const split = String(req.query.split ?? "all");
  const { datasetId } = req.params;

  if (!datasets.has(datasetId)) { res.status(404).json({ error: "Not found" }); return; }

  let all = Array.from(images.values()).filter(img => img.dataset_id === datasetId);
  if (split !== "all") all = all.filter(img => img.split === split);

  const start = (page - 1) * limit;
  res.json({ items: all.slice(start, start + limit), total: all.length, page, limit });
});

router.post("/datasets/:datasetId/upload", (req, res) => {
  const d = datasets.get(req.params.datasetId);
  if (!d) { res.status(404).json({ error: "Not found" }); return; }

  const count = 3;
  const splits: Array<"train" | "val" | "test"> = ["train", "val", "test"];
  for (let i = 0; i < count; i++) {
    const imgId = randomUUID();
    const seedN = Math.floor(Math.random() * 1000);
    images.set(imgId, {
      id: imgId, dataset_id: req.params.datasetId,
      filename: `upload_${Date.now()}_${i}.jpg`,
      width: 1920, height: 1080,
      split: splits[i % 3],
      annotation_count: 0, review_status: "pending",
      url: `https://picsum.photos/seed/${seedN}/640/360`,
      created_at: now(),
    });
  }
  d.image_count += count;
  d.updated_at = now();

  res.json({ uploaded: count, failed: 0, errors: [] });
});

export default router;
