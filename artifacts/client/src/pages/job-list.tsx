import { useListJobs, useGetDataset } from "@workspace/api-client-react";
import { Activity, CheckCircle, XCircle, Clock, Pause, Ban } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  queued:    { icon: Clock,        color: "text-yellow-500",  label: "Queued" },
  running:   { icon: Activity,     color: "text-blue-400",    label: "Running" },
  completed: { icon: CheckCircle,  color: "text-emerald-500", label: "Done" },
  failed:    { icon: XCircle,      color: "text-red-500",     label: "Failed" },
  cancelled: { icon: Ban,          color: "text-muted-foreground", label: "Cancelled" },
  paused:    { icon: Pause,        color: "text-yellow-400",  label: "Paused" },
};

function DatasetName({ id }: { id: string }) {
  const { data } = useGetDataset(id);
  return <span>{data?.name ?? id.slice(0, 8) + "..."}</span>;
}

export default function JobList() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data, isLoading } = useListJobs({
    page,
    limit: 20,
    ...(statusFilter !== "all" ? { status: statusFilter as "queued" | "running" | "completed" | "failed" | "cancelled" | "paused" } : {}),
  });

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Auto-Label Jobs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data?.total ?? 0} total</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {["all", "queued", "running", "completed", "failed", "cancelled"].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1 text-xs rounded-sm transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-card border border-border rounded-sm animate-pulse" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Activity className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No jobs yet</p>
          <p className="text-xs text-muted-foreground mt-1">Start an auto-label job from a dataset</p>
          <Link href="/datasets">
            <button className="mt-4 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:bg-primary/90 transition-colors">
              Go to Datasets
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {data.items.map(job => {
            const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.queued;
            const Icon = cfg.icon;
            return (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <div className="bg-card border border-border rounded-sm p-4 hover:border-border/80 transition-colors cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color} ${job.status === "running" ? "animate-pulse" : ""}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          <DatasetName id={job.dataset_id} />
                        </span>
                        <span className={`text-xs font-mono ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-muted-foreground ml-auto font-mono">
                          {job.classes.length} {job.classes.length === 1 ? "class" : "classes"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${job.status === "completed" ? "bg-emerald-500" : "bg-primary"}`}
                            style={{ width: `${job.progress * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          {job.processed_images}/{job.total_images}
                        </span>
                        {job.failed_images > 0 && (
                          <span className="text-xs font-mono text-red-500">{job.failed_images} failed</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground font-mono">
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {data && data.total > 20 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">Previous</button>
          <span className="text-xs text-muted-foreground font-mono">{page} / {Math.ceil(data.total / 20)}</span>
          <button disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}
