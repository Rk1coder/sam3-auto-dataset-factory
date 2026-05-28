import { Router, type IRouter } from "express";
import { jobs, datasets, images, annotations, randomUUID, now, type Job, type Annotation } from "./store";

const router: IRouter = Router();

router.get("/jobs", (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const limit = parseInt(String(req.query.limit ?? "20"));
  const status = req.query.status as string | undefined;
  let all = Array.from(jobs.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  if (status) all = all.filter(j => j.status === status);
  const start = (page - 1) * limit;
  res.json({ items: all.slice(start, start + limit), total: all.length, page, limit });
});

router.post("/jobs/auto-label", (req, res) => {
  const body = req.body;
  if (!body.dataset_id || !body.classes || !body.config) {
    res.status(400).json({ error: "dataset_id, classes, and config are required" });
    return;
  }

  const dataset = datasets.get(body.dataset_id);
  if (!dataset) { res.status(404).json({ error: "Dataset not found" }); return; }

  const datasetImages = Array.from(images.values()).filter(img => img.dataset_id === body.dataset_id);

  const job: Job = {
    id: randomUUID(),
    dataset_id: body.dataset_id,
    status: "queued",
    progress: 0,
    processed_images: 0,
    total_images: datasetImages.length || dataset.image_count,
    failed_images: 0,
    classes: body.classes,
    config: body.config,
    error_message: null,
    created_at: now(),
    started_at: null,
    completed_at: null,
  };
  jobs.set(job.id, job);

  simulateMockJob(job.id, body.classes, datasetImages);

  res.status(201).json(job);
});

function simulateMockJob(jobId: string, classes: Array<{ class_id: number; class_name: string; prompt: string }>, datasetImages: Array<{ id: string; dataset_id: string }>) {
  const job = jobs.get(jobId);
  if (!job) return;

  setTimeout(() => {
    const j = jobs.get(jobId);
    if (!j || j.status === "cancelled") return;
    j.status = "running";
    j.started_at = now();

    const total = Math.max(datasetImages.length, 5);
    let processed = 0;

    const tick = setInterval(() => {
      const current = jobs.get(jobId);
      if (!current || current.status === "cancelled" || current.status === "paused") {
        clearInterval(tick);
        return;
      }

      const batch = Math.min(2, total - processed);
      processed += batch;
      current.processed_images = processed;
      current.progress = processed / total;

      for (let i = 0; i < batch && i < datasetImages.length; i++) {
        const img = datasetImages[processed - batch + i];
        if (!img) continue;
        const cls = classes[Math.floor(Math.random() * classes.length)];
        const ann: Annotation = {
          id: randomUUID(),
          image_id: img.id,
          class_id: cls.class_id,
          class_name: cls.class_name,
          confidence: 0.6 + Math.random() * 0.35,
          bbox_xyxy: [50 + Math.random() * 200, 50 + Math.random() * 100, 300 + Math.random() * 200, 250 + Math.random() * 100],
          polygon: null,
          mask_area: Math.floor(5000 + Math.random() * 30000),
          point_count: null,
          review_status: "pending",
          source: "auto",
          created_at: now(),
        };
        annotations.set(ann.id, ann);
      }

      if (processed >= total) {
        clearInterval(tick);
        current.status = "completed";
        current.progress = 1.0;
        current.processed_images = total;
        current.completed_at = now();

        const ds = datasets.get(current.dataset_id);
        if (ds) {
          ds.annotated_count = Math.min(ds.annotated_count + total, ds.image_count);
          ds.updated_at = now();
        }
      }
    }, 1500);
  }, 800);
}

router.get("/jobs/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Not found" }); return; }
  res.json(job);
});

router.post("/jobs/:jobId/cancel", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Not found" }); return; }
  if (job.status === "running" || job.status === "queued") {
    job.status = "cancelled";
    job.completed_at = now();
  }
  res.json(job);
});

router.post("/jobs/:jobId/resume", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Not found" }); return; }
  if (job.status === "paused") {
    job.status = "queued";
  }
  res.json(job);
});

export default router;
