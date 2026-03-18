"""Materials properties lookup service.

Provides material property data for common manufacturing materials.
Uses a built-in database of common product materials with specific grades,
density, tensile strength, thermal properties, and typical applications.
"""

import logging

logger = logging.getLogger(__name__)

# Comprehensive material grades database — common product materials
# mapped to specific grades with engineering properties.
MATERIAL_GRADES: dict[str, dict] = {
    "abs": {
        "name": "ABS (Acrylonitrile Butadiene Styrene)",
        "typical_grade": "Cycolac MG47",
        "material_type": "Thermoplastic",
        "density_g_cm3": 1.05,
        "tensile_strength_mpa": 44,
        "elongation_at_break_pct": 25,
        "heat_deflection_c": 98,
        "thermal_conductivity_w_mk": 0.17,
        "glass_transition_c": 105,
        "common_applications": [
            "Consumer electronics housings",
            "Keyboard keycaps",
            "LEGO bricks",
            "Automotive trim",
            "Appliance housings",
        ],
        "surface_finishes": ["Matte", "Gloss", "Textured (VDI 3400)"],
        "moldability": "Excellent — low shrinkage (0.4-0.7%)",
        "recyclable": True,
        "uv_resistance": "Poor — requires UV stabilizer for outdoor use",
    },
    "polycarbonate": {
        "name": "PC (Polycarbonate)",
        "typical_grade": "Makrolon 2405",
        "material_type": "Thermoplastic",
        "density_g_cm3": 1.20,
        "tensile_strength_mpa": 63,
        "elongation_at_break_pct": 110,
        "heat_deflection_c": 132,
        "thermal_conductivity_w_mk": 0.20,
        "glass_transition_c": 147,
        "common_applications": [
            "Phone cases",
            "Safety glasses",
            "LED light covers",
            "Medical devices",
            "Laptop housings",
        ],
        "surface_finishes": ["Crystal clear", "Matte", "Textured"],
        "moldability": "Good — moderate shrinkage (0.5-0.7%)",
        "recyclable": True,
        "uv_resistance": "Moderate — yellows over time without stabilizer",
    },
    "pc/abs": {
        "name": "PC/ABS Blend",
        "typical_grade": "Bayblend T65 XF",
        "material_type": "Thermoplastic Blend",
        "density_g_cm3": 1.12,
        "tensile_strength_mpa": 55,
        "elongation_at_break_pct": 80,
        "heat_deflection_c": 115,
        "thermal_conductivity_w_mk": 0.19,
        "common_applications": [
            "Laptop housings (Thinkpad, Dell)",
            "Automotive interiors",
            "Power tool housings",
            "Monitor bezels",
        ],
        "surface_finishes": ["Soft-touch", "Matte", "Textured"],
        "moldability": "Excellent — best of both PC and ABS",
        "recyclable": True,
    },
    "aluminum": {
        "name": "Aluminum 6061-T6",
        "typical_grade": "6061-T6 (most common consumer electronics enclosure)",
        "material_type": "Non-ferrous Metal",
        "density_g_cm3": 2.70,
        "tensile_strength_mpa": 310,
        "yield_strength_mpa": 276,
        "elongation_at_break_pct": 12,
        "thermal_conductivity_w_mk": 167,
        "melting_point_c": 582,
        "common_applications": [
            "MacBook unibody enclosures",
            "Smartphone frames",
            "Heat sinks",
            "Drone frames",
            "Camera bodies",
        ],
        "surface_finishes": ["Anodized Type II", "Anodized Type III (hard)", "Brushed", "Bead-blasted", "Polished"],
        "machinability": "Excellent — CNC machinable",
        "recyclable": True,
        "corrosion_resistance": "Good — excellent with anodizing",
    },
    "stainless steel": {
        "name": "Stainless Steel 304",
        "typical_grade": "304 (18/8, most common consumer grade)",
        "material_type": "Ferrous Metal",
        "density_g_cm3": 8.00,
        "tensile_strength_mpa": 515,
        "yield_strength_mpa": 205,
        "elongation_at_break_pct": 40,
        "thermal_conductivity_w_mk": 16.2,
        "melting_point_c": 1400,
        "common_applications": [
            "Watch cases and bands",
            "Appliance panels",
            "Kitchen equipment",
            "Medical instruments",
            "Fasteners",
        ],
        "surface_finishes": ["Mirror polish", "Brushed (#4)", "Bead-blasted", "PVD coated"],
        "machinability": "Moderate — work hardens",
        "recyclable": True,
        "corrosion_resistance": "Excellent",
    },
    "glass": {
        "name": "Corning Gorilla Glass / Soda-lime",
        "typical_grade": "Gorilla Glass Victus 2 (mobile) or Soda-lime (general)",
        "material_type": "Amorphous Solid",
        "density_g_cm3": 2.54,
        "tensile_strength_mpa": 800,  # Gorilla Glass
        "thermal_conductivity_w_mk": 1.0,
        "common_applications": [
            "Smartphone screens",
            "Tablet displays",
            "Smartwatch faces",
            "Camera lens covers",
            "Display panels",
        ],
        "surface_finishes": ["Anti-reflective (AR)", "Oleophobic", "Anti-glare (AG)"],
        "recyclable": True,
        "scratch_resistance": "Excellent (Mohs 6-7 for Gorilla Glass)",
    },
    "nylon": {
        "name": "Nylon 6/6 (Polyamide)",
        "typical_grade": "Zytel 101L NC010",
        "material_type": "Thermoplastic",
        "density_g_cm3": 1.14,
        "tensile_strength_mpa": 82,
        "elongation_at_break_pct": 50,
        "heat_deflection_c": 75,
        "thermal_conductivity_w_mk": 0.25,
        "melting_point_c": 262,
        "common_applications": [
            "Gear mechanisms",
            "Cable ties",
            "Structural brackets",
            "Connector housings",
            "Fan blades",
        ],
        "surface_finishes": ["Natural (translucent)", "Glass-filled matte"],
        "moldability": "Good — absorbs moisture (condition before molding)",
        "recyclable": True,
    },
    "silicone": {
        "name": "LSR (Liquid Silicone Rubber)",
        "typical_grade": "Dow Corning Silastic 9280/60",
        "material_type": "Thermoset Elastomer",
        "density_g_cm3": 1.15,
        "tensile_strength_mpa": 9,
        "elongation_at_break_pct": 600,
        "heat_deflection_c": 200,
        "thermal_conductivity_w_mk": 0.27,
        "common_applications": [
            "Wearable bands (Apple Watch)",
            "Seals and gaskets",
            "Button pads",
            "Medical devices",
            "Protective cases",
        ],
        "surface_finishes": ["Matte", "Semi-gloss", "Textured"],
        "moldability": "Excellent — injection moldable LSR",
        "biocompatible": True,
    },
    "tpe": {
        "name": "TPE (Thermoplastic Elastomer)",
        "typical_grade": "Santoprene 101-73",
        "material_type": "Thermoplastic Elastomer",
        "density_g_cm3": 0.97,
        "tensile_strength_mpa": 8,
        "elongation_at_break_pct": 500,
        "heat_deflection_c": 60,
        "common_applications": [
            "Overmolded grips",
            "Soft-touch surfaces",
            "Cable jackets",
            "Seals",
            "Protective bumpers",
        ],
        "surface_finishes": ["Soft-touch matte", "Textured"],
        "moldability": "Excellent — can be overmolded onto rigid substrates",
        "recyclable": True,
    },
    "magnesium": {
        "name": "Magnesium Alloy AZ91D",
        "typical_grade": "AZ91D (die cast)",
        "material_type": "Non-ferrous Metal",
        "density_g_cm3": 1.81,
        "tensile_strength_mpa": 230,
        "yield_strength_mpa": 160,
        "thermal_conductivity_w_mk": 72,
        "melting_point_c": 595,
        "common_applications": [
            "DSLR camera bodies",
            "Laptop chassis (ThinkPad)",
            "Automotive steering wheels",
            "Power tool frames",
        ],
        "surface_finishes": ["Micro-arc oxidation", "E-coat", "Paint"],
        "machinability": "Excellent — lightest structural metal",
        "recyclable": True,
        "corrosion_resistance": "Poor — requires surface treatment",
    },
    "carbon fiber": {
        "name": "CFRP (Carbon Fiber Reinforced Polymer)",
        "typical_grade": "Toray T700 / 3K twill weave",
        "material_type": "Composite",
        "density_g_cm3": 1.55,
        "tensile_strength_mpa": 2550,
        "thermal_conductivity_w_mk": 5.0,
        "common_applications": [
            "Drone frames",
            "Premium laptop lids",
            "Sports equipment",
            "Automotive panels",
            "Camera tripods",
        ],
        "surface_finishes": ["Clear coat (visible weave)", "Painted", "Matte"],
        "recyclable": False,
    },
    "polypropylene": {
        "name": "PP (Polypropylene)",
        "typical_grade": "Pro-fax SG702",
        "material_type": "Thermoplastic",
        "density_g_cm3": 0.91,
        "tensile_strength_mpa": 33,
        "elongation_at_break_pct": 150,
        "heat_deflection_c": 100,
        "thermal_conductivity_w_mk": 0.12,
        "melting_point_c": 160,
        "common_applications": [
            "Living hinges",
            "Food containers",
            "Battery cases",
            "Packaging",
            "Automotive bumpers",
        ],
        "surface_finishes": ["Matte", "Textured"],
        "moldability": "Excellent — low cost, high volume",
        "recyclable": True,
    },
    "titanium": {
        "name": "Titanium Grade 5 (Ti-6Al-4V)",
        "typical_grade": "Grade 5 Ti-6Al-4V",
        "material_type": "Non-ferrous Metal",
        "density_g_cm3": 4.43,
        "tensile_strength_mpa": 950,
        "yield_strength_mpa": 880,
        "thermal_conductivity_w_mk": 6.7,
        "melting_point_c": 1660,
        "common_applications": [
            "iPhone 15 Pro frame",
            "Premium watch cases",
            "Medical implants",
            "Aerospace fasteners",
        ],
        "surface_finishes": ["PVD coated", "Brushed", "Bead-blasted", "Anodized"],
        "machinability": "Difficult — requires specialized tooling",
        "recyclable": True,
        "corrosion_resistance": "Excellent",
        "biocompatible": True,
    },
    "ceramic": {
        "name": "Zirconia Ceramic (ZrO₂)",
        "typical_grade": "Yttria-stabilized zirconia (3Y-TZP)",
        "material_type": "Advanced Ceramic",
        "density_g_cm3": 6.05,
        "tensile_strength_mpa": 900,
        "thermal_conductivity_w_mk": 2.5,
        "melting_point_c": 2715,
        "common_applications": [
            "Smartwatch cases (Apple Watch Edition)",
            "Smartphone back panels",
            "Knife blades",
            "Dental implants",
        ],
        "surface_finishes": ["Mirror polish", "Matte", "Glazed"],
        "scratch_resistance": "Excellent (Mohs 8.5)",
        "recyclable": False,
    },
}

