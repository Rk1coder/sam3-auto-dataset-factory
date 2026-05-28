# Architecture

## Overview

SAM3 Auto Dataset Factory is a monorepo with three main components:

```
sam3-auto-dataset-factory/
├── artifacts/
│   ├── client/          ← React+Vite web UI (served at /)
│   └── api-server/      ← Express.js mock API (served at /api)
├── apps/
│   └── server/          ← Python FastAPI GPU inference server
├── lib/
│   ├── api-spec/        ← OpenAPI 3.1 spec + codegen config
│   ├── api-client-react/ ← TanStack Query hooks (generated)
│   └── api-zod/         ← Zod schemas (generated)
└── docs/
```

## Request flow

```
Browser
  │
  │  HTTP (Replit proxy)
  ▼
Reverse proxy (artifact routing)
  ├── /api/*  → Express mock server (port 8080)
  └── /*      → Vite dev server / built React app (port 20517)

[Production GPU mode]
Browser → Express server → Python FastAPI server (proxied or direct)
       OR
Browser → Python FastAPI server (direct, e.g. Colab ngrok URL)
```

## Data flow for auto-labeling

1. User uploads images via web UI → Express/FastAPI stores files
2. User clicks "Auto-Label" → creates a Job record, starts background task
3. Background task iterates images, calls SAM3 adapter per image
4. SAM3 returns bounding boxes (and optionally masks)
5. Annotations saved as `review_status: "pending"`
6. User opens Review Canvas, accepts/rejects annotations with keyboard shortcuts
7. User exports accepted annotations as YOLO-format zip

## API contract

The `lib/api-spec/openapi.yaml` is the source of truth. Both servers implement this contract.
Run `pnpm --filter @workspace/api-spec run codegen` to regenerate hooks and Zod schemas.

## Mock vs. real mode

| Mode | Backend | Model | Use case |
|------|---------|-------|----------|
| Mock (default) | Express.js | Random boxes | Development, demo |
| Mock Python | FastAPI `USE_MOCK=true` | Random boxes | Python dev without GPU |
| Real GPU | FastAPI `USE_MOCK=false` | SAM3 | Production labeling |

## Key design decisions

- **Contract-first API**: OpenAPI spec defines the interface, both servers must conform.
- **In-memory store for mock mode**: No database required for development.
- **Stateless annotation review**: Review status stored per-annotation, not per-session.
- **YOLO-native export**: Direct YOLO label format, no intermediate conversion needed.
- **Polygon optional**: Bounding boxes always present; segmentation polygons generated if SAM3 mask available.
