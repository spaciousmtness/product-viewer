import base64
import json
import os

import httpx

from app.config import config

RECOGNITION_PROMPT = """You are a product identification expert specializing in both consumer electronics and professional instruments. Analyze this image and create a complete product dossier.

Identify the EXACT product — not just the category, but the specific model, generation, and variant.

## Identification strategy

Study every visual clue systematically:
- **Markings**: Brand logo style/placement, model number plates, serial number stickers, regulatory marks (CE, FCC, UL), certification labels
- **Physical form**: Proportions, port layout, button arrangement, display type, connector shapes, aperture/lens design
- **Materials & finish**: Plastic type (ABS vs polycarbonate), metal finish (brushed vs anodized), rubber grips, optical glass coatings
- **Wear & era**: Logo font evolution, manufacturing marks, patina, yellowing, screw types, design language era

## Category awareness

Be especially precise with these categories — they are commonly encountered:

**Measurement & test instruments**: spectrophotometers (Konica Minolta CM-700D, X-Rite i1Pro), colorimeters (X-Rite i1Display, Calibrite ColorChecker), light meters (Sekonic L-858D, Konica Minolta CL-500A), luminance meters, gloss meters, spectroradiometers, multimeters (Fluke, Keysight), oscilloscopes (Tektronix, Rigol), LCR meters, power analyzers, thermal cameras (FLIR)

**Optical & display testing**: goniophotometers, integrating spheres, haze meters, contrast ratio meters, display analyzers (Konica Minolta CA-410), BRDF measurement systems

**Dimensional & mechanical tools**: digital calipers (Mitutoyo), micrometers, CMMs, surface roughness testers (Mitutoyo SJ-series), hardness testers, force gauges, torque wrenches, 3D scanners (Artec, Revopoint)

**Prototyping & fabrication**: 3D printers (Formlabs, Bambu Lab, Prusa), laser cutters (Glowforge, Epilog), CNC mills (Bantam Tools, Haas), resin printers, PCB mills

**Computing & development**: single-board computers (Raspberry Pi, BeagleBone), dev kits (ESP32, Arduino, STM32), e-ink displays, FPGA boards, logic analyzers

**Cameras & imaging**: film cameras (Pentax K1000, Nikon FM2), digital cameras, machine vision cameras, microscopes, borescopes

**Consumer electronics**: laptops, tablets, phones, keyboards, mice, monitors, speakers, headphones

If the object has a **measurement aperture**, **optical port**, **calibration tile**, **probe tip**, or **test leads** — it is almost certainly a scientific instrument. Identify the exact measurement principle (spectral, goniophotometric, interferometric, etc.).

## Output format

Return a JSON object with ALL fields (use null for unknowns):

{
  "productName": "Full name with model (e.g., 'Konica Minolta CM-700D Spectrophotometer')",
  "brand": "Brand name (parent company if relevant, e.g., 'Konica Minolta')",
  "category": "Specific category (e.g., 'Portable Sphere Spectrophotometer', not just 'Instrument')",
  "subcategory": "Broader grouping (e.g., 'Color Measurement', 'Display Testing', 'Prototyping')",
  "modelNumber": "Exact model/part number (e.g., 'CM-700D', 'SJ-210')",
  "formFactor": "Physical description for 3D reconstruction (shape, proportions, key geometry, grip areas, aperture locations)",
  "features": ["distinctive", "visual", "features", "for 3D modeling"],
  "technicalSpecs": "Key measurement specs if identifiable (e.g., 'SCE/SCI, 400-700nm, d/8° geometry, 8mm aperture')",
  "materials": ["material 1", "material 2"],
  "dimensions": "Approximate dimensions in mm (e.g., '79 x 244 x 103 mm')",
  "weight": "Approximate weight (e.g., '550g with batteries')",
  "colorway": "Color variant name",
  "interfaces": ["USB", "Bluetooth", "RS-232"],
  "accessories": "Visible accessories (calibration tiles, probes, cases, cables)",
  "yearRange": "Estimated production era (e.g., '2006-2015')",
  "releaseYear": 2006,
  "msrpAtRelease": "$XX.XX USD at launch",
  "currentValue": "Approximate current market value if known",
  "manufacturingOrigin": "Country/city of manufacture",
  "condition": "Assessment of this specific specimen",
  "culturalNote": "Significance — why this product matters in its field",
  "searchHint": "Best search query for finding this in product databases (brand + model)"
}

Be precise. If you see a Konica Minolta handheld with a white measurement aperture, that's a CM-series spectrophotometer — identify the exact model from the body shape and markings. If you see a Pentax with a K-mount and no electronics, that's a K1000 — say so with confidence.

Return ONLY the JSON, no other text."""


