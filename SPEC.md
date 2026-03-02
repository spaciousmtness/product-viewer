# Product Viewer — Evolving Spec

> This document captures what we've learned by building and using the tool.
> It's written from use, not from imagination. Updated as the tool teaches us what it needs to be.
>
> Last updated: 2026-02-28 (session 2 — added catalog, Best Buy API, multi-angle, STL export)

---

## What is this?

A tool that turns a photograph of a physical product into a research object — identified, dimensioned, rendered in 3D, and exportable for physical fabrication or further design work.

You drop in a photo. The system tells you what it is (brand, model, year, dimensions, materials, cultural context). Then it builds a 3D model you can orbit, export as a hi-res image, or download as an STL for 3D printing.

## Who is it for?

Designers who have strong form intuition but aren't trained in SolidWorks or Rhino. People who understand products deeply — materials, proportions, design lineage — but don't yet have the CAD mental models to work in traditional parametric tools.

This gives them a way in. Photograph an object, understand it dimensionally, see it in 3D, print it, modify it. The tool meets them where they are (a camera, a browser) and takes them where they want to go (physical iteration on form).

## The core loop

```
Photo → Identity → 3D Form → Export → Iterate
```

Each step feeds the next:

1. **Photo**: Drop an image (or multiple angles) of a physical product
2. **Identity**: Claude Vision recognizes the product and builds a dossier — name, brand, model number, dimensions, materials, year, cultural context
3. **3D Form**: The identity text conditions the 3D generation (Tripo3D), so the model knows it's building a "58mm folding knife with cellidor scales" not just "red blob"
4. **Export**: Download as STL (3D printing), GLB (Blender/CAD), or hi-res render (PNG/JPEG up to 8K)
5. **Iterate**: Bring the STL into a CAD tool, modify the bezel, change the case thickness, print the next version

## What's working today (v0.2 → v0.3)

### Product catalog
- Save any product run as a shareable record: `catalog/{slug}/manifest.json` + `photos/` + `models/`
- Manifest includes: visual assessment, identity, verified DB specs, model metadata, provenance
- REST API: `POST /catalog/save`, `GET /catalog`, `GET /catalog/{slug}`
- "Save to catalog" button in the viewer panel
- Catalog lives at `/tmp/product-viewer-catalog/` — each product is a self-contained directory anyone can clone

