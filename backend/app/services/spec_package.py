"""Manufacturing Spec Package Generator.

The KILLER feature -- generates factory-ready specification PDFs with
professional engineering document aesthetics using fpdf2.

Output sections:
  1. Cover Sheet
  2. Product Overview
  3. Dimensions & Tolerances
  4. Materials Specification
  5. Bill of Materials
  6. Surface Finish Specifications
  7. Regulatory Compliance Checklist
  8. Assembly Notes
  9. Quality Standards
  10. Source Citations
"""

import io
import logging
from datetime import datetime, timezone

from fpdf import FPDF

logger = logging.getLogger(__name__)

# ── Color Palette (Engineering document aesthetic) ──────────────────────
NAVY = (18, 32, 58)
STEEL_BLUE = (70, 100, 140)
DARK_GRAY = (50, 50, 50)
MED_GRAY = (120, 120, 120)
LIGHT_GRAY = (230, 230, 230)
WHITE = (255, 255, 255)
ACCENT_BLUE = (0, 102, 179)
TABLE_HEADER_BG = (35, 55, 90)
TABLE_ALT_ROW = (242, 245, 249)
BLACK = (0, 0, 0)
RED_ACCENT = (180, 40, 40)


class SpecPDF(FPDF):
    """Custom FPDF subclass for engineering spec documents."""

    def __init__(self, product_name: str = "", doc_number: str = ""):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.product_name = product_name
        self.doc_number = doc_number
        self._section_num = 0
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        if self.page_no() == 1:
            return  # Cover page has custom header
        # Top border line
        self.set_draw_color(*NAVY)
        self.set_line_width(0.5)
        self.line(10, 10, 200, 10)

        # Header text
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*MED_GRAY)
        self.set_xy(10, 4)
        self.cell(95, 6, self.product_name, align="L")
        self.cell(95, 6, f"Doc: {self.doc_number}", align="R")
        self.ln(8)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-18)
        # Footer line
        self.set_draw_color(*NAVY)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), 200, self.get_y())
        # Footer text
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MED_GRAY)
        self.set_y(-15)
        self.cell(63, 8, "CONFIDENTIAL -- Manufacturing Use Only", align="L")
        self.cell(64, 8, f"Page {self.page_no()}/{{nb}}", align="C")
        gen_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.cell(63, 8, f"Generated: {gen_date}", align="R")

    def section_heading(self, title: str):
        """Render a numbered section heading with a colored bar."""
        self._section_num += 1
        self.ln(4)
        if self.get_y() > 250:
            self.add_page()
        # Blue accent bar
        self.set_fill_color(*NAVY)
        self.rect(10, self.get_y(), 3, 8, "F")
        # Section number + title
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*NAVY)
        self.set_x(16)
        self.cell(0, 8, f"{self._section_num}.  {title}", ln=True)
        # Thin separator
        self.set_draw_color(*STEEL_BLUE)
        self.set_line_width(0.2)
        self.line(16, self.get_y(), 200, self.get_y())
        self.ln(3)

    def sub_heading(self, title: str):
        """Render a sub-heading."""
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*STEEL_BLUE)
        self.cell(0, 7, title, ln=True)
        self.ln(1)

    def body_text(self, text: str):
        """Render body text."""
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*DARK_GRAY)
        self.multi_cell(0, 5, text)
        self.ln(2)

    def key_value(self, key: str, value: str, indent: float = 10):
        """Render a key-value pair on a single line."""
        self.set_x(10 + indent)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*DARK_GRAY)
        key_w = 50
        self.cell(key_w, 5.5, key + ":", align="L")
        self.set_font("Helvetica", "", 9)
        val_str = str(value)[:100] if value else "N/A"
        self.cell(0, 5.5, val_str, ln=True)

    def table(self, headers: list[str], rows: list[list[str]], col_widths: list[float] | None = None):
        """Render a professional data table with alternating row colors."""
        if not headers:
            return
        if col_widths is None:
            avail = 190
            col_widths = [avail / len(headers)] * len(headers)

        # Table header
        self.set_fill_color(*TABLE_HEADER_BG)
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 8)
        for i, header in enumerate(headers):
            self.cell(col_widths[i], 7, header, border=0, fill=True, align="C")
        self.ln()

        # Table rows
        self.set_font("Helvetica", "", 8)
        for row_idx, row in enumerate(rows):
            if row_idx % 2 == 0:
                self.set_fill_color(*TABLE_ALT_ROW)
            else:
                self.set_fill_color(*WHITE)

            self.set_text_color(*DARK_GRAY)
            max_h = 6
            for i, cell_text in enumerate(row):
                w = col_widths[i]
                self.cell(w, max_h, str(cell_text)[:50], border=0, fill=True, align="L")
            self.ln()

        # Bottom border
        total_w = sum(col_widths)
        self.set_draw_color(*STEEL_BLUE)
        self.set_line_width(0.3)
        self.line(self.get_x(), self.get_y(), self.get_x() + total_w, self.get_y())
        self.ln(3)

    def notice_box(self, text: str, box_type: str = "info"):
        """Render a notice/warning box."""
        if box_type == "warning":
            bg = (255, 248, 230)
            border_color = (200, 160, 60)
            prefix = "WARNING"
        else:
            bg = (235, 242, 250)
            border_color = ACCENT_BLUE
            prefix = "NOTE"

        y = self.get_y()
        self.set_fill_color(*bg)
        self.set_draw_color(*border_color)
        self.set_line_width(0.4)
        self.rect(12, y, 186, 14, "DF")
        self.set_xy(15, y + 2)
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*border_color)
        self.cell(0, 5, f"{prefix}: ", ln=False)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*DARK_GRAY)
        self.multi_cell(170, 5, text)
        self.set_y(y + 16)


