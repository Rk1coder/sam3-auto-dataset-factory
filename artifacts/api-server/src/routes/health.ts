import { Router, type IRouter } from "express";
import { annotations, datasets, images, jobs } from "./store";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/server-info", (_req, res) => {
  res.json({
    status: "ok",
    device: "cpu",
    model_loaded: false,
    model_name: "sam3-mock",
    max_batch_size: 8,
    available_memory_gb: null,
    mock_mode: true,
  });
});

router.get("/stats/dashboard", (_req, res) => {
  const totalImages = images.size;
  const totalAnnotations = annotations.size;
  const completedJobs = Array.from(jobs.values()).filter(j => j.status === "completed").length;
  const runningJobs = Array.from(jobs.values()).filter(j => j.status === "running").length;
  const pendingReview = Array.from(annotations.values()).filter(a => a.review_status === "pending").length;

  res.json({
    total_datasets: datasets.size,
    total_images: totalImages,
    total_annotations: totalAnnotations,
    completed_jobs: completedJobs,
    pending_review: pendingReview,
    running_jobs: runningJobs,
    recent_exports: 2,
    server_status: "ok",
    model_loaded: false,
  });
});

export default router;
