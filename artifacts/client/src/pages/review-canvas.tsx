import {
  useGetDataset, useListDatasetImages, useListAnnotations,
  useUpdateAnnotation, useDeleteAnnotation,
  getListAnnotationsQueryKey, getListDatasetImagesQueryKey,
} from "@workspace/api-client-react";
import { ArrowLeft, ChevronLeft, ChevronRight, Check, X, Trash2, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiImage } from "@/components/api-image";

type Annotation = {
  id: string; class_id: number; class_name: string; confidence: number;
  bbox_xyxy: number[]; polygon: number[][] | null; mask_area: number | null;
  review_status: "pending" | "accepted" | "rejected"; source: "auto" | "manual";
};

const CLASS_PALETTE = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6"];

function getColor(classId: number) { return CLASS_PALETTE[classId % CLASS_PALETTE.length]; }

export default function ReviewCanvas({ params }: { params: { datasetId: string } }) {
  const qc = useQueryClient();
  const { data: dataset } = useGetDataset(params.datasetId);
  const { data: imagesData } = useListDatasetImages(params.datasetId, { split: "all", limit: 200 });

  const [imageIdx, setImageIdx] = useState(0);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const images = imagesData?.items ?? [];
  const currentImage = images[imageIdx];

  useEffect(() => {
    if (!images.length) return;

    const requestedImageId = new URLSearchParams(window.location.search).get("imageId");
    if (!requestedImageId) return;

    const requestedIndex = images.findIndex((image) => image.id === requestedImageId);
    if (requestedIndex === -1 || requestedIndex === imageIdx) return;

    setImageIdx(requestedIndex);
    setSelectedAnnId(null);
    setImgLoaded(false);
  }, [images, imageIdx]);

  const { data: annotations = [] } = useListAnnotations(currentImage?.id ?? "", undefined, {
    query: {
      queryKey: getListAnnotationsQueryKey(currentImage?.id ?? ""),
      enabled: !!currentImage?.id,
      refetchOnWindowFocus: false,
    },
  });

  const updateAnnotation = useUpdateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();

  const filteredAnns = annotations.filter(a => a.confidence >= minConfidence);
  const selectedAnn = filteredAnns.find(a => a.id === selectedAnnId) ?? null;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.offsetWidth;
    canvas.height = img.offsetHeight;
    const scaleX = img.offsetWidth / img.naturalWidth;
    const scaleY = img.offsetHeight / img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const ann of filteredAnns as Annotation[]) {
      const color = getColor(ann.class_id);
      const isSelected = ann.id === selectedAnnId;
      const [x1, y1, x2, y2] = ann.bbox_xyxy.map((v, i) => v * (i % 2 === 0 ? scaleX : scaleY));

      if (ann.polygon && ann.polygon.length > 2) {
        ctx.beginPath();
        ctx.moveTo(ann.polygon[0][0] * scaleX, ann.polygon[0][1] * scaleY);
        for (let i = 1; i < ann.polygon.length; i++) {
          ctx.lineTo(ann.polygon[i][0] * scaleX, ann.polygon[i][1] * scaleY);
        }
        ctx.closePath();
        ctx.fillStyle = color + "33";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
      }

      ctx.strokeStyle = isSelected ? "#fff" : color;
      ctx.lineWidth = isSelected ? 2 : 1.5;
      if (ann.review_status === "rejected") ctx.setLineDash([4, 3]);
      else ctx.setLineDash([]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.fillRect(x1, y1 - 14, Math.min(ctx.measureText(ann.class_name).width + 8, 120), 14);
      ctx.fillStyle = "#000";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillText(`${ann.class_name} ${(ann.confidence * 100).toFixed(0)}%`, x1 + 4, y1 - 3);
    }
  }, [filteredAnns, selectedAnnId, imgLoaded]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scaleX = img.offsetWidth / img.naturalWidth;
    const scaleY = img.offsetHeight / img.naturalHeight;

    let found: string | null = null;
    for (const ann of filteredAnns as Annotation[]) {
      const [x1, y1, x2, y2] = ann.bbox_xyxy.map((v, i) => v * (i % 2 === 0 ? scaleX : scaleY));
      if (mx >= x1 && mx <= x2 && my >= y1 && my <= y2) { found = ann.id; break; }
    }
    setSelectedAnnId(found);
  }

  function setReviewStatus(id: string, status: "accepted" | "rejected") {
    updateAnnotation.mutate({ annotationId: id, data: { review_status: status } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAnnotationsQueryKey(currentImage?.id ?? "") }),
    });
  }

  function handleDelete(id: string) {
    deleteAnnotation.mutate({ annotationId: id }, {
      onSuccess: () => {
        if (selectedAnnId === id) setSelectedAnnId(null);
        qc.invalidateQueries({ queryKey: getListAnnotationsQueryKey(currentImage?.id ?? "") });
      },
    });
  }

  function nextImage() { setImageIdx(i => Math.min(i + 1, images.length - 1)); setSelectedAnnId(null); setImgLoaded(false); }
  function prevImage() { setImageIdx(i => Math.max(i - 1, 0)); setSelectedAnnId(null); setImgLoaded(false); }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "n" || e.key === "N") nextImage();
      if (e.key === "p" || e.key === "P") prevImage();
      if (selectedAnnId) {
        if (e.key === "a" || e.key === "A") setReviewStatus(selectedAnnId, "accepted");
        if (e.key === "r" || e.key === "R") setReviewStatus(selectedAnnId, "rejected");
        if (e.key === "Delete") handleDelete(selectedAnnId);
      }
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= filteredAnns.length) {
        setSelectedAnnId(filteredAnns[num - 1].id);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedAnnId, filteredAnns, imageIdx]);

  const statusBadge = (s: string) => ({
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    accepted: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  }[s] ?? "bg-secondary text-muted-foreground border-border");

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <Link href={`/datasets/${params.datasetId}`}>
          <button className="p-1 rounded-sm hover:bg-secondary text-muted-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <span className="text-sm font-semibold text-foreground">{dataset?.name ?? "Review"}</span>
        <span className="text-xs text-muted-foreground font-mono">{imageIdx + 1} / {images.length}</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-muted-foreground">Min confidence:</span>
          <input type="range" min="0" max="0.95" step="0.05" value={minConfidence}
            onChange={e => setMinConfidence(parseFloat(e.target.value))}
            className="w-24 accent-primary" />
          <span className="text-xs font-mono text-primary w-8">{(minConfidence * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={prevImage} disabled={imageIdx === 0} className="p-1 rounded-sm hover:bg-secondary text-muted-foreground disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={nextImage} disabled={imageIdx >= images.length - 1} className="p-1 rounded-sm hover:bg-secondary text-muted-foreground disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-44 border-r border-border bg-card overflow-y-auto flex-shrink-0">
          {images.map((img, i) => (
            <button key={img.id} onClick={() => { setImageIdx(i); setSelectedAnnId(null); setImgLoaded(false); }}
              className={`w-full text-left p-2 border-b border-border transition-colors ${i === imageIdx ? "bg-primary/10" : "hover:bg-secondary"}`}>
              <div className="text-xs font-mono text-foreground truncate">{img.filename}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-xs font-mono ${statusBadge(img.review_status).split(" ")[1]}`}>{img.annotation_count}</span>
                <span className="text-xs text-muted-foreground font-mono">{img.split}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/50 p-4">
          {currentImage ? (
            <div className="relative flex h-full min-h-0 w-full items-center justify-center">
              <ApiImage
                ref={imgRef}
                src={currentImage.url}
                alt={currentImage.filename}
                className="block max-h-full max-w-full object-contain"
                onLoad={() => setImgLoaded(true)}
              />
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="absolute cursor-crosshair"
                style={{
                  left: imgRef.current?.offsetLeft ?? 0,
                  top: imgRef.current?.offsetTop ?? 0,
                  width: imgRef.current?.offsetWidth ?? 0,
                  height: imgRef.current?.offsetHeight ?? 0,
                  pointerEvents: imgLoaded ? "all" : "none",
                }}
              />
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">No images to review</div>
          )}
        </div>

        <div className="w-64 border-l border-border bg-card overflow-y-auto flex-shrink-0">
          <div className="p-3 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Annotations</div>
            <div className="text-xs text-muted-foreground">
              Shortcuts: <span className="font-mono text-foreground">A</span>=accept <span className="font-mono text-foreground">R</span>=reject <span className="font-mono text-foreground">N/P</span>=nav <span className="font-mono text-foreground">Del</span>=delete
            </div>
          </div>

          {selectedAnn && (
            <div className="p-3 border-b border-border bg-secondary/30">
              <div className="text-xs font-semibold text-foreground mb-2">{selectedAnn.class_name}</div>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span><span className="text-primary">{(selectedAnn.confidence * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Bbox</span><span className="text-foreground text-xs">[{selectedAnn.bbox_xyxy.map(v => v.toFixed(0)).join(",")}]</span></div>
                {selectedAnn.mask_area && <div className="flex justify-between"><span className="text-muted-foreground">Mask area</span><span className="text-foreground">{selectedAnn.mask_area.toLocaleString()}px</span></div>}
                {selectedAnn.polygon && <div className="flex justify-between"><span className="text-muted-foreground">Polygon pts</span><span className="text-foreground">{selectedAnn.polygon.length}</span></div>}
              </div>
              <div className="flex items-center gap-1 mt-3">
                <button onClick={() => setReviewStatus(selectedAnn.id, "accepted")}
                  className="flex-1 flex items-center justify-center gap-1 py-1 text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-sm hover:bg-emerald-500/20 transition-colors">
                  <Check className="w-3 h-3" /> Accept
                </button>
                <button onClick={() => setReviewStatus(selectedAnn.id, "rejected")}
                  className="flex-1 flex items-center justify-center gap-1 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm hover:bg-red-500/20 transition-colors">
                  <X className="w-3 h-3" /> Reject
                </button>
                <button onClick={() => handleDelete(selectedAnn.id)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border">
            {(filteredAnns as Annotation[]).map((ann, i) => (
              <button key={ann.id} onClick={() => setSelectedAnnId(ann.id === selectedAnnId ? null : ann.id)}
                className={`w-full text-left px-3 py-2 transition-colors ${ann.id === selectedAnnId ? "bg-primary/10" : "hover:bg-secondary"}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getColor(ann.class_id) }} />
                  <span className="text-xs font-semibold text-foreground flex-1 truncate">{ann.class_name}</span>
                  <span className="text-xs font-mono text-muted-foreground">{(ann.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 ml-4">
                  <span className={`text-xs px-1 rounded-sm border ${statusBadge(ann.review_status)}`}>{ann.review_status}</span>
                  <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                </div>
              </button>
            ))}
            {filteredAnns.length === 0 && (
              <div className="p-4 text-center">
                <RefreshCw className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No annotations</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