async def generate_spec_package(product_data: dict) -> bytes:
    """Generate a professional manufacturing spec PDF.

    Args:
        product_data: Combined data from recognition + specs + manufacturing.
            Expected keys: product_name, brand, model_number, category,
            description, dimensions, materials, features, components,
            manufacturing, specs, regulatory, etc.

    Returns:
        PDF file content as bytes.
    """
    product_name = product_data.get("product_name", "Unknown Product")
    brand = product_data.get("brand", "")
    model_number = product_data.get("model_number", "")
    doc_number = f"SP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-001"

    pdf = SpecPDF(product_name=product_name, doc_number=doc_number)
    pdf.alias_nb_pages()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SECTION 0: Cover Sheet
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pdf.add_page()
    _render_cover(pdf, product_name, brand, model_number, doc_number, product_data)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SECTION 1: Product Overview
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pdf.add_page()
    pdf.section_heading("Product Overview")
    _render_overview(pdf, product_data)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SECTION 2: Dimensions & Tolerances
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pdf.section_heading("Dimensions & Tolerances")
    _render_dimensions(pdf, product_data)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SECTION 3: Materials Specification
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pdf.section_heading("Materials Specification")
    _render_materials(pdf, product_data)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SECTION 4: Bill of Materials
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pdf.section_heading("Bill of Materials")
    _render_bom(pdf, product_data)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SECTION 5: Surface Finish Specifications
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pdf.section_heading("Surface Finish Specifications")
    _render_surface_finish(pdf, product_data)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SECTION 6: Regulatory Compliance Checklist
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pdf.section_heading("Regulatory Compliance Checklist")
    _render_regulatory(pdf, product_data)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SECTION 7: Assembly Notes
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pdf.section_heading("Assembly Notes")
    _render_assembly(pdf, product_data)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SECTION 8: Quality Standards
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pdf.section_heading("Quality Standards")
    _render_quality(pdf, product_data)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SECTION 9: Source Citations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pdf.section_heading("Source Citations")
    _render_citations(pdf, product_data)

    # Output
    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Section Renderers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _render_cover(pdf: SpecPDF, product_name: str, brand: str,
                  model_number: str, doc_number: str, data: dict):
    """Render the cover page with a professional engineering look."""
    # Full-width navy header block
    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, 210, 100, "F")

    # Title: "MANUFACTURING SPECIFICATION"
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*STEEL_BLUE)
    pdf.set_xy(20, 25)
    pdf.cell(170, 8, "MANUFACTURING SPECIFICATION PACKAGE", align="C")

    # Product name (large)
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(20, 40)
    pdf.multi_cell(170, 12, product_name, align="C")

    # Brand + model
    if brand or model_number:
        pdf.set_font("Helvetica", "", 14)
        pdf.set_text_color(180, 200, 225)
        label = " | ".join(filter(None, [brand, model_number]))
        pdf.set_x(20)
        pdf.cell(170, 10, label, align="C", ln=True)

    # Divider line on cover
    pdf.set_draw_color(100, 140, 180)
    pdf.set_line_width(0.4)
    y = pdf.get_y() + 6
    pdf.line(50, y, 160, y)

    # Document metadata block (below the navy bar)
    pdf.set_y(110)
    pdf.set_text_color(*DARK_GRAY)

    meta_fields = [
        ("Document Number", doc_number),
        ("Revision", "A (Initial)"),
        ("Date", datetime.now(timezone.utc).strftime("%B %d, %Y")),
        ("Category", data.get("category", "Consumer Electronics")),
        ("Classification", "CONFIDENTIAL"),
    ]

    for label, value in meta_fields:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*MED_GRAY)
        pdf.set_x(30)
        pdf.cell(50, 7, label.upper(), align="L")
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*DARK_GRAY)
        pdf.cell(100, 7, value, align="L", ln=True)

    # Approval block at bottom
    pdf.set_y(210)
    pdf.set_draw_color(*LIGHT_GRAY)
    pdf.set_line_width(0.3)

    approvals = ["Prepared By", "Reviewed By", "Approved By"]
    for title in approvals:
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*MED_GRAY)
        pdf.set_x(15)
        pdf.cell(35, 6, title + ":", align="L")
        y_line = pdf.get_y() + 5
        pdf.line(50, y_line, 120, y_line)
        pdf.set_x(125)
        pdf.cell(15, 6, "Date:", align="L")
        pdf.line(140, y_line, 195, y_line)
        pdf.ln(10)

    # Footer notice
    pdf.set_y(-30)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(*MED_GRAY)
    pdf.multi_cell(0, 4,
        "This document contains proprietary information. Unauthorized reproduction "
        "or distribution is prohibited. Generated by Product Recon v2.",
        align="C")


