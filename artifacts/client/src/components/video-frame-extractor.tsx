import { useRef, useState, useCallback } from "react";
import { Film, X, ChevronDown, ChevronUp, Check, Loader } from "lucide-react";
import { uploadImages } from "@workspace/api-client-react";

type Props = {
  datasetId: string;
  onComplete?: (count: number) => void;
};

type ExtractionState = "idle" | "loading" | "ready" | "extracting" | "uploading" | "done" | "error";

export function VideoFrameExtractor({ datasetId, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ExtractionState>("idle");
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [frameInterval, setFrameInterval] = useState(1.0);
  const [maxFrames, setMaxFrames] = useState(100);
  const [quality, setQuality] = useState(0.85);
  const [preview, setPreview] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const estimatedFrames = Math.min(
    Math.max(1, Math.floor(videoDuration / frameInterval)),
    maxFrames
  );

  function handleVideoFile(file: File) {
    if (!file.type.startsWith("video/")) {
      setErrorMsg("Lütfen bir video dosyası seçin.");
      setState("error");
      return;
    }
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setState("loading");
    setPreview([]);
    setProgress(0);
    setExtracted(0);
    setErrorMsg("");
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleVideoFile(f);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleVideoFile(f);
  }

  function onVideoLoaded() {
    const v = videoRef.current;
    if (!v) return;
    setVideoDuration(v.duration);
    setState("ready");
  }

  const extractFrames = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    abortRef.current = false;
    setState("extracting");
    setProgress(0);
    setPreview([]);

    const ctx = canvas.getContext("2d")!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const timestamps: number[] = [];
    for (let t = 0; t < video.duration && timestamps.length < maxFrames; t += frameInterval) {
      timestamps.push(parseFloat(t.toFixed(3)));
    }

    const blobs: Blob[] = [];
    const previewUrls: string[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (abortRef.current) break;
      const t = timestamps[i];

      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        const onError = () => { video.removeEventListener("error", onError); reject(); };
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("error", onError);
        video.currentTime = t;
      });

      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
      blobs.push(blob);

      if (previewUrls.length < 6) {
        previewUrls.push(URL.createObjectURL(blob));
        setPreview([...previewUrls]);
      }

      setProgress(Math.round(((i + 1) / timestamps.length) * 100));
    }

    if (abortRef.current) {
      setState("ready");
      return;
    }

    setState("uploading");
    setProgress(0);

    try {
      const BATCH = 10;
      let uploaded = 0;
      for (let i = 0; i < blobs.length; i += BATCH) {
        const batch = blobs.slice(i, i + BATCH);
        const fd = new FormData();
        batch.forEach((b, j) => {
          const padded = String(i + j).padStart(5, "0");
          fd.append("files", new File([b], `frame_${padded}.jpg`, { type: "image/jpeg" }));
        });
        const result = await uploadImages(datasetId, { body: fd });
        if (result.uploaded === 0 && result.failed > 0) {
          throw new Error(result.errors.join(", ") || "Frame yukleme basarisiz.");
        }
        uploaded += batch.length;
        setProgress(Math.round((uploaded / blobs.length) * 100));
      }

      setExtracted(blobs.length);
      setState("done");
      onComplete?.(blobs.length);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Frame yukleme basarisiz.");
      setState("error");
    }
  }, [datasetId, frameInterval, maxFrames, quality, onComplete]);

  function reset() {
    abortRef.current = true;
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    setVideoSrc(null);
    setState("idle");
    setPreview([]);
    setProgress(0);
    setExtracted(0);
    setVideoDuration(0);
    setErrorMsg("");
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
      >
        <Film className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-sm font-semibold text-foreground">Video'dan Frame Cek</span>
        <span className="text-xs text-muted-foreground ml-1">— videoyu framelere ayır ve datasete ekle</span>
        <div className="ml-auto">
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <canvas ref={canvasRef} className="hidden" />

          {state === "idle" || state === "error" ? (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-border hover:border-primary/50 rounded-sm p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group"
            >
              <Film className="w-8 h-8 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
              <p className="text-sm text-muted-foreground">Video dosyasını buraya sürükle veya tıkla</p>
              <p className="text-xs text-muted-foreground/60">MP4, MOV, AVI, WEBM</p>
              {state === "error" && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
              <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileInput} />
            </div>
          ) : null}

          {(state === "loading") && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
              <Loader className="w-4 h-4 animate-spin" />
              Video yükleniyor...
            </div>
          )}

          {videoSrc && (
            <video
              ref={videoRef}
              src={videoSrc}
              onLoadedMetadata={onVideoLoaded}
              className="hidden"
              preload="metadata"
            />
          )}

          {(state === "ready" || state === "extracting" || state === "uploading" || state === "done") && (
            <div className="space-y-4">
              <div className="bg-secondary/30 rounded-sm p-3 flex items-center gap-4 text-xs font-mono text-muted-foreground">
                <Film className="w-3.5 h-3.5 text-primary" />
                <span className="text-foreground">Video hazir</span>
                <span>Suru: {fmtTime(videoDuration)}</span>
                <span>Tahmini: <span className="text-primary">{estimatedFrames} frame</span></span>
                <button onClick={reset} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    Frame araligi (sn)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min="0.1" max="10" step="0.1"
                      value={frameInterval}
                      onChange={e => setFrameInterval(parseFloat(e.target.value))}
                      className="flex-1 accent-primary"
                      disabled={state === "extracting" || state === "uploading"}
                    />
                    <span className="text-xs font-mono text-primary w-10 text-right">{frameInterval.toFixed(1)}s</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    Maks. frame
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min="10" max="500" step="10"
                      value={maxFrames}
                      onChange={e => setMaxFrames(parseInt(e.target.value))}
                      className="flex-1 accent-primary"
                      disabled={state === "extracting" || state === "uploading"}
                    />
                    <span className="text-xs font-mono text-primary w-10 text-right">{maxFrames}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    JPEG kalitesi
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min="0.5" max="1.0" step="0.05"
                      value={quality}
                      onChange={e => setQuality(parseFloat(e.target.value))}
                      className="flex-1 accent-primary"
                      disabled={state === "extracting" || state === "uploading"}
                    />
                    <span className="text-xs font-mono text-primary w-10 text-right">{Math.round(quality * 100)}%</span>
                  </div>
                </div>
              </div>

              {preview.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Onizleme (ilk {preview.length} frame)</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {preview.map((url, i) => (
                      <img key={i} src={url} className="h-16 w-auto rounded-sm flex-shrink-0 border border-border" />
                    ))}
                  </div>
                </div>
              )}

              {(state === "extracting" || state === "uploading") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-mono">
                      {state === "extracting" ? "Frame cekiliyor..." : "Yukleniyor..."}
                    </span>
                    <span className="text-primary font-mono">{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <button
                    onClick={() => { abortRef.current = true; }}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Iptal et
                  </button>
                </div>
              )}

              {state === "done" && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-sm">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-emerald-400 font-medium">
                    {extracted} frame basariyla datasete eklendi!
                  </span>
                  <button onClick={reset} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Yeni video
                  </button>
                </div>
              )}

              {state === "ready" && (
                <button
                  onClick={extractFrames}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:bg-primary/90 transition-colors"
                >
                  <Film className="w-4 h-4" />
                  Frameleri Cek ve Yukle ({estimatedFrames} frame)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
