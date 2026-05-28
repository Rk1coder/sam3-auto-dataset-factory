import { useState } from "react";
import { FlaskConical, Check, Loader } from "lucide-react";
import { uploadImages } from "@workspace/api-client-react";

type Props = {
  datasetId: string;
  onComplete?: () => void;
};

const SAMPLE_IMAGES = [
  { seed: 42, label: "Manzara" },
  { seed: 87, label: "Sehir" },
  { seed: 133, label: "Hayvanlar" },
  { seed: 200, label: "Teknik" },
  { seed: 315, label: "Insanlar" },
  { seed: 512, label: "Araclar" },
];

export function SampleImageUploader({ datasetId, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(3);
  const [error, setError] = useState("");

  async function uploadSamples() {
    setLoading(true);
    setDone(false);
    setError("");

    const selected = SAMPLE_IMAGES.slice(0, count);
    const fd = new FormData();

    for (const img of selected) {
      try {
        const res = await fetch(`https://picsum.photos/seed/${img.seed}/800/600`);
        const blob = await res.blob();
        fd.append("files", new File([blob], `sample_${img.label.toLowerCase()}_${img.seed}.jpg`, { type: "image/jpeg" }));
      } catch {
        // ignore individual failures
      }
    }

    try {
      const result = await uploadImages(datasetId, { body: fd });
      if (result.uploaded === 0 && result.failed > 0) {
        throw new Error(result.errors.join(", ") || "Ornek gorseller yuklenemedi.");
      }
      setDone(true);
      onComplete?.();
      setTimeout(() => setDone(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ornek gorseller yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-3 bg-card border border-border rounded-sm space-y-2">
      <div className="flex items-center gap-3">
      <FlaskConical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-foreground">Deneme gorseli yukle</span>
        <span className="text-xs text-muted-foreground ml-2">Hizli test icin ornek gorseller</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <select
          value={count}
          onChange={e => setCount(parseInt(e.target.value))}
          disabled={loading}
          className="bg-background border border-border rounded-sm text-xs px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {[1, 3, 6].map(n => (
            <option key={n} value={n}>{n} gorsel</option>
          ))}
        </select>
        <button
          onClick={uploadSamples}
          disabled={loading || done}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs text-muted-foreground rounded-sm hover:text-foreground hover:border-primary/40 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <><Loader className="w-3 h-3 animate-spin" /> Yukleniyor...</>
          ) : done ? (
            <><Check className="w-3 h-3 text-emerald-500" /> <span className="text-emerald-500">Eklendi!</span></>
          ) : (
            <>Yukle</>
          )}
        </button>
      </div>
      </div>
      {error && <p className="text-xs text-red-400 pl-7">{error}</p>}
    </div>
  );
}
