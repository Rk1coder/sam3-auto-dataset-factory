import { useGetServerInfo } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Cpu, CheckCircle, XCircle, AlertCircle, Save } from "lucide-react";
import { normalizeApiUrl } from "@/lib/api-config";

function getConnectionErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: number }).status;
    if (status === 403) return "API key rejected. Check the key from your Colab output.";
    if (status === 404) return "API path not found. Paste the ngrok root URL, not the /api/docs URL.";
    if (typeof status === "number") return `Server returned HTTP ${status}. Check the Colab output.`;
  }

  return "Cannot reach server. Check that the ngrok URL is current and uses https.";
}

export default function Settings() {
  const [apiUrl, setApiUrl] = useState(() => normalizeApiUrl(localStorage.getItem("sam3_api_url")));
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("sam3_api_key") ?? "");
  const [saved, setSaved] = useState(false);

  const { data: serverInfo, isLoading, isError, error, refetch } = useGetServerInfo();

  function handleSave() {
    const normalizedUrl = normalizeApiUrl(apiUrl);
    localStorage.setItem("sam3_api_url", normalizedUrl);
    localStorage.setItem("sam3_api_key", apiKey.trim());
    setApiUrl(normalizedUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    window.location.reload();
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configure your SAM3 inference server connection</p>
        </div>

        <div className="bg-card border border-border rounded-sm p-5 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Server Connection</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">API Server URL</label>
              <input
                type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)}
                placeholder="http://localhost:8000 or /api for built-in mock"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Use <code className="font-mono text-foreground">/api</code> for the built-in mock server, or enter your Colab/A5000 URL</p>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">API Key</label>
              <input
                type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="Leave empty for local development"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Required when using a public Colab or ngrok URL (X-API-Key header)</p>
            </div>
          </div>
          <button onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:bg-primary/90 transition-colors">
            <Save className="w-3.5 h-3.5" />
            {saved ? "Saved!" : "Save & Reload"}
          </button>
        </div>

        <div className="bg-card border border-border rounded-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Model Status</h2>
            <button onClick={() => refetch()} className="text-xs text-primary hover:underline">Refresh</button>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-6 bg-secondary rounded-sm animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <XCircle className="w-4 h-4" />
              {getConnectionErrorMessage(error)}
            </div>
          ) : serverInfo ? (
            <div className="space-y-2">
              {[
                { label: "Status", value: serverInfo.status },
                { label: "Device", value: serverInfo.device },
                { label: "Model", value: serverInfo.model_name },
                { label: "Mock Mode", value: String(serverInfo.mock_mode) },
                { label: "Model Loaded", value: String(serverInfo.model_loaded) },
                { label: "Max Batch Size", value: String(serverInfo.max_batch_size) },
                { label: "GPU Memory", value: serverInfo.available_memory_gb != null ? `${serverInfo.available_memory_gb.toFixed(1)} GB` : "N/A" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between border-b border-border py-1.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs font-mono text-foreground">{value}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2">
                {serverInfo.model_loaded
                  ? <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs text-emerald-500">SAM3 model ready</span></>
                  : serverInfo.mock_mode
                    ? <><AlertCircle className="w-4 h-4 text-yellow-500" /><span className="text-xs text-yellow-500">Mock adapter active (no GPU)</span></>
                    : <><XCircle className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Model not loaded</span></>
                }
              </div>
            </div>
          ) : null}
        </div>

        <div className="bg-card border border-border rounded-sm p-5 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">GPU Server Setup</h2>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>To use real SAM3 inference, start the Python FastAPI server on a GPU machine:</p>
            <pre className="bg-background border border-border rounded-sm p-3 font-mono text-foreground overflow-x-auto text-xs">
{`cd apps/server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export HF_TOKEN=your_token
export DEVICE=cuda:0
uvicorn app.main:app --host 0.0.0.0 --port 8000`}
            </pre>
            <p>For Colab, see <code className="font-mono text-foreground">docs/colab_setup.md</code> in the repository.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