# Aliases for common names
_ALIASES: dict[str, str] = {
    "acrylonitrile butadiene styrene": "abs",
    "plastic": "abs",
    "polycarbonate/abs": "pc/abs",
    "pc abs": "pc/abs",
    "al": "aluminum",
    "aluminium": "aluminum",
    "6061": "aluminum",
    "ss": "stainless steel",
    "steel": "stainless steel",
    "304": "stainless steel",
    "gorilla glass": "glass",
    "soda lime": "glass",
    "soda-lime": "glass",
    "display glass": "glass",
    "pa": "nylon",
    "polyamide": "nylon",
    "nylon 6": "nylon",
    "nylon 66": "nylon",
    "rubber": "silicone",
    "lsr": "silicone",
    "thermoplastic elastomer": "tpe",
    "overmold": "tpe",
    "mg": "magnesium",
    "cfrp": "carbon fiber",
    "cf": "carbon fiber",
    "pp": "polypropylene",
    "ti": "titanium",
    "grade 5": "titanium",
    "zirconia": "ceramic",
}


async def lookup_material(material_name: str) -> dict | None:
    """Look up material properties by name.

    Searches the built-in database by exact key match, then by alias,
    then by substring matching. Returns engineering properties for
    the matched material.
    """
    name_lower = material_name.lower().strip()

    # Direct match
    if name_lower in MATERIAL_GRADES:
        return {**MATERIAL_GRADES[name_lower], "matched_query": material_name}

    # Alias match
    if name_lower in _ALIASES:
        key = _ALIASES[name_lower]
        return {**MATERIAL_GRADES[key], "matched_query": material_name}

    # Substring match — check if query appears in any key or alias
    # Require minimum 4-char overlap to avoid false positives (e.g. "al" in "material")
    for key, data in MATERIAL_GRADES.items():
        if len(key) >= 4 and (name_lower in key or key in name_lower):
            return {**data, "matched_query": material_name}

    for alias, key in _ALIASES.items():
        if len(alias) >= 4 and (name_lower in alias or alias in name_lower):
            return {**MATERIAL_GRADES[key], "matched_query": material_name}

    logger.info("Material not found in database: %s", material_name)
    return None
