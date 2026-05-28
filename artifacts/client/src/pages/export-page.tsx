import { useGetDataset, useCreateExport, useListExports, useGetExport, getGetExportQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Download, CheckCircle, Clock, Activity, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

function ExportStatus({ exportId }: { exportId: string }) {
  const qc = useQueryClient();
  const { data: exp } = useGetExport(exportId, { query: { queryKey: getGetExportQueryKey(exportId) } });

  useEffect(() => {
    if (!exp || exp.status === "completed" || exp.status === "failed") return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: getGetExportQueryKey(exportId) });
    }, 1500);
    return () => clearInterval(interval);
  }, [exp?.status, exportId, qc]);

  if (!exp) return null;

  const icons: Record<string, React.ElementType> = { pending: Clock, running: Activity, completed: CheckCircle, failed: AlertCircle };
  const colors: Record<string, string> = { pending: "text-yellow-500", running: "text-blue-400", completed: "text-emerald-500", failed: "text-red-500" };
  const Icon = icons[exp.status] ?? Clock;

  return (
    <div className="bg-card border border-border rounded-sm p-4 flex items-center gap-3">
      <Icon className={`w-4 h-4 flex-shrink-0 ${colors[exp.status] ?? "text-muted-foreground"} ${exp.status === "running" ? "animate-pulse" : ""}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground capitalize">{exp.format} export</span>
          <span className={`text-xs font-mono ${colors[exp.status]}`}>{exp.status}</span>
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-0.5">
          {exp.image_count} images · {exp.annotation_count} annotations
          {exp.file_size_bytes ? ` · ${(exp.file_size_bytes / 1024 / 1024).toFixed(1)} MB` : ""}
        </div>
      </div>
      {exp.status === "completed" && exp.download_url && (
        <a href={exp.download_url} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:bg-primary/90 transition-colors">
          <Download className="w-3 h-3" /> Download
        </a>
      )}
    </div>
  );
}

export default function ExportPage({ params }: { params: { datasetId: string } }) {
  const qc = useQueryClient();
  const { data: dataset } = useGetDataset(params.datasetId);
  const { data: exports = [] } = useListExports({ datasetId: params.datasetId });
  const createExport = useCreateExport();

  const [format, setFormat] = useState<"detection" | "segmentation" | "both">("both");
  const [minConfidence, setMinConfidence] = useState(0);
  const [includeRejected, setIncludeRejected] = useState(false);
  const [splits, setSplits] = useState<string[]>(["train", "val", "test"]);
  const [latestExportId, setLatestExportId] = useState<string | null>(null);

  function toggleSplit(s: string) {
    setSplits(curr => curr.includes(s) ? curr.filter(x => x !== s) : [...curr, s]);
  }

  function handleExport() {
    createExport.mutate({
      data: {
        dataset_id: params.datasetId,
        format,
        min_confidence: minConfidence,
        include_rejected: includeRejected,
        splits: splits as Array<"train" | "val" | "test">,
      },
    }, {
      onSuccess: (exp) => {
        setLatestExportId(exp.id);
        qc.invalidateQueries({ queryKey: ["exports"] });
      },
    });
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-xl space-y-5">
        <div className="flex items-center gap-3">
          <Link href={`/datasets/${params.datasetId}`}>
            <button className="p-1.5 rounded-sm hover:bg-secondary text-muted-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Export YOLO Dataset</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{dataset?.name}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-sm p-5 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Format</h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "detection" as const, label: "Detection", sub: "YOLO bbox .txt files" },
              { value: "segmentation" as const, label: "Segmentation", sub: "YOLO polygon .txt files" },
              { value: "both" as const, label: "Both", sub: "Two separate folders" },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => setFormat(opt.value)}
                className={`p-3 text-left rounded-sm border transition-colors ${format === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}>
                <div className="text-xs font-semibold text-foreground">{opt.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-sm p-5 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Filters</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-xs font-medium text-foreground w-36">Min confidence</label>
              <input type="range" min="0" max="0.95" step="0.05" value={minConfidence}
                onChange={e => setMinConfidence(parseFloat(e.target.value))} className="flex-1 accent-primary" />
              <span className="text-xs font-mono text-primary w-10 text-right">{(minConfidence * 100).toFixed(0)}%</span>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={includeRejected} onChange={e => setIncludeRejected(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary rounded" />
              <span className="text-xs text-foreground">Include rejected annotations</span>
            </label>
          </div>
        </div>

        <div className="bg-card border border-border rounded-sm p-5 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Splits</h2>
          <div className="flex gap-2">
            {["train", "val", "test"].map(s => (
              <button key={s} type="button" onClick={() => toggleSplit(s)}
                className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${splits.includes(s) ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={createExport.isPending || splits.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          {createExport.isPending ? "Creating export..." : "Export Dataset"}
        </button>

        {latestExportId && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Latest Export</div>
            <ExportStatus exportId={latestExportId} />
          </div>
        )}

        {exports.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Export History</div>
            {(exports as Array<{ id: string }>).map(e => <ExportStatus key={e.id} exportId={e.id} />)}
          </div>
        )}
      </div>
    </div>
  );
}
