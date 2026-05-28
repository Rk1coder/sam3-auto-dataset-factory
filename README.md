# SAM3 Auto Dataset Factory

Production-minded dataset automation workspace for computer vision teams. The project combines a React review console, a contract-first mock API, and a Python FastAPI inference server so you can generate SAM3-assisted annotations, review them quickly, and export YOLO-ready datasets.

Recommended repository name: `sam3-auto-dataset-factory`

## Why This Exists

Creating high-quality computer vision datasets is slow because the work jumps between scripts, notebooks, manual review tools, and export converters. SAM3 Auto Dataset Factory pulls that loop into one workflow:

1. Create a dataset with class prompts and train/val/test splits.
2. Upload images or video-derived frames.
3. Run mock labeling for demos or SAM3 inference for real GPU labeling.
4. Review bounding boxes and polygons in a focused canvas.
5. Export accepted annotations as YOLO detection, segmentation, or combined labels.

## Highlights

- SAM3-oriented auto-labeling flow with prompt-driven classes.
- React + Vite operator console with dashboard, datasets, jobs, review, export, and settings screens.
- Express mock API for no-GPU demos and frontend development.
- Python FastAPI server for local CUDA/MPS machines or Google Colab GPU sessions.
- Contract-first API design with OpenAPI, generated TanStack Query hooks, and generated Zod schemas.
- YOLO-native export pipeline with confidence thresholding and rejected-annotation handling.
- Vercel-ready static frontend deployment through `vercel.json`.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Web UI | React 19, Vite, TypeScript, Wouter, TanStack Query, shadcn/ui-style components |
| Mock API | Express 5, TypeScript, in-memory store |
| GPU API | Python, FastAPI, Pydantic, PyTorch/SAM3 adapter |
| API contract | OpenAPI 3.1, Orval, Zod |
| Package manager | pnpm workspaces |
| Deployment | Vercel for static UI, local/Colab/server GPU endpoint for inference |

## Quick Start

Install dependencies:

```bash
pnpm install
```

Start the mock API:

```bash
pnpm --filter @workspace/api-server dev
```

Start the web app in another terminal:

```bash
pnpm --filter @workspace/client dev
```

Open:

```text
http://localhost:20517
```

By default, the app uses `/api` for the built-in mock workflow. For real inference, open Settings and point the API Server URL to your FastAPI or Colab endpoint.

## GPU Inference Server

Local CUDA/MPS:

```bash
cd apps/server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Windows PowerShell activation:

```powershell
cd apps/server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Useful environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `USE_MOCK` | `true` | Uses mock annotations instead of loading the real model |
| `DEVICE` | `cpu` | PyTorch target such as `cuda:0`, `mps`, or `cpu` |
| `SAM3_MODEL_ID` | `facebook/sam3` | Hugging Face model identifier |
| `HF_TOKEN` | empty | Token for gated model access |
| `API_KEY` | `change-me` | API key sent from the UI settings panel |
| `DATA_ROOT` | `./data` | Uploaded image storage |
| `EXPORT_ROOT` | `./exports` | Generated YOLO zip output |

Google Colab setup is documented in [docs/colab_setup.md](docs/colab_setup.md).

## Vercel Deployment

This repository includes [vercel.json](vercel.json) for the React frontend:

- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm --filter @workspace/client build`
- Output directory: `artifacts/client/dist/public`
- SPA routing: all paths rewrite to `index.html`

The Vercel deployment serves the UI only. Run the mock API, FastAPI server, or Colab tunnel separately, then set the API Server URL in the app's Settings page.

## Project Structure

```text
artifacts/client/          React + Vite web application
artifacts/api-server/      Express mock API for demos and frontend development
apps/server/               Python FastAPI GPU inference server
lib/api-spec/              OpenAPI source of truth
lib/api-client-react/      Generated TanStack Query client
lib/api-zod/               Generated Zod schemas
docs/                      Architecture and setup notes
```

## Projects And Results

This repository is organized as a portfolio-grade engineering project, not just a prototype dump.

| Project area | Implemented result | Optimization path |
| --- | --- | --- |
| Contract-first API | OpenAPI spec drives the generated React client and schema validation. | Add CI checks that fail when generated clients drift from the spec. |
| No-GPU demo workflow | Express mock API seeds datasets, jobs, annotations, exports, and server status. | Add persisted SQLite/Postgres mode for shareable demos. |
| Review workflow | Canvas-based review accepts, rejects, deletes, and reprocesses annotations. | Add batch keyboard actions, uncertainty sorting, and active-learning queues. |
| YOLO export | Export flow supports detection, segmentation, and combined output modes. | Add export validation reports with per-class counts and empty-label warnings. |
| GPU inference | FastAPI server separates SAM3 adapter, mock adapter, job runner, and exporter. | Add model warmup, batch scheduling, GPU memory metrics, and job cancellation persistence. |
| Colab operation | Colab guide supports remote GPU sessions through a public tunnel. | Add a one-click notebook badge and scripted tunnel health checks. |
| Deployment readiness | Replit-specific runtime files were removed; Vercel config added for static UI hosting. | Add GitHub Actions for typecheck, build, API codegen validation, and README link checks. |

## Development Commands

```bash
# Typecheck every workspace package
pnpm run typecheck

# Build all TypeScript packages and the frontend
pnpm run build

# Regenerate generated API packages after OpenAPI edits
pnpm --filter @workspace/api-spec run codegen

# Build only the frontend
pnpm --filter @workspace/client build
```

## API Reference

The REST contract lives in `lib/api-spec/openapi.yaml`.

When the Python server is running:

- Swagger UI: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`

## Repository Preparation Notes

Before pushing to GitHub:

```bash
git init
git add .
git commit -m "chore: prepare open-source SAM3 dataset factory"
git branch -M main
git remote add origin https://github.com/<your-username>/sam3-auto-dataset-factory.git
git push -u origin main
```

Do not commit `node_modules`, `dist`, local datasets, generated exports, `.env` files, or `.vercel`; these are ignored by [.gitignore](.gitignore).

## Roadmap

- Add persistent storage for datasets, images, annotations, jobs, and exports.
- Add GitHub Actions for typecheck, build, and OpenAPI codegen drift detection.
- Add export quality reports with class distribution and split coverage.
- Add batch review ergonomics for large datasets.
- Add model performance telemetry for GPU memory, latency, and throughput.
- Add Docker Compose for local full-stack operation.

## License

MIT
