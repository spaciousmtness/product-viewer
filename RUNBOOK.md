# Product Viewer — Runbook & Debugging Protocol

> For human operators and AI agents. Covers startup, health checks, diagnostics, and repair.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Browser (localhost:5174)                                │
│  ┌──────────────┐  ┌─────────────────────────────────┐  │
│  │  Left Panel   │  │  Three.js Viewer                │  │
│  │  - DropZone   │  │  - HDRI lighting                │  │
│  │  - Preview    │  │  - OrbitControls                │  │
│  │  - Dossier    │  │  - GLB model loading            │  │
│  │  - Export     │  │  - 4K/8K export renderer        │  │
│  └──────┬───────┘  └─────────────────────────────────┘  │
│         │                                                │
│         │ fetch /api/v1/*                                │
└─────────┼────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  FastAPI Backend (:8000)    │
│  ┌────────────────────────┐ │
│  │ /upload     → temp dir │ │
│  │ /recognize  → Claude   │ │
│  │ /generate   → Tripo3D  │ │
│  │ /status/:id → poll     │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

**Key paths:**
- Frontend source: `~/Desktop/product-viewer/frontend/`
- Backend source: `~/Desktop/product-viewer/backend/`
- Built frontend: `/tmp/product-viewer-dist/`
- HDRI asset: `/tmp/product-viewer-dist/hdri/studio_small_09_1k.hdr`
- Uploaded images: `/tmp/product-viewer-uploads/`
- Backend venv: `~/Desktop/product-viewer/backend/.venv/`
- Backend config: `~/Desktop/product-viewer/backend/.env`

---

## 2. Startup Checklist

### Frontend (static server)
```bash
# Check if already running
lsof -i :5174

# Start if not running
python3 -m http.server 5174 -d /tmp/product-viewer-dist &

# Verify
curl -s http://localhost:5174 | head -5
# Should show <!DOCTYPE html>
```

### Backend (FastAPI)
```bash
# Check if already running
lsof -i :8000

# Verify .env exists with keys
cat ~/Desktop/product-viewer/backend/.env
# Should show TRIPO_API_KEY=... and ANTHROPIC_API_KEY=...

# Start
cd ~/Desktop/product-viewer/backend
.venv/bin/uvicorn app.main:app --reload --port 8000

# Verify
curl -s http://localhost:8000/health
# Should return {"status":"ok"}
```

### Full rebuild (after code changes)
```bash
cd ~/Desktop/product-viewer/frontend
npx vite build --outDir /tmp/product-viewer-dist --emptyOutDir
cp -r public/hdri /tmp/product-viewer-dist/hdri
# Then hard-refresh the browser
```

---

## 3. Health Checks

Run these to verify each layer is working:

| Check | Command | Expected |
|-------|---------|----------|
| Frontend serves | `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174` | `200` |
| HDRI exists | `ls -la /tmp/product-viewer-dist/hdri/studio_small_09_1k.hdr` | ~1.5MB file |
| Backend up | `curl -s http://localhost:8000/health` | `{"status":"ok"}` |
| Upload works | `curl -s -X POST -F "file=@test.jpg" http://localhost:8000/api/v1/upload` | JSON with `fileId` |
| Claude Vision | `curl -s -X POST -H "Content-Type: application/json" -d '{"file_id":"<id>"}' http://localhost:8000/api/v1/recognize` | JSON product dossier |
| Tripo3D | `curl -s -X POST -H "Content-Type: application/json" -d '{"file_id":"<id>"}' http://localhost:8000/api/v1/generate` | JSON with `taskId` |

---

## 4. Common Issues & Fixes

### "Backend not running" error in UI
**Symptom:** Drop an image, get "Backend not running. Start it with..."
**Cause:** Backend on port 8000 isn't started, or .env is missing.
**Fix:**
```bash
cd ~/Desktop/product-viewer/backend
# Check .env exists
ls .env
# Start backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

### HDRI not loading (no reflections, flat lighting)
**Symptom:** Model renders but looks flat, no metallic reflections.
**Cause:** HDRI file missing from build output.
**Fix:**
```bash
mkdir -p /tmp/product-viewer-dist/hdri
cp ~/Desktop/product-viewer/frontend/public/hdri/studio_small_09_1k.hdr /tmp/product-viewer-dist/hdri/
```
**Verify:** Open browser console — should NOT see "HDRI not found, using fallback lighting".

### Build fails: "Could not resolve entry module index.html"
**Cause:** Running vite build from wrong directory.
**Fix:** Must `cd` into frontend first:
```bash
cd ~/Desktop/product-viewer/frontend && npx vite build --outDir /tmp/product-viewer-dist --emptyOutDir
```

### Port already in use
```bash
# Find what's on the port
lsof -i :5174   # or :8000
# Kill it
kill $(lsof -t -i :5174)
```

### Python packages missing
```bash
cd ~/Desktop/product-viewer/backend
.venv/bin/pip install -r <(grep -A100 'dependencies' pyproject.toml | grep '"' | sed 's/.*"\(.*\)".*/\1/')
# Or manually:
.venv/bin/pip install fastapi uvicorn httpx pydantic pydantic-settings python-multipart
```

### Tripo API returns 401
**Cause:** Invalid or expired API key.
**Fix:** Get a new key from https://platform.tripo3d.ai/api-keys, update `.env`.

### Claude Vision returns error
**Cause:** Invalid Anthropic API key, or rate limit.
**Fix:** Check key at https://console.anthropic.com/settings/keys, update `.env`.

### 8K export crashes or produces black image
**Cause:** GPU MAX_RENDERBUFFER_SIZE exceeded.
**Diagnosis:** Open browser console, look for WebGL errors.
**Fix:** The tile-based renderer in `export-renderer.ts` handles this — if it's still failing, the GPU may not support the tile size. Reduce to 4K.

### Model loads but is invisible
**Cause:** Model scale/position is off, or model is at origin but camera is looking elsewhere.
**Fix:** Press `R` to reset camera, or `1` for front view. Check browser console for loading errors.

---

## 5. File-by-File Reference

### Frontend

| File | Purpose | Key exports |
|------|---------|-------------|
| `src/App.tsx` | Pipeline state machine, layout | `App` (default) |
| `src/lib/types.ts` | TypeScript interfaces | `PipelineStage`, `RecognitionResult`, `ExportSettings`, `BackgroundMode` |
| `src/lib/api.ts` | Backend fetch wrapper | `api.uploadImage()`, `api.recognize()`, `api.generate()`, `api.pollStatus()` |
| `src/components/viewer/viewer-engine.ts` | Three.js scene setup | `createProductViewer()` → `ViewerInstance` |
| `src/components/viewer/export-renderer.ts` | Hi-res export + tile stitching | `exportRender()`, `downloadBlob()` |
| `src/components/viewer/ProductViewer.tsx` | React wrapper for Three.js | `ProductViewer` (forwardRef) |
| `src/components/upload/DropZone.tsx` | Drag/drop, paste, URL input | `DropZone` |
| `src/components/upload/ImagePreview.tsx` | Image + product dossier display | `ImagePreview` |
| `src/components/pipeline/PipelineStatus.tsx` | Progress indicators | `PipelineStatus` |
| `src/components/controls/ViewerControls.tsx` | Camera presets, background toggle | `ViewerControls` |
| `src/components/controls/ExportPanel.tsx` | Resolution/format picker | `ExportPanel` |

### Backend

| File | Purpose | Key functions |
|------|---------|---------------|
| `app/main.py` | FastAPI app, CORS, route mounting | lifespan, health endpoint |
| `app/config.py` | Pydantic settings from .env | `config.tripo_api_key`, `config.anthropic_api_key` |
| `app/routes/upload.py` | Image upload + URL download | `POST /upload`, `POST /upload/url` |
| `app/routes/recognize.py` | Claude Vision proxy | `POST /recognize` |
| `app/routes/generate.py` | Tripo3D task creation | `POST /generate` |
| `app/routes/status.py` | Poll generation status | `GET /status/{task_id}` |
| `app/services/vision.py` | Claude API client | `recognize_product(file_id)` |
| `app/services/tripo.py` | Tripo3D API client | `create_task()`, `poll_task()` |

---

## 6. Pipeline Stages (State Machine)

```
idle → uploading → recognizing → generating → loading → viewing → exporting
                                                                      ↓
                                                                   viewing
