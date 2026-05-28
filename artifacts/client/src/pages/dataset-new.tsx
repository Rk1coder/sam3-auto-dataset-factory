import { useCreateDataset, getListDatasetsQueryKey } from "@workspace/api-client-react";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type ClassDef = { id: number; name: string; prompt: string; color: string };

const CLASS_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#f97316", "#84cc16"];

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const maybeApiError = error as {
      status?: number;
      message?: string;
      data?: unknown;
    };

    if (maybeApiError.data && typeof maybeApiError.data === "object") {
      const data = maybeApiError.data as { detail?: unknown; error?: unknown; message?: unknown };
      const detail = data.detail ?? data.error ?? data.message;

      if (typeof detail === "string") {
        return detail;
      }

      if (Array.isArray(detail)) {
        return detail
          .map((item) => {
            if (!item || typeof item !== "object") return String(item);
            const record = item as { msg?: unknown; loc?: unknown };
            const loc = Array.isArray(record.loc) ? record.loc.join(".") : undefined;
            const msg = typeof record.msg === "string" ? record.msg : JSON.stringify(item);
            return loc ? `${loc}: ${msg}` : msg;
          })
          .join("; ");
      }
    }

    if (maybeApiError.status) {
      return maybeApiError.message ?? `Request failed with HTTP ${maybeApiError.status}`;
    }

    if (maybeApiError.message) {
      return maybeApiError.message;
    }
  }

  return "Dataset could not be created. Check the API URL, key, and server logs.";
}

export default function DatasetNew() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const createDataset = useCreateDataset();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outputMode, setOutputMode] = useState("bbox_and_segmentation");
  const [promptType, setPromptType] = useState("text");
  const [trainSplit, setTrainSplit] = useState(0.8);
  const [valSplit, setValSplit] = useState(0.1);
  const [errorMessage, setErrorMessage] = useState("");
  const [classes, setClasses] = useState<ClassDef[]>([
    { id: 0, name: "", prompt: "", color: CLASS_COLORS[0] },
  ]);

  function addClass() {
    setClasses(cs => [...cs, { id: cs.length, name: "", prompt: "", color: CLASS_COLORS[cs.length % CLASS_COLORS.length] }]);
  }

  function removeClass(idx: number) {
    setClasses(cs => cs.filter((_, i) => i !== idx).map((c, i) => ({ ...c, id: i })));
  }

  function updateClass(idx: number, field: keyof ClassDef, value: string | number) {
    setClasses(cs => cs.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  const testSplit = parseFloat((1 - trainSplit - valSplit).toFixed(2));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    if (!name.trim()) return;
    const validClasses = classes
      .filter(c => c.name.trim())
      .map(c => ({
        id: c.id,
        name: c.name.trim(),
        prompt: c.prompt.trim() || c.name.trim(),
        color: c.color,
      }));
    if (!validClasses.length) { alert("Add at least one class"); return; }

    createDataset.mutate({
      data: {
        name: name.trim(),
        description: description.trim() || undefined,
        classes: validClasses,
        output_mode: outputMode as "bbox_only" | "segmentation_only" | "bbox_and_segmentation",
        prompt_type: promptType as "text" | "bbox" | "point",
        train_split: trainSplit,
        val_split: valSplit,
        test_split: testSplit,
      },
    }, {
      onSuccess: (ds) => {
        qc.invalidateQueries({ queryKey: getListDatasetsQueryKey() });
        navigate(`/datasets/${ds.id}`);
      },
      onError: (error) => {
        setErrorMessage(getErrorMessage(error));
      },
    });
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/datasets">
            <button className="p-1.5 rounded-sm hover:bg-secondary text-muted-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">New Dataset</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Configure your labeling project</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-card border border-border rounded-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Basic Info</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Dataset Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Drone Detection v1"
                  className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Output Mode</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "bbox_only", label: "Detection", sub: "Bounding boxes only" },
                { value: "segmentation_only", label: "Segmentation", sub: "Polygon masks only" },
                { value: "bbox_and_segmentation", label: "Both", sub: "Bbox + segmentation" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOutputMode(opt.value)}
                  className={`p-3 text-left rounded-sm border transition-colors ${outputMode === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}
                >
                  <div className="text-xs font-semibold text-foreground">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Prompt Type</h2>
            <div className="flex gap-2">
              {[
                { value: "text", label: "Text" },
                { value: "bbox", label: "Bounding Box" },
                { value: "point", label: "Point/Click" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPromptType(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${promptType === opt.value ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Train/Val/Test Split</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="text-xs font-medium text-foreground w-12">Train</label>
                <input type="range" min="0.1" max="0.9" step="0.05" value={trainSplit}
                  onChange={e => { const v = parseFloat(e.target.value); setTrainSplit(v); if (v + valSplit > 0.95) setValSplit(0.95 - v); }}
                  className="flex-1 accent-primary" />
                <span className="text-xs font-mono text-primary w-10 text-right">{(trainSplit * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-xs font-medium text-foreground w-12">Val</label>
                <input type="range" min="0.05" max={0.9 - trainSplit} step="0.05" value={valSplit}
                  onChange={e => setValSplit(parseFloat(e.target.value))}
                  className="flex-1 accent-primary" />
                <span className="text-xs font-mono text-primary w-10 text-right">{(valSplit * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-xs font-medium text-muted-foreground w-12">Test</label>
                <div className="flex-1 h-1.5 bg-secondary rounded-full">
                  <div className="h-full bg-muted-foreground/40 rounded-full" style={{ width: `${testSplit * 100}%` }} />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-10 text-right">{(testSplit * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Classes</h2>
              <button type="button" onClick={addClass} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="w-3 h-3" /> Add class
              </button>
            </div>
            <div className="space-y-2">
              {classes.map((cls, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 w-8">
                    <span className="text-xs font-mono text-muted-foreground">{cls.id}</span>
                    <input type="color" value={cls.color} onChange={e => updateClass(i, "color", e.target.value)}
                      className="w-5 h-5 rounded-sm border-0 cursor-pointer bg-transparent" />
                  </div>
                  <input
                    type="text" value={cls.name} onChange={e => updateClass(i, "name", e.target.value)}
                    placeholder="Class name (e.g. drone)"
                    className="flex-1 bg-background border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="text" value={cls.prompt} onChange={e => updateClass(i, "prompt", e.target.value)}
                    placeholder="SAM3 text prompt (e.g. small fixed-wing drone)"
                    className="flex-1 bg-background border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {classes.length > 1 && (
                    <button type="button" onClick={() => removeClass(i)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={createDataset.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createDataset.isPending ? "Creating..." : "Create Dataset"}
            </button>
            <Link href="/datasets">
              <button type="button" className="px-4 py-2 border border-border text-sm text-muted-foreground rounded-sm hover:text-foreground transition-colors">
                Cancel
              </button>
            </Link>
          </div>
          {errorMessage && (
            <div className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 rounded-sm">
              {errorMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