def _render_overview(pdf: SpecPDF, data: dict):
    """Render the product overview section."""
    description = data.get("description", "")
    if not description:
        description = data.get("short_description", "No description available.")

    pdf.body_text(description)

    pdf.sub_heading("Key Specifications")

    specs = data.get("specs", {})
    if isinstance(specs, dict):
        for key, value in list(specs.items())[:20]:
            pdf.key_value(str(key), str(value))

    # Features list
    features = data.get("features", [])
    if features:
        pdf.ln(2)
        pdf.sub_heading("Features")
        for feat in features[:15]:
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*DARK_GRAY)
            pdf.set_x(15)
            feat_text = feat.get("feature", feat) if isinstance(feat, dict) else str(feat)
            pdf.cell(0, 5.5, f"  -  {feat_text}", ln=True)

    # Technical specs table
    tech_specs = data.get("technical_specs") or data.get("technicalSpecs", {})
    if isinstance(tech_specs, dict) and tech_specs:
        pdf.ln(3)
        pdf.sub_heading("Technical Specifications")
        rows = [[str(k), str(v)] for k, v in tech_specs.items()]
        pdf.table(["Parameter", "Value"], rows, [70, 120])


def _render_dimensions(pdf: SpecPDF, data: dict):
    """Render dimensions and tolerances section."""
    dims = data.get("dimensions", {})

    pdf.notice_box(
        "All dimensions per ISO 2768-m (medium tolerance class) unless otherwise specified. "
        "Linear: \u00b10.1mm (<6mm), \u00b10.2mm (6-30mm), \u00b10.3mm (30-120mm). "
        "Angular: \u00b11\u00b0."
    )
    pdf.ln(2)

    if isinstance(dims, dict) and dims:
        rows = []
        for key, value in dims.items():
            display_key = key.replace("_", " ").title()
            rows.append([display_key, str(value)])
        pdf.table(["Dimension", "Value"], rows, [80, 110])
    elif isinstance(dims, str):
        pdf.body_text(dims)
    else:
        pdf.body_text("Dimensions to be confirmed during prototype phase.")

    # Weight
    weight = data.get("weight")
    if weight:
        pdf.key_value("Weight", str(weight))

    # Tolerance table
    pdf.ln(3)
    pdf.sub_heading("Standard Tolerance Table (ISO 2768-m)")
    tolerance_rows = [
        ["0.5 - 6 mm", "\u00b1 0.1 mm"],
        ["6 - 30 mm", "\u00b1 0.2 mm"],
        ["30 - 120 mm", "\u00b1 0.3 mm"],
        ["120 - 400 mm", "\u00b1 0.5 mm"],
        ["400 - 1000 mm", "\u00b1 0.8 mm"],
    ]
    pdf.table(["Nominal Range", "Tolerance"], tolerance_rows, [95, 95])