RESEARCH_PROMPT = """You are a product research expert. Using your knowledge, create a complete product dossier for the following product:

**{product_name}**

Research everything you know about this product — exact specifications, dimensions, production history, variants, use cases, and significance. Be as precise as a product engineer would need.

""" + RECOGNITION_PROMPT.split("## Output format")[1].split("Return ONLY")[0] + """

For the "condition" field, use "N/A — text research" since no physical specimen is being examined.
For the "formFactor" field, describe the physical form in enough detail for 3D reconstruction.

Return ONLY the JSON, no other text."""

MANUAL_PROMPT = """You are a product research expert. A user has provided a product manual or datasheet. Extract every technical specification, physical dimension, and product detail from this document.

The product is: **{product_name}**

Read the document carefully and extract:
- Exact physical dimensions (mm), weight (g)
- All technical specifications (measurement ranges, accuracy, resolution, geometry)
- Interface/connectivity options
- Accessories included
- Operating conditions
- Model variants mentioned
- Any other engineering-relevant data

""" + RECOGNITION_PROMPT.split("## Output format")[1].split("Return ONLY")[0] + """

Use the EXACT values from the document — do not approximate. If the document gives dimensions as "approximately 79 × 244 × 103 mm", use "79 x 244 x 103 mm".
For the "condition" field, use "N/A — from manual/datasheet".

Return ONLY the JSON, no other text."""


