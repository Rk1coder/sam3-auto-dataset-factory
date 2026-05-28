import { useListDatasets, useDeleteDataset, getListDatasetsQueryKey } from "@workspace/api-client-react";
import { Database, Plus, Trash2, ChevronRight, Tag } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function DatasetList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListDatasets({ page, limit: 20 });
  const deleteDataset = useDeleteDataset();
  const qc = useQueryClient();

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete dataset "${name}"? This cannot be undone.`)) return;
    deleteDataset.mutate({ datasetId: id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDatasetsQueryKey() });
      },
    });
  }

  const modeLabels: Record<string, string> = {
    bbox_only: "Detection",
    segmentation_only: "Segmentation",
    bbox_and_segmentation: "Det + Seg",
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Datasets</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <Link href="/datasets/new">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            New Dataset
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-card border border-border rounded-sm animate-pulse" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Database className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No datasets yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first dataset to start labeling</p>
          <Link href="/datasets/new">
            <button className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Dataset
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {data.items.map((ds) => {
            const pct = ds.image_count > 0 ? (ds.annotated_count / ds.image_count) * 100 : 0;
            return (
              <div key={ds.id} className="bg-card border border-border rounded-sm hover:border-border/80 transition-colors group">
                <div className="flex items-center gap-4 p-4">
                  <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/datasets/${ds.id}`}>
                        <span className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer truncate">
                          {ds.name}
                        </span>
                      </Link>
                      <span className="text-xs px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded-sm font-mono">
                        {modeLabels[ds.output_mode] ?? ds.output_mode}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-xs text-muted-foreground font-mono">{ds.image_count} images</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-24 h-1 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">{pct.toFixed(0)}% labeled</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{ds.classes.length} classes</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDelete(ds.id, ds.name)}
                      className="p-1.5 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Link href={`/datasets/${ds.id}`}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.total > 20 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground font-mono">
            {page} / {Math.ceil(data.total / 20)}
          </span>
          <button
            disabled={page >= Math.ceil(data.total / 20)}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