def _render_materials(pdf: SpecPDF, data: dict):
    """Render materials specification section."""
    materials = data.get("materials", [])

    if isinstance(materials, list) and materials:
        rows = []
        for mat in materials:
            if isinstance(mat, dict):
                rows.append([
                    mat.get("name", "Unknown"),
                    mat.get("grade", mat.get("typical_grade", "")),
                    mat.get("application", mat.get("component", "")),
                ])
            else:
                rows.append([str(mat), "", ""])
        pdf.table(["Material", "Grade/Spec", "Application"], rows, [55, 70, 65])
    elif isinstance(materials, str):
        pdf.body_text(materials)
    else:
        pdf.body_text("Materials to be specified based on product requirements.")

    # Color / Pantone
    colorway = data.get("colorway") or data.get("color")
    if colorway:
        pdf.ln(2)
        pdf.sub_heading("Color Specification")
        pdf.key_value("Colorway", str(colorway))
        pdf.notice_box("Color matching to be verified against physical samples. Specify Pantone codes for production.")

    # Material notes
    pdf.ln(2)
    pdf.sub_heading("Material Requirements")
    requirements = [
        "All plastics must comply with RoHS 2 (EU 2011/65/EU) and REACH SVHC list.",
        "Flame retardancy: UL94 V-0 for internal structural components.",
        "All metals must pass 48-hour salt spray test (ASTM B117) minimum.",
        "Food-contact materials (if applicable) must comply with FDA 21 CFR.",
    ]
    for req in requirements:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*DARK_GRAY)
        pdf.set_x(15)
        pdf.cell(0, 5.5, f"  -  {req}", ln=True)


def _render_bom(pdf: SpecPDF, data: dict):
    """Render Bill of Materials section."""
    components = data.get("components", [])

    if isinstance(components, list) and components:
        rows = []
        for i, comp in enumerate(components, 1):
            if isinstance(comp, dict):
                rows.append([
                    str(i),
                    comp.get("name", comp.get("mpn", "Unknown")),
                    comp.get("manufacturer", ""),
                    str(comp.get("quantity", 1)),
                    comp.get("unit_cost", comp.get("price", "")),
                ])
            else:
                rows.append([str(i), str(comp), "", "1", ""])
        pdf.table(
            ["#", "Component", "Manufacturer", "Qty", "Est. Cost"],
            rows,
            [12, 70, 45, 20, 43],
        )
    else:
        pdf.body_text("Bill of Materials to be determined from teardown analysis and component identification.")

    pdf.ln(2)
    pdf.notice_box(
        "BOM quantities are estimates based on available product intelligence. "
        "Verify all components against physical teardown before production."
    )


def _render_surface_finish(pdf: SpecPDF, data: dict):
    """Render surface finish specifications."""
    manufacturing = data.get("manufacturing", {})
    surface = manufacturing.get("surface_finish") or data.get("surface_finish")

    if isinstance(surface, list):
        rows = []
        for finish in surface:
            if isinstance(finish, dict):
                rows.append([
                    finish.get("surface", ""),
                    finish.get("finish", finish.get("type", "")),
                    finish.get("spec", ""),
                ])
            else:
                rows.append([str(finish), "", ""])
        pdf.table(["Surface", "Finish Type", "Specification"], rows, [60, 65, 65])
    elif isinstance(surface, str):
        pdf.body_text(surface)
    else:
        pdf.body_text("Surface finish specifications per product design requirements.")

    # Standard finish reference table
    pdf.ln(3)
    pdf.sub_heading("Common Finish Reference")
    finish_rows = [
        ["Plastic -- Matte", "VDI 3400 Ref 30-33", "Ra 1.0-3.0 um"],
        ["Plastic -- Gloss", "SPI A-1 / A-2", "Ra 0.012-0.025 um"],
        ["Metal -- Brushed", "#4 Finish (Linear)", "Ra 0.4-0.8 um"],
        ["Metal -- Bead Blast", "Glass bead 80-120 mesh", "Ra 1.5-3.0 um"],
        ["Anodize Type II", "MIL-A-8625F Class II", "5-25 um coating"],
        ["Anodize Type III", "MIL-A-8625F Class III", "25-75 um coating"],
        ["Powder Coat", "ASTM D3451", "50-80 um coating"],
    ]
    pdf.table(["Finish", "Standard", "Surface Roughness"], finish_rows, [60, 65, 65])


