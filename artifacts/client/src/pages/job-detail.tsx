import { useGetJob, useCancelJob, useResumeJob, useGetDataset, getGetDatasetQueryKey, getGetJobQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Activity, CheckCircle, XCircle, Clock, Pause, Ban, X, Play } from "lucide-react";
import { Link } from "wouter";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  queued:    { icon: Clock,        color: "text-yellow-500",  label: "Queued" },
  running:   { icon: Activity,     color: "text-blue-400",    label: "Running" },
  completed: { icon: CheckCircle,  color: "text-emerald-500", label: "Completed" },
  failed:    { icon: XCircle,      color: "text-red-500",     label: "Failed" },
  cancelled: { icon: Ban,          color: "text-muted-foreground", label: "Cancelled" },
  paused:    { icon: Pause,        color: "text-yellow-400",  label: "Paused" },
};

export default function JobDetail({ params }: { params: { id: string } }) {
  const qc = useQueryClient();
  const { data: job, isLoading } = useGetJob(params.id, {
    query: { queryKey: getGetJobQueryKey(params.id) },
  });
  const { data: dataset } = useGetDataset(job?.dataset_id ?? "", {
    query: {
      queryKey: getGetDatasetQueryKey(job?.dataset_id ?? ""),
      enabled: !!job?.dataset_id,
    },
  });
  const cancelJob = useCancelJob();
  const resumeJob = useResumeJob();

  useEffect(() => {
    if (!job) return;
    if (job.status !== "running" && job.status !== "queued") return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: getGetJobQueryKey(params.id) });
    }, 2000);
    return () => clearInterval(interval);
  }, [job?.status, params.id, qc]);

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <div className="h-8 w-64 bg-card border border-border rounded-sm animate-pulse" />
        <div className="h-32 bg-card border border-border rounded-sm animate-pulse" />
      </div>
    );
  }

  if (!job) {
    return <div className="flex-1 p-6 text-muted-foreground text-sm">Job not found.</div>;
  }

  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.queued;
  const StatusIcon = cfg.icon;
  const pct = job.progress * 100;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/jobs">
            <button className="p-1.5 rounded-sm hover:bg-secondary text-muted-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                {dataset?.name ?? "Auto-Label Job"}
              </h1>
              <div className={`flex items-center gap-1 text-xs font-mono ${cfg.color}`}>
                <StatusIcon className={`w-3.5 h-3.5 ${job.status === "running" ? "animate-pulse" : ""}`} />
                {cfg.label}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{params.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(job.status === "running" || job.status === "queued") && (
            <button
              onClick={() => cancelJob.mutate({ jobId: params.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetJobQueryKey(params.id) }) })}
              disabled={cancelJob.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 text-red-400 text-xs rounded-sm hover:bg-red-500/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
          {job.status === "paused" && (
            <button
              onClick={() => resumeJob.mutate({ jobId: params.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetJobQueryKey(params.id) }) })}
              disabled={resumeJob.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:bg-primary/90 transition-colors"
            >
              <Play className="w-3.5 h-3.5" /> Resume
            </button>
          )}
          {dataset && (
            <Link href={`/review/${job.dataset_id}`}>
              <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs text-muted-foreground rounded-sm hover:text-foreground transition-colors">
                Review Annotations
              </button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-sm p-5 space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Progress</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-foreground tabular-nums">
              {job.processed_images.toLocaleString()} / {job.total_images.toLocaleString()} images
            </span>
            <span className={`font-mono font-bold text-lg ${job.status === "completed" ? "text-emerald-500" : "text-primary"}`}>
              {pct.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${job.status === "completed" ? "bg-emerald-500" : job.status === "failed" ? "bg-red-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {job.failed_images > 0 && (
            <div className="text-xs text-red-400 font-mono">{job.failed_images} images failed to process</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-sm p-4">
          <div className="text-xs text-muted-foreground">Created</div>
          <div className="text-sm font-mono text-foreground mt-1">{new Date(job.created_at).toLocaleString()}</div>
        </div>
        <div className="bg-card border border-border rounded-sm p-4">
          <div className="text-xs text-muted-foreground">Started</div>
          <div className="text-sm font-mono text-foreground mt-1">{job.started_at ? new Date(job.started_at).toLocaleString() : "—"}</div>
        </div>
        <div className="bg-card border border-border rounded-sm p-4">
          <div className="text-xs text-muted-foreground">Completed</div>
          <div className="text-sm font-mono text-foreground mt-1">{job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-sm p-5 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Classes</h3>
        <div className="space-y-1">
          {job.classes.map(c => (
            <div key={c.class_id} className="flex items-center gap-3 py-1">
              <span className="text-xs font-mono text-muted-foreground w-6">{c.class_id}</span>
              <span className="text-xs font-semibold text-foreground">{c.class_name}</span>
              <span className="text-xs text-muted-foreground">{c.prompt}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-sm p-5 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Config</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          {Object.entries(job.config as unknown as Record<string, unknown>).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-border py-1.5">
              <span className="text-xs text-muted-foreground font-mono">{k}</span>
              <span className="text-xs text-foreground font-mono">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>

      {job.error_message && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-sm p-4">
          <div className="text-xs font-semibold text-red-400 mb-1">Error</div>
          <div className="text-xs text-red-300 font-mono">{job.error_message}</div>
        </div>
      )}
    </div>
  );
}
