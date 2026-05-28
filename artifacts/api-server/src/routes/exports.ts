import { Router, type IRouter } from "express";
import { exports_, datasets, annotations, images, randomUUID, now, type Export } from "./store";

const router: IRouter = Router();

router.post("/exports", (req, res) => {
  const body = req.body;
  if (!body.dataset_id || !body.format) {
    res.status(400).json({ error: "dataset_id and format required" });
    return;
  }
  if (!datasets.has(body.dataset_id)) { res.status(404).json({ error: "Dataset not found" }); return; }

  const datasetImages = Array.from(images.values()).filter(img => img.dataset_id === body.dataset_id);
  const datasetAnnotations = Array.from(annotations.values())
    .filter(a => datasetImages.some(img => img.id === a.image_id));
  const minConf = body.min_confidence ?? 0.0;
  const filtered = body.include_rejected
    ? datasetAnnotations
    : datasetAnnotations.filter(a => a.review_status !== "rejected" && a.confidence >= minConf);

  const exp: Export = {
    id: randomUUID(),
    dataset_id: body.dataset_id,
    format: body.format,
    status: "pending",
    download_url: null,
    file_size_bytes: null,
    image_count: datasetImages.length,
    annotation_count: filtered.length,
    min_confidence: minConf,
    include_rejected: body.include_rejected ?? false,
    created_at: now(),
    completed_at: null,
  };
  exports_.set(exp.id, exp);

  setTimeout(() => {
    const e = exports_.get(exp.id);
    if (!e) return;
    e.status = "running";
    setTimeout(() => {
      const e2 = exports_.get(exp.id);
      if (!e2) return;
      e2.status = "completed";
      e2.completed_at = now();
      e2.download_url = `/api/exports/${exp.id}/download`;
      e2.file_size_bytes = Math.floor(500000 + Math.random() * 5000000);
    }, 2500);
  }, 500);

  res.status(201).json(exp);
});

router.get("/exports", (req, res) => {
  const datasetId = req.query.datasetId as string | undefined;
  let all = Array.from(exports_.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  if (datasetId) all = all.filter(e => e.dataset_id === datasetId);
  res.json(all);
});

router.get("/exports/:exportId", (req, res) => {
  const exp = exports_.get(req.params.exportId);
  if (!exp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(exp);
});

router.get("/exports/:exportId/download", (req, res) => {
  const exp = exports_.get(req.params.exportId);
  if (!exp || exp.status !== "completed") { res.status(404).json({ error: "Export not ready" }); return; }

  const yamlContent = `path: .\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n  0: class_0\n  1: class_1\n`;
  res.setHeader("Content-Type", "text/yaml");
  res.setHeader("Content-Disposition", `attachment; filename="data.yaml"`);
  res.send(yamlContent);
});

export default router;