def _render_regulatory(pdf: SpecPDF, data: dict):
    """Render regulatory compliance checklist."""
    # Determine product category for relevant regulations
    category = (data.get("category") or "").lower()
    is_electronic = any(kw in category for kw in ["electronic", "phone", "computer", "audio", "wireless", "iot"])

    regulations = [
        ("FCC Part 15", "USA -- Electromagnetic compatibility", is_electronic),
        ("CE Marking", "EU -- Safety, health, environmental standards", True),
        ("RoHS 2", "EU 2011/65/EU -- Hazardous substances in electronics", is_electronic),
        ("REACH", "EU -- Registration of chemicals", True),
        ("UL/CSA", "USA/Canada -- Product safety certification", is_electronic),
        ("WEEE", "EU -- Waste electronics collection/recycling", is_electronic),
        ("California Prop 65", "USA -- Chemical exposure warnings", True),
        ("Energy Star", "USA/Global -- Energy efficiency", is_electronic),
        ("Wi-Fi Alliance", "Wireless interoperability", is_electronic and "wireless" in category),
        ("Bluetooth SIG", "Bluetooth compliance", is_electronic),
        ("IP Rating", "Ingress protection (dust/water)", True),
        ("MFi", "Apple -- Made for iPhone/iPad", False),
    ]

    # FCC data from intelligence pipeline
    fcc_data = data.get("fcc", [])
    if isinstance(fcc_data, list) and fcc_data:
        pdf.sub_heading("FCC Filing Data")
        rows = []
        for filing in fcc_data[:5]:
            if isinstance(filing, dict):
                rows.append([
                    filing.get("fcc_id", ""),
                    filing.get("applicant", ""),
                    filing.get("grant_date", ""),
                ])
        if rows:
            pdf.table(["FCC ID", "Applicant", "Grant Date"], rows, [50, 80, 60])
            pdf.ln(2)

    # Compliance checklist
    pdf.sub_heading("Compliance Requirements")
    rows = []
    for reg_name, description, applicable in regulations:
        status = "REQUIRED" if applicable else "N/A"
        rows.append([reg_name, description, status])
    pdf.table(["Regulation", "Description", "Status"], rows, [40, 110, 40])

    pdf.ln(2)
    pdf.notice_box(
        "Compliance requirements depend on target markets and product classification. "
        "Consult with regulatory affairs team before finalizing.",
        "warning",
    )


def _render_assembly(pdf: SpecPDF, data: dict):
    """Render assembly notes section."""
    manufacturing = data.get("manufacturing", {})
    assembly = manufacturing.get("assembly_notes") or data.get("assembly_notes")

    if isinstance(assembly, list):
        for i, note in enumerate(assembly, 1):
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*DARK_GRAY)
            pdf.set_x(15)
            note_text = note.get("text", note) if isinstance(note, dict) else str(note)
            pdf.cell(0, 5.5, f"  {i}.  {note_text}", ln=True)
    elif isinstance(assembly, str):
        pdf.body_text(assembly)
    else:
        # Default assembly guidelines
        pdf.sub_heading("General Assembly Guidelines")
        guidelines = [
            "ESD protection: All assembly stations must maintain <100V per ANSI/ESD S20.20.",
            "Torque specifications: Use calibrated torque drivers. Verify per fastener spec sheet.",
            "Adhesive curing: Allow minimum 24h cure at 23\u00b12\u00b0C, 50\u00b15% RH.",
            "Snap-fit assembly: Confirm retention force per design spec (typical 5-15N).",
            "Cable routing: Maintain minimum bend radius per cable manufacturer specification.",
            "Thermal interface: Apply TIM per manufacturer datasheet (typical 25-50 um bondline).",
            "Conformal coating: Apply to exposed PCBs per IPC-CC-830 (acrylic or silicone based).",
            "Label placement: All regulatory labels must be visible and permanent per market requirements.",
        ]
        for i, g in enumerate(guidelines, 1):
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*DARK_GRAY)
            pdf.set_x(15)
            pdf.cell(0, 5.5, f"  {i}.  {g}", ln=True)

    # Teardown insights
    teardowns = data.get("teardowns", [])
    if isinstance(teardowns, list) and teardowns:
        pdf.ln(3)
        pdf.sub_heading("Teardown Insights")
        for td in teardowns[:3]:
            if isinstance(td, dict):
                pdf.key_value("Source", td.get("title", "Unknown"))
                pdf.key_value("Difficulty", td.get("difficulty", "Unknown"))
                if td.get("tools_required"):
                    tools = ", ".join(td["tools_required"][:5])
                    pdf.key_value("Tools", tools)
                pdf.ln(1)


