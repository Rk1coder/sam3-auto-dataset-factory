import {
  useGetDataset,
  useListDatasetImages,
  useCreateAutoLabelJob,
  uploadImages,
  getListJobsQueryKey,
  getListDatasetImagesQueryKey,
  getGetDatasetQueryKey,
} from "@workspace/api-client-react";
import { ArrowLeft, Play, Eye, Download, Upload, ImageIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { VideoFrameExtractor } from "@/components/video-frame-extractor";
import { SampleImageUploader } from "@/components/sample-image-uploader";
import { ApiImage } from "@/components/api-image";

type Split = "all" | "train" | "val" | "test";

export default function DatasetDetail({ params }: { params: { id: string } }) {
  const [split, setSplit] = useState<Split>("all");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState("");

  const { data: dataset, isLoading: dsLoading } = useGetDataset(params.id);
  const { data: images, isLoading: imgLoading } = useListDatasetImages(params.id, {
    split,
    page,
    limit: 50,
  });
  const createJob = useCreateAutoLabelJob();
  const imageCount = images?.total ?? dataset?.image_count ?? 0;

  function getErrorMessage(error: unknown): string {
    if (error && typeof error === "object") {
      const apiError = error as { status?: number; message?: string; data?: unknown };
      if (apiError.data && typeof apiError.data === "object") {
        const data = apiError.data as { detail?: unknown; error?: unknown; message?: unknown };
        const detail = data.detail ?? data.error ?? data.message;
        if (typeof detail === "string") return detail;
      }
      if (apiError.message) return apiError.message;
      if (apiError.status) return `HTTP ${apiError.status}`;
    }
    return "Islem tamamlanamadi. API URL, key ve A5000 server loglarini kontrol et.";
  }

  const statusColors: Record<string, string> = {
    pending: "text-yellow-500",
    accepted: "text-emerald-500",
    rejected: "text-red-500",
  };

  function handleStartJob() {
    if (!dataset) return;
    setActionError("");
    createJob.mutate(
      {
        data: {
          dataset_id: dataset.id,
          classes: dataset.classes.map((c) => ({
            class_id: c.id,
            class_name: c.name,
            prompt: c.prompt,
          })),
          config: {
            output_mode: dataset.output_mode as
              | "bbox_only"
              | "segmentation_only"
              | "bbox_and_segmentation",
            confidence_threshold: 0.35,
            min_mask_area: 80,
            max_detections_per_image: 50,
            polygon_simplification_epsilon: 0.002,
            save_intermediate_masks: true,
            review_required: true,
          },
        },
      },
      {
        onSuccess: (job) => {
          qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
          navigate(`/jobs/${job.id}`);
        },
        onError: (error) => {
          setActionError(getErrorMessage(error));
        },
      }
    );
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setActionError("");
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    try {
      const result = await uploadImages(params.id, { body: formData });
      if (result.uploaded === 0 && result.failed > 0) {
        throw new Error(result.errors.join(", ") || "Gorseller yuklenemedi.");
      }
      refreshImages();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const refreshImages = useCallback(() => {
    qc.invalidateQueries({
      queryKey: getListDatasetImagesQueryKey(params.id),
    });
    qc.invalidateQueries({ queryKey: getGetDatasetQueryKey(params.id) });
  }, [qc, params.id]);

  if (dsLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <div className="h-8 w-64 bg-card border border-border rounded-sm animate-pulse" />
        <div className="h-32 bg-card border border-border rounded-sm animate-pulse" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="flex-1 p-6 text-muted-foreground text-sm">
        Dataset bulunamadı.
      </div>
    );
  }

  const pct =
    dataset.image_count > 0
      ? (dataset.annotated_count / dataset.image_count) * 100
      : 0;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/datasets">
            <button className="p-1.5 rounded-sm hover:bg-secondary text-muted-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {dataset.name}
            </h1>
            {dataset.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {dataset.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs text-muted-foreground rounded-sm hover:text-foreground disabled:opacity-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> {uploading ? "Yukleniyor..." : "Gorsel Yukle"}
          </button>
          <Link href={`/review/${dataset.id}`}>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs text-muted-foreground rounded-sm hover:text-foreground transition-colors">
              <Eye className="w-3.5 h-3.5" /> Review
            </button>
          </Link>
          <Link href={`/export/${dataset.id}`}>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs text-muted-foreground rounded-sm hover:text-foreground transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </Link>
          <button
            onClick={handleStartJob}
            disabled={createJob.isPending || imageCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            {createJob.isPending ? "Baslıyor..." : "Auto-Label"}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 rounded-sm">
          {actionError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-sm p-3">
          <div className="text-xs text-muted-foreground">Gorseller</div>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">
            {dataset.image_count.toLocaleString()}
          </div>
        </div>
        <div className="bg-card border border-border rounded-sm p-3">
          <div className="text-xs text-muted-foreground">Etiketlendi</div>
          <div className="text-2xl font-bold font-mono text-primary mt-1">
            {dataset.annotated_count.toLocaleString()}
          </div>
        </div>
        <div className="bg-card border border-border rounded-sm p-3">
          <div className="text-xs text-muted-foreground">Sinif</div>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">
            {dataset.classes.length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-sm p-3">
          <div className="text-xs text-muted-foreground">Ilerleme</div>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">
            {pct.toFixed(0)}%
          </div>
          <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Classes */}
      <div className="bg-card border border-border rounded-sm p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Siniflar
        </h3>
        <div className="flex flex-wrap gap-2">
          {dataset.classes.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-sm"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: c.color ?? "#666" }}
              />
              <span className="text-xs font-mono text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.prompt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Tools */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Veri Ekle
        </h3>

        {/* Sample image uploader */}
        <SampleImageUploader
          datasetId={params.id}
          onComplete={refreshImages}
        />

        {/* Video frame extractor */}
        <VideoFrameExtractor
          datasetId={params.id}
          onComplete={refreshImages}
        />
      </div>

      {/* Image grid */}
      <div>
        <div className="flex items-center gap-1 mb-3">
          {(["all", "train", "val", "test"] as Split[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSplit(s);
                setPage(1);
              }}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                split === s
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground font-mono">
            {images?.total ?? 0} gorsel
          </span>
        </div>

        {imgLoading ? (
          <div className="grid grid-cols-4 lg:grid-cols-6 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-video bg-card border border-border rounded-sm animate-pulse"
              />
            ))}
          </div>
        ) : !images?.items.length ? (
          <div className="flex flex-col items-center justify-center h-40 border border-dashed border-border rounded-sm">
            <ImageIcon className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Bu split'te gorsel yok</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Gorsel yukle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 lg:grid-cols-6 gap-2">
            {images.items.map((img) => (
              <Link key={img.id} href={`/review/${dataset.id}?imageId=${img.id}`}>
                <div className="relative aspect-video bg-card border border-border rounded-sm overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors">
                  <ApiImage
                    src={img.url}
                    alt={img.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono ${
                          statusColors[img.review_status] ??
                          "text-muted-foreground"
                        }`}
                      >
                        {img.annotation_count}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {img.split}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {images && images.total > 50 && (
          <div className="flex items-center justify-center gap-2 pt-3">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Önceki
            </button>
            <span className="text-xs text-muted-foreground font-mono">
              {page} / {Math.ceil(images.total / 50)}
            </span>
            <button
              disabled={page >= Math.ceil(images.total / 50)}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Sonraki
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