MULTI_CANDIDATE_PROMPT = """You are a product identification expert with a designer's eye. Analyze this image and provide your TOP 3 best guesses for what this product is, ranked by confidence.

## Identification strategy

Study every visual clue systematically:

### The product itself
- **Markings**: Brand logo style/placement, model number plates, serial number stickers, regulatory marks (CE, FCC, UL), certification labels
- **Physical form**: Proportions, port layout, button arrangement, display type, connector shapes, aperture/lens design
- **Bezel & edges**: Bezel thickness, corner radius, edge treatment (chamfered, rounded, flat), frame-to-screen ratio — these are fingerprints that distinguish similar-looking products
- **Materials & finish**: Plastic type (ABS vs polycarbonate), metal finish (brushed vs anodized), rubber grips, optical glass coatings
- **Accessories in frame**: Stylus, keyboard, case, cable — these narrow the field significantly

### The photograph itself (meta-signals)
- **Photography style**: Press/marketing shot (styled, lit, on-surface) vs product listing (white background, isolated) vs user photo (casual, in-situ). Indie/startup brands use editorial-style photography with lifestyle surfaces (wood, concrete, fabric). Mass-market brands use clean white or gradient backgrounds.
- **Staging & context**: What surface is it on? What's around it? A device on a wooden desk with a stylus beside it signals a different market segment than a device floating on white.
- **Image quality & art direction**: Professional product photography with intentional composition suggests a brand that invests in design. This points toward premium or niche products, not commodity electronics.
- **Screen content**: What's displayed on the screen? Article text, UI elements, and app content can identify the operating system and use case.

### Reasoning about market segment
- A device that LOOKS like a Kindle but is photographed like a startup press shot is probably NOT a Kindle — it's more likely reMarkable, Daylight Computer, Boox, Supernote, or another niche e-ink device
- The most famous product in a category is not always the most likely answer — consider the full landscape of similar products
- New/indie hardware products (2020+) are frequently encountered here: Daylight Computer DC-1, reMarkable 2, Framework Laptop, Teenage Engineering products, Analogue Pocket, etc.

## IMPORTANT: Do NOT over-commit

If the product is ambiguous, niche, or could be confused with something more common, LOWER your confidence and include the alternatives. Common mistakes:
- Mistaking niche/indie products for mass-market lookalikes (e.g., Daylight DC-1 vs Kindle, reMarkable vs generic tablet)
- Defaulting to the most famous brand when the logo is not clearly visible
- Ignoring subtle distinguishing details (port layout, button placement, screen technology, bezel design)
- Ignoring photographic context (a lifestyle press shot on wood ≠ an Amazon listing photo)

If you are not 90%+ certain, your top confidence MUST be below 0.9.

## Output format

Return a JSON object with exactly this structure:

{
  "candidates": [
    {
      "productName": "Most likely product — Full name with model",
      "brand": "Brand name",
      "confidence": 0.75,
      "reasoning": "One sentence explaining why this is your top pick and what visual evidence supports it"
    },
    {
      "productName": "Second most likely product",
      "brand": "Brand name",
      "confidence": 0.15,
      "reasoning": "One sentence on what makes this a possibility"
    },
    {
      "productName": "Third possibility",
      "brand": "Brand name",
      "confidence": 0.10,
      "reasoning": "One sentence on why this is worth considering"
    }
  ]
}

Rules:
- Confidence scores MUST sum to approximately 1.0 (within 0.05)
- Always return exactly 3 candidates, even if you are very confident
- If confident, the gap between #1 and #2 can be large (e.g., 0.92, 0.05, 0.03)
- If uncertain, distribute more evenly (e.g., 0.45, 0.35, 0.20)
- Never give 1.0 confidence to any single candidate

Return ONLY the JSON, no other text."""

MULTI_CANDIDATE_RESEARCH_PROMPT = """You are a product research expert. The user searched for:

**{product_name}**

This name might be ambiguous, abbreviated, or refer to multiple products. Identify the TOP 3 most likely products this could refer to, considering:
- Common abbreviations and shorthand (e.g., "DC-1" could be Daylight Computer DC-1, Sega Dreamcast, etc.)
- Products with similar names across different brands/categories
- Historical vs current products with the same designation
- Context: a designer/engineer searching in 2026 likely means the most relevant current product

## Output format

Return a JSON object with exactly this structure:

{
  "candidates": [
    {
      "productName": "Most likely match — Full official product name",
      "brand": "Brand name",
      "confidence": 0.60,
      "reasoning": "Why this is the most likely interpretation"
    },
    {
      "productName": "Second interpretation",
      "brand": "Brand name",
      "confidence": 0.25,
      "reasoning": "Why someone might mean this product"
    },
    {
      "productName": "Third interpretation",
      "brand": "Brand name",
      "confidence": 0.15,
      "reasoning": "Another plausible interpretation"
    }
  ]
}

Rules:
- Confidence scores MUST sum to approximately 1.0
- Always return exactly 3 candidates
- For unambiguous names (e.g., "iPhone 15 Pro Max"), top confidence can be high but still provide alternatives
- Never give 1.0 confidence to any single candidate

Return ONLY the JSON, no other text."""

CONFIRMED_DOSSIER_PROMPT = """You are a product identification expert. The user has confirmed that the product is:

**{confirmed_name}** by **{confirmed_brand}**

Create a complete product dossier for this SPECIFIC product. Do not second-guess the identification — the user has confirmed it. Focus on accuracy and detail.

""" + RECOGNITION_PROMPT.split("## Output format")[1]


def _find_file(file_id: str) -> str:
    """Find an uploaded file by its ID prefix."""
    upload_dir = config.upload_dir
    for f in os.listdir(upload_dir):
        if f.startswith(file_id):
            return os.path.join(upload_dir, f)
    raise ValueError(f"File not found for id: {file_id}")


