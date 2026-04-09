"""FCC filing data search.

Searches the FCC Equipment Authorization System (EAS) database for
device filings. Gold mine for pre-announcement device intelligence.
Uses HTML scraping since the FCC doesn't provide a structured API.
"""

import logging

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

FCC_SEARCH_URL = "https://apps.fcc.gov/oetcf/eas/reports/GenericSearchResult.cfm"


async def search_fcc(query: str, limit: int = 5) -> list[dict]:
    """Search FCC EAS database for device filings.

    Returns fcc_id, applicant, product_description, grant_date,
    equipment_class, and whether test reports are available.
    """
    params = {
        "RequestTimeout": "500",
        "productsearch": query,
        "reportType": "DEFAULT",
    }

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(FCC_SEARCH_URL, params=params)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("FCC search failed: %s", exc)
        return []

    return _parse_fcc_results(resp.text, limit)


def _parse_fcc_results(html: str, limit: int) -> list[dict]:
    """Parse FCC search results HTML into structured data."""
    soup = BeautifulSoup(html, "html.parser")

    results = []

    # FCC results are in a table — look for data rows
    tables = soup.find_all("table")
    data_table = None
    for table in tables:
        headers = table.find_all("th")
        header_texts = [h.get_text(strip=True).lower() for h in headers]
        if any("fcc" in h or "grantee" in h or "applicant" in h for h in header_texts):
            data_table = table
            break

    if not data_table:
        # Try alternate table structure — some FCC pages use different layouts
        rows = soup.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) >= 3:
                text = " ".join(c.get_text(strip=True) for c in cells)
                if text.strip():
                    fcc_id = cells[0].get_text(strip=True) if cells else ""
                    # Check if it looks like an FCC ID (letters + numbers)
                    if fcc_id and len(fcc_id) > 3:
                        result = {
                            "source": "fcc",
                            "fcc_id": fcc_id,
                            "applicant": cells[1].get_text(strip=True) if len(cells) > 1 else "",
                            "product_description": cells[2].get_text(strip=True) if len(cells) > 2 else "",
                            "grant_date": cells[3].get_text(strip=True) if len(cells) > 3 else "",
                            "equipment_class": cells[4].get_text(strip=True) if len(cells) > 4 else "",
                            "test_reports_available": False,
                        }
                        results.append(result)
                        if len(results) >= limit:
                            break
        return results

    # Parse structured table
    rows = data_table.find_all("tr")[1:]  # skip header row
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 3:
            continue

        cell_texts = [c.get_text(strip=True) for c in cells]

        # Check for test report links
        has_reports = bool(row.find("a", string=lambda s: s and "report" in s.lower() if s else False))

        result = {
            "source": "fcc",
            "fcc_id": cell_texts[0] if len(cell_texts) > 0 else "",
            "applicant": cell_texts[1] if len(cell_texts) > 1 else "",
            "product_description": cell_texts[2] if len(cell_texts) > 2 else "",
            "grant_date": cell_texts[3] if len(cell_texts) > 3 else "",
            "equipment_class": cell_texts[4] if len(cell_texts) > 4 else "",
            "test_reports_available": has_reports,
        }

        # Only include entries with an actual FCC ID
        if result["fcc_id"]:
            results.append(result)

        if len(results) >= limit:
            break

    return results
