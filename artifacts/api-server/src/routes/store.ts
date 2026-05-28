import { randomUUID } from "crypto";

export type ClassDef = { id: number; name: string; prompt: string; color?: string | null };
export type Dataset = {
  id: string; name: string; description: string | null; classes: ClassDef[];
  image_count: number; annotated_count: number;
  train_split: number; val_split: number; test_split: number;
  output_mode: string; prompt_type: string;
  created_at: string; updated_at: string;
};
export type ImageItem = {
  id: string; dataset_id: string; filename: string;
  width: number; height: number; split: string;
  annotation_count: number; review_status: string;
  url: string; created_at: string;
};
export type JobClass = { class_id: number; class_name: string; prompt: string };
export type Job = {
  id: string; dataset_id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "paused";
  progress: number; processed_images: number; total_images: number; failed_images: number;
  classes: JobClass[]; config: Record<string, unknown>;
  error_message: string | null;
  created_at: string; started_at: string | null; completed_at: string | null;
};
export type Annotation = {
  id: string; image_id: string; class_id: number; class_name: string;
  confidence: number; bbox_xyxy: number[];
  polygon: number[][] | null; mask_area: number | null; point_count: number | null;
  review_status: "pending" | "accepted" | "rejected"; source: "auto" | "manual";
  created_at: string;
};
export type Export = {
  id: string; dataset_id: string; format: string; status: string;
  download_url: string | null; file_size_bytes: number | null;
  image_count: number; annotation_count: number;
  min_confidence: number; include_rejected: boolean;
  created_at: string; completed_at: string | null;
};

function now() { return new Date().toISOString(); }

const datasets = new Map<string, Dataset>();
const images = new Map<string, ImageItem>();
const jobs = new Map<string, Job>();
const annotations = new Map<string, Annotation>();
const exports_ = new Map<string, Export>();

function seed() {
  const d1Id = randomUUID();
  const d1: Dataset = {
    id: d1Id, name: "Drone Detection v1", description: "Aerial drone surveillance dataset",
    classes: [
      { id: 0, name: "drone", prompt: "small fixed-wing drone", color: "#ef4444" },
      { id: 1, name: "person", prompt: "person standing", color: "#3b82f6" },
    ],
    image_count: 124, annotated_count: 98,
    train_split: 0.8, val_split: 0.1, test_split: 0.1,
    output_mode: "bbox_and_segmentation", prompt_type: "text",
    created_at: now(), updated_at: now(),
  };
  datasets.set(d1Id, d1);

  const d2Id = randomUUID();
  const d2: Dataset = {
    id: d2Id, name: "Vehicle Segmentation", description: "Road traffic vehicle dataset",
    classes: [
      { id: 0, name: "car", prompt: "passenger car", color: "#22c55e" },
      { id: 1, name: "truck", prompt: "large truck", color: "#f59e0b" },
      { id: 2, name: "motorcycle", prompt: "motorcycle or moped", color: "#a855f7" },
    ],
    image_count: 512, annotated_count: 312,
    train_split: 0.75, val_split: 0.15, test_split: 0.1,
    output_mode: "segmentation_only", prompt_type: "text",
    created_at: now(), updated_at: now(),
  };
  datasets.set(d2Id, d2);

  const splits: Array<"train" | "val" | "test"> = ["train", "val", "test"];
  const statuses = ["pending", "accepted", "rejected"];
  for (let i = 0; i < 20; i++) {
    const imgId = randomUUID();
    const img: ImageItem = {
      id: imgId, dataset_id: d1Id,
      filename: `frame_${String(i).padStart(4, "0")}.jpg`,
      width: 1920, height: 1080,
      split: splits[i % 3] as string,
      annotation_count: Math.floor(Math.random() * 5),
      review_status: statuses[i % 3] as string,
      url: `https://picsum.photos/seed/${i + 10}/640/360`,
      created_at: now(),
    };
    images.set(imgId, img);

    const ann: Annotation = {
      id: randomUUID(), image_id: imgId,
      class_id: i % 2, class_name: i % 2 === 0 ? "drone" : "person",
      confidence: 0.75 + Math.random() * 0.2,
      bbox_xyxy: [100 + i * 10, 80 + i * 5, 250 + i * 10, 200 + i * 5],
      polygon: [[[100 + i*10, 80 + i*5], [250 + i*10, 80 + i*5], [250 + i*10, 200 + i*5], [100 + i*10, 200 + i*5]].map(p => p)],
      mask_area: 20000, point_count: 4,
      review_status: statuses[i % 3] as "pending" | "accepted" | "rejected",
      source: "auto", created_at: now(),
    };
    annotations.set(ann.id, ann);
  }

  const j1: Job = {
    id: randomUUID(), dataset_id: d1Id,
    status: "completed", progress: 1.0,
    processed_images: 124, total_images: 124, failed_images: 2,
    classes: [
      { class_id: 0, class_name: "drone", prompt: "small fixed-wing drone" },
      { class_id: 1, class_name: "person", prompt: "person standing" },
    ],
    config: { output_mode: "bbox_and_segmentation", confidence_threshold: 0.35, min_mask_area: 80, max_detections_per_image: 50, review_required: true },
    error_message: null, created_at: now(), started_at: now(), completed_at: now(),
  };
  jobs.set(j1.id, j1);

  const j2: Job = {
    id: randomUUID(), dataset_id: d2Id,
    status: "running", progress: 0.61,
    processed_images: 312, total_images: 512, failed_images: 5,
    classes: [
      { class_id: 0, class_name: "car", prompt: "passenger car" },
      { class_id: 1, class_name: "truck", prompt: "large truck" },
    ],
    config: { output_mode: "segmentation_only", confidence_threshold: 0.4, min_mask_area: 100, max_detections_per_image: 30, review_required: true },
    error_message: null, created_at: now(), started_at: now(), completed_at: null,
  };
  jobs.set(j2.id, j2);
}

seed();

export { datasets, images, jobs, annotations, exports_, randomUUID, now };