### Best Buy API integration (wired, needs API key)
- After Claude identifies the product, auto-searches Best Buy for verified specs
- Returns real physical dimensions (height, width, depth in mm), weight, features
- Non-blocking — pipeline continues even if Best Buy is unavailable
- Needs `BESTBUY_API_KEY` in `.env` (free at https://developer.bestbuy.com/)
- 50,000 calls/day on free tier

### Recognition dossier
- Claude Vision identifies the product from a single photo
- Returns: product name, brand, model number, release year, MSRP, dimensions, weight, materials, colorway, condition, manufacturing origin, cultural note, key features, form factor
- This is already good. Needs tuning, not rebuilding.

### Single-image 3D generation
- Tripo3D generates a GLB mesh from one photo
- Recognition text is passed as a prompt to condition the generation
- Result is viewable in a Three.js viewer with HDRI lighting, orbit controls, camera presets

### Multi-angle upload
- Upload up to 4 images labeled front/left/back/right
- Uses Tripo's multiview_to_model API for better reconstruction
- Front is required, others are optional
- Should dramatically improve back/side fidelity (the single-image model had a wrong back)

### 3D export
- STL download (binary, for 3D printing)
- GLB download (preserves materials/textures, for Blender/Fusion 360)
- Original Tripo model download
- Hi-res image export: 1080p, 4K, 8K, Square 4K, Instagram — PNG or JPEG, optional transparent background

### Viewer
- Three.js with 35mm telephoto camera (product photography feel)
- HDRI environment map for realistic reflections
- Key/fill/rim lighting setup
- Shadow-catching ground plane
- Keyboard shortcuts: R (reset), B (cycle background), 1-4 (camera presets)
- Background modes: gradient, white, studio HDRI, transparent

## What's not working yet / known gaps

### 3D quality
- AI-generated meshes are approximate, not CAD-quality
- Single fused mesh — can't select "bezel" vs "case" vs "screen" as separate bodies
- Triangle soup topology, not clean quads
- No sharp edges or proper fillets
- Proportions are close but not dimensionally accurate

### The real use case we're building toward
> "I want to drop in an image of the Daylight Computer and get a full hi-def STL so I can bring that to another tool to change some of the specs on the bezel or rear case for the next gen."

This requires:
- Mesh segmentation (identify bezel, case, screen as separate parts)
- Real-world scaling (use dimensions from dossier to set actual mm scale)
- Cleaner topology (remesh or CAD-trace the AI output)
- Possibly: reference 3D models from product databases instead of generating from scratch

### Product knowledge layer
Recognition is good but it's Claude working from its training data. For deeper research, we want to pipe in external databases:

**High priority:**
- ICECAT — open product catalog with detailed specs for electronics/consumer goods. API available, lookup by EAN/UPC/model number
- Best Buy API — 1M+ products with specs, dimensions, images. Free API key.

**For 3D references:**
- Sketchfab API — 1M+ downloadable 3D models. If the exact product exists, use that instead of generating
- Thingiverse API — 3D printable models, good for seeing what's already been made
- Amazon Berkeley Objects — research dataset with 8K real product 3D meshes + 400K images

**For industrial/component-level:**
- TraceParts — 100M+ CAD models for mechanical parts, true-to-scale
- Octopart/Nexar — electronic components with datasheets and physical dimensions

The play: Claude identifies the product → look it up in ICECAT/Best Buy for exact specs → search Sketchfab for existing 3D model → if found, use that (CAD quality); if not, generate with Tripo conditioned by the full spec sheet.

## Architecture

```
Browser (:5174)                     FastAPI (:8000)
┌─────────────────────┐             ┌──────────────────────────┐
│ React 19 + Three.js │──fetch──→   │ /upload    → temp dir    │
│ Vite + Tailwind 4   │             │ /recognize → Claude API  │
│                     │             │ /generate  → Tripo3D API │
│ Upload (single or   │             │ /status    → poll task   │
│  multi-angle)       │             │                          │
│ Recognition dossier │             │ Recognition text feeds   │
│ 3D viewer           │             │ into generation prompt   │
│ Export panel         │             │                          │
│ (image/STL/GLB)     │             │ Future: product DB       │
└─────────────────────┘             │ lookups before generate  │
                                    └──────────────────────────┘
```

### Pipeline stages
```
idle → uploading → recognizing → generating → loading → viewing ⇄ exporting
```
Any stage can reset to idle on error. Errors persist as a dismissable banner even after reset.

### Key design decisions made so far
- **Backend holds API keys** — frontend never touches Tripo or Anthropic directly
- **Recognition before generation** — identity informs the 3D model, not the other way around
- **Prompt conditioning is free** — just a text field on the existing Tripo API call
- **Multi-angle is additive** — single image still works, extra angles improve quality
- **STL for printing, GLB for editing** — two export paths for two workflows
- **Demo mode** — loads sample model without backend, so frontend can be tested independently

## Tech stack

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | React 19 + Vite 7 | Fast dev, hot reload |
| 3D | Three.js 0.183 | STLExporter, GLTFExporter, GLTFLoader built in |
| Styles | Tailwind 4 | Utility CSS, no design system needed yet |
| Backend | FastAPI + Python | Async, easy to extend, good for API proxying |
| Vision | Claude API (claude-sonnet-4-20250514) | Best-in-class product recognition |
| 3D gen | Tripo3D API v2 | image_to_model + multiview_to_model |
| Model format | GLB (glTF 2.0) | Universal, works everywhere |

## What to build next (in priority order)

### 1. Real-world dimension scaling
Use the dimensions from the recognition dossier (e.g. "58mm x 18mm x 9mm") to scale the exported STL to actual millimeters. Right now the model is arbitrarily scaled. This is the simplest change that makes the STL actually useful for fabrication.

### 2. Product database integration
Start with ICECAT or Best Buy API. After Claude identifies the product, look it up for verified specs. This supplements Claude's knowledge with ground-truth data — exact dimensions, weight, full spec sheets.

### 3. Existing 3D model search
After identification, search Sketchfab/Thingiverse for existing 3D models of that exact product. If a CAD-quality model exists, offer it as an alternative to AI generation. Much higher fidelity for known products.

### 4. Mesh cleanup / remeshing
Post-process the AI-generated mesh to improve topology. Options: Instant Meshes (open source quad remesher), Blender remesh via Python API, or a cleanup service. Goal: cleaner geometry that's easier to modify in CAD tools.

### 5. Mesh segmentation
Use Claude to analyze the 3D model + original photos and identify regions (bezel, case, screen, buttons). Export each as a separate STL body. This is what unlocks "change the bezel specs" as a workflow.

### 6. Design lineage / morphology comparison
Load multiple generations of the same product side by side. Compare form evolution. This is the "industrial design archaeology" use case — every iPhone, every Braun calculator, every Leica body.

## How this spec gets updated

This document evolves by use. When you try something and discover a gap, a need, or a better way — that goes here. The spec follows the tool, not the other way around.

```
Use the tool → Notice something → Say it out loud → Build it → Write it down
```

That's the process. This document is the "write it down" step.