```

Any stage can → `idle` on error or reset.

| Stage | What happens | Duration |
|-------|-------------|----------|
| `idle` | Waiting for input | — |
| `uploading` | Image sent to backend `/api/v1/upload` | ~1-2s |
| `recognizing` | Claude Vision identifies product | ~3-5s |
| `generating` | Tripo3D creates 3D model (polled every 4s) | 30-90s |
| `loading` | GLB downloaded + parsed by Three.js | ~2-5s |
| `viewing` | Interactive 3D viewer active | indefinite |
| `exporting` | Offscreen render at target resolution | ~1-5s |

---

## 7. Agent Debugging Protocol

For an AI agent maintaining this tool, follow this sequence when something is reported broken:

### Step 1: Triage
```bash
# What's running?
lsof -i :5174 && echo "Frontend OK" || echo "Frontend DOWN"
lsof -i :8000 && echo "Backend OK" || echo "Backend DOWN"
```

### Step 2: Check logs
```bash
# Backend logs (if running with --reload, check terminal)
# Frontend errors: open browser console (F12)
```

### Step 3: Verify assets
```bash
ls -la /tmp/product-viewer-dist/index.html          # Frontend build exists?
ls -la /tmp/product-viewer-dist/hdri/*.hdr           # HDRI exists?
ls -la ~/Desktop/product-viewer/backend/.env         # API keys configured?
```

### Step 4: Test each API endpoint
```bash
# Health
curl http://localhost:8000/health

# Upload a test image
curl -X POST -F "file=@/path/to/test.jpg" http://localhost:8000/api/v1/upload

# Recognition (use fileId from upload)
curl -X POST -H "Content-Type: application/json" \
  -d '{"file_id":"FILE_ID_HERE"}' \
  http://localhost:8000/api/v1/recognize

# Generation
curl -X POST -H "Content-Type: application/json" \
  -d '{"file_id":"FILE_ID_HERE"}' \
  http://localhost:8000/api/v1/generate

# Poll status
curl http://localhost:8000/api/v1/status/TASK_ID_HERE
```

### Step 5: If frontend broken, rebuild
```bash
cd ~/Desktop/product-viewer/frontend
npx vite build --outDir /tmp/product-viewer-dist --emptyOutDir
cp -r public/hdri /tmp/product-viewer-dist/hdri
```

### Step 6: If backend broken, check venv
```bash
cd ~/Desktop/product-viewer/backend
.venv/bin/python -c "from app.main import app; print('imports OK')"
```

---

## 8. API Keys Setup

### Anthropic (Claude Vision)
1. Go to https://console.anthropic.com/settings/keys
2. Create or copy an existing key
3. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`

### Tripo3D (3D generation)
1. Go to https://platform.tripo3d.ai
2. Log in (free tier = 300 credits)
3. Find API Keys in dashboard/settings
4. Add to `.env`: `TRIPO_API_KEY=tsk_...`

### .env location
```
~/Desktop/product-viewer/backend/.env
```

### .env format
```
TRIPO_API_KEY=your_tripo_key
ANTHROPIC_API_KEY=your_anthropic_key
```

---

## 9. Keyboard Shortcuts (Viewer Mode)

| Key | Action |
|-----|--------|
| `R` | Reset camera to default |
| `B` | Cycle background (gradient → white → studio → transparent) |
| `1` | Front camera |
| `2` | 3/4 camera |
| `3` | Top camera |
| `4` | Detail (close-up) camera |

---

## 10. Tech Stack Quick Reference

| Layer | Tech | Version |
|-------|------|---------|
| Frontend framework | React | 19 |
| Build tool | Vite | 7.x |
| 3D engine | Three.js | 0.172+ |
| CSS | Tailwind CSS | 4 |
| Backend | FastAPI | 0.115+ |
| HTTP client | httpx | 0.27+ |
| 3D generation | Tripo3D API | v2 |
| Vision AI | Claude API | claude-sonnet-4-20250514 |
| Model format | GLB (glTF 2.0) | — |
| Python | 3.11+ | venv at backend/.venv |