def _render_quality(pdf: SpecPDF, data: dict):
    """Render quality standards section."""
    pdf.sub_heading("Acceptable Quality Levels (AQL)")

    aql_rows = [
        ["Critical defects", "0", "0.065%", "Safety hazards, non-functional"],
        ["Major defects", "I", "1.0%", "Impairs function, visible damage"],
        ["Minor defects", "II", "2.5%", "Cosmetic, does not affect function"],
    ]
    pdf.table(
        ["Defect Class", "Inspection Level", "AQL", "Definition"],
        aql_rows,
        [35, 35, 25, 95],
    )

    pdf.ln(3)
    pdf.sub_heading("Testing Requirements")
    tests = [
        ("Drop Test", "1.2m onto concrete, 6 faces, 2 drops per face (MIL-STD-810G)"),
        ("Temperature Cycling", "-20\u00b0C to +60\u00b0C, 100 cycles, 30 min dwell"),
        ("Humidity", "85\u00b0C / 85% RH, 168 hours continuous"),
        ("Vibration", "Random: 5-500Hz, 1.5g RMS, 3 axes, 30 min/axis"),
        ("Button Life", "100,000 actuations minimum at rated force"),
        ("Connector Life", "10,000 insertion cycles (USB-C), 5,000 (Lightning/proprietary)"),
        ("Surface Hardness", "Pencil hardness 2H minimum (coated surfaces)"),
        ("Adhesion", "Cross-hatch tape test ASTM D3359 -- 4B minimum"),
    ]
    for name, spec in tests:
        pdf.key_value(name, spec)

    pdf.ln(2)
    pdf.sub_heading("Inspection Sampling (ANSI/ASQ Z1.4)")
    sampling_rows = [
        ["2-8", "A", "2", "All units"],
        ["9-15", "A", "3", "All units"],
        ["16-25", "B", "5", "5 units"],
        ["26-50", "C", "8", "8 units"],
        ["51-90", "C", "13", "13 units"],
        ["91-150", "D", "20", "20 units"],
        ["151-280", "E", "32", "32 units"],
        ["281-500", "F", "50", "50 units"],
    ]
    pdf.table(
        ["Lot Size", "Code", "Sample Size", "Inspect"],
        sampling_rows,
        [40, 30, 50, 70],
    )


def _render_citations(pdf: SpecPDF, data: dict):
    """Render source citations section."""
    sources = data.get("sources", [])

    if isinstance(sources, list) and sources:
        for i, source in enumerate(sources, 1):
            if isinstance(source, dict):
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(*DARK_GRAY)
                name = source.get("name", source.get("source", "Unknown"))
                url = source.get("url", "")
                pdf.set_x(15)
                citation = f"[{i}] {name}"
                if url:
                    citation += f" -- {url}"
                pdf.cell(0, 5.5, citation, ln=True)
            else:
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(*DARK_GRAY)
                pdf.set_x(15)
                pdf.cell(0, 5.5, f"[{i}] {source}", ln=True)
    else:
        # Default sources
        default_sources = [
            "Product Recon v2 -- Vision Recognition Engine",
            "Best Buy Product API",
            "ICECAT Open Product Database",
            "Wikipedia",
            "USPTO PatentsView",
            "iFixit Teardown Database",
            "FCC Equipment Authorization System",
        ]
        for i, src in enumerate(default_sources, 1):
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*DARK_GRAY)
            pdf.set_x(15)
            pdf.cell(0, 5.5, f"[{i}] {src}", ln=True)

    pdf.ln(5)
    pdf.notice_box(
        "Data sourced from public APIs and databases. All specifications should be "
        "verified against manufacturer datasheets and physical samples before production use."
    )

    # End mark
    pdf.ln(5)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 8, "--- END OF DOCUMENT ---", align="C")
