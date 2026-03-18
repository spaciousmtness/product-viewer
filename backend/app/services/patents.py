"""USPTO PatentsView API integration.

Searches the USPTO patent database for utility and design patents.
Focus on design patents which contain product form drawings.
Free, no API key needed.
Docs: https://patentsview.org/apis/api-endpoints
"""

import logging

import httpx

logger = logging.getLogger(__name__)

PATENTSVIEW_URL = "https://api.patentsview.org/patents/query"


async def search_patents(query: str, limit: int = 5) -> list[dict]:
    """Search USPTO patents matching the query.

    Returns patent_number, title, abstract, inventors, assignee,
    filing_date, patent_type, and thumbnail_url.
    """
    payload = {
        "q": {
            "_or": [
                {"_text_any": {"patent_title": query}},
                {"_text_any": {"patent_abstract": query}},
            ]
        },
        "f": [
            "patent_number",
            "patent_title",
            "patent_abstract",
            "patent_date",
            "patent_type",
            "patent_num_claims",
            "inventor_first_name",
            "inventor_last_name",
            "assignee_organization",
        ],
        "o": {
            "page": 1,
            "per_page": limit,
        },
        "s": [{"patent_date": "desc"}],
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                PATENTSVIEW_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("PatentsView search failed: %s", exc)
        return []

    data = resp.json()
    patents_data = data.get("patents", [])

    results = []
    for pat in patents_data:
        patent_number = pat.get("patent_number", "")

        # Inventors
        inventors = []
        for inv in pat.get("inventors", []):
            first = inv.get("inventor_first_name", "")
            last = inv.get("inventor_last_name", "")
            if first or last:
                inventors.append(f"{first} {last}".strip())

        # Assignee
        assignees = pat.get("assignees", [])
        assignee = None
        if assignees:
            assignee = assignees[0].get("assignee_organization")

        # Patent type
        patent_type = pat.get("patent_type", "")

        # Thumbnail — USPTO provides patent images
        thumbnail_url = (
            f"https://pdfpiw.uspto.gov/.piw?docid={patent_number}&PageNum=0&IDKey=NONE"
            if patent_number
            else None
        )

        results.append({
            "source": "uspto",
            "patent_number": patent_number,
            "title": pat.get("patent_title", ""),
            "abstract": pat.get("patent_abstract", ""),
            "inventors": inventors,
            "assignee": assignee,
            "filing_date": pat.get("patent_date"),
            "patent_type": patent_type,
            "num_claims": pat.get("patent_num_claims"),
            "thumbnail_url": thumbnail_url,
            "url": f"https://patents.google.com/patent/US{patent_number}" if patent_number else None,
        })

    return results