async def _call_claude(content: list, max_tokens: int = 2048) -> dict:
    """Call Claude API and parse the JSON response."""
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": config.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": content}],
            },
        )
        if resp.status_code != 200:
            error_body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            raise ValueError(
                f"Anthropic API error {resp.status_code}: "
                f"{error_body.get('error', {}).get('message', resp.text[:200])}"
            )

    result = resp.json()
    text = result["content"][0]["text"]

    return _parse_json_response(text)


def _parse_json_response(text: str) -> dict:
    """Parse JSON from Claude's response, handling code blocks and whitespace."""
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code block
    if "```" in text:
        # Find content between first ``` and next ```
        parts = text.split("```")
        for part in parts[1::2]:  # odd-indexed parts are inside code blocks
            cleaned = part.strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                continue

    # Try finding JSON object in the text
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from response: {text[:100]}...")


async def recognize_product(file_id: str) -> dict:
    """Send image to Claude Vision for deep product identification."""
    image_path = _find_file(file_id)

    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode()

    ext = os.path.splitext(image_path)[1].lower()
    media_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext, "image/jpeg")

    content = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": image_data},
        },
        {"type": "text", "text": RECOGNITION_PROMPT},
    ]

    return await _call_claude(content)


async def research_product(product_name: str) -> dict:
    """Research a product by name using Claude's knowledge. No image needed."""
    prompt = RESEARCH_PROMPT.replace("{product_name}", product_name)
    content = [{"type": "text", "text": prompt}]
    return await _call_claude(content)


async def research_with_manual(product_name: str, file_id: str) -> dict:
    """Research a product using an uploaded PDF manual/datasheet."""
    file_path = _find_file(file_id)

    with open(file_path, "rb") as f:
        file_data = base64.standard_b64encode(f.read()).decode()

    ext = os.path.splitext(file_path)[1].lower()
    prompt = MANUAL_PROMPT.replace("{product_name}", product_name)

    if ext == ".pdf":
        content = [
            {
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": file_data},
            },
            {"type": "text", "text": prompt},
        ]
    else:
        # Treat as image (could be a screenshot of a spec sheet)
        media_type = {
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".webp": "image/webp",
        }.get(ext, "image/jpeg")
        content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": file_data},
            },
            {"type": "text", "text": prompt},
        ]

    return await _call_claude(content, max_tokens=4096)


async def recognize_candidates(file_id: str) -> dict:
    """Send image to Claude Vision for multi-candidate identification."""
    image_path = _find_file(file_id)

    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode()

    ext = os.path.splitext(image_path)[1].lower()
    media_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext, "image/jpeg")

    content = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": image_data},
        },
        {"type": "text", "text": MULTI_CANDIDATE_PROMPT},
    ]

    return await _call_claude(content)


async def research_candidates(product_name: str) -> dict:
    """Research a product name and return multiple candidate interpretations."""
    prompt = MULTI_CANDIDATE_RESEARCH_PROMPT.replace("{product_name}", product_name)
    content = [{"type": "text", "text": prompt}]
    return await _call_claude(content)


async def confirm_product(
    confirmed_name: str, confirmed_brand: str | None = None, file_id: str | None = None
) -> dict:
    """Generate a full dossier for a confirmed product identity.

    If file_id is provided, includes the image for visual details (condition, etc.).
    Otherwise does text-only research.
    """
    prompt = CONFIRMED_DOSSIER_PROMPT.replace(
        "{confirmed_name}", confirmed_name
    ).replace("{confirmed_brand}", confirmed_brand or "Unknown")

    if file_id:
        image_path = _find_file(file_id)
        with open(image_path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode()
        ext = os.path.splitext(image_path)[1].lower()
        media_type = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }.get(ext, "image/jpeg")
        content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": image_data},
            },
            {"type": "text", "text": prompt},
        ]
    else:
        content = [{"type": "text", "text": prompt}]

    return await _call_claude(content)
