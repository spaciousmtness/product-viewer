"""Nexar/Octopart electronic component search.

Searches the Octopart database for electronic components by MPN, keyword, or description.
Free tier available — requires NEXAR_API_KEY in config for authenticated access.
Docs: https://octopart.com/api/home
"""

import logging

import httpx

from app.config import config

logger = logging.getLogger(__name__)

NEXAR_API_URL = "https://api.nexar.com/graphql/"
OCTOPART_REST_URL = "https://octopart.com/api/v4/rest"


async def search_components(query: str, limit: int = 5) -> list[dict]:
    """Search Octopart for electronic components matching the query.

    Returns a list of components with MPN, manufacturer, description,
    specs, pricing, datasheet URLs, and stock availability.
    Falls back to empty list if API key is missing or request fails.
    """
    if not config.nexar_api_key:
        logger.info("No NEXAR_API_KEY configured — skipping Octopart search")
        return []

    graphql_query = """
    query SearchComponents($q: String!, $limit: Int!) {
      supSearch(q: $q, limit: $limit) {
        results {
          part {
            mpn
            manufacturer {
              name
            }
            shortDescription
            descriptions {
              text
            }
            specs {
              attribute {
                name
                shortname
              }
              displayValue
            }
            bestDatasheet {
              url
              name
            }
            medianPrice1000 {
              price
              currency
            }
            sellers {
              company {
                name
              }
              offers {
                inventoryLevel
                prices {
                  price
                  currency
                  quantity
                }
              }
            }
          }
        }
      }
    }
    """

    headers = {
        "Authorization": f"Bearer {config.nexar_api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "query": graphql_query,
        "variables": {"q": query, "limit": limit},
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(NEXAR_API_URL, json=payload, headers=headers)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Octopart search failed: %s", exc)
        return []

    data = resp.json()
    results_data = (
        data.get("data", {}).get("supSearch", {}).get("results", [])
    )

    components = []
    for item in results_data:
        part = item.get("part", {})

        # Extract specs into a dict
        specs = {}
        for spec in part.get("specs", []):
            attr = spec.get("attribute", {})
            name = attr.get("name") or attr.get("shortname", "unknown")
            specs[name] = spec.get("displayValue", "")

        # Extract pricing
        pricing = {}
        median = part.get("medianPrice1000")
        if median and median.get("price"):
            pricing["median_1k"] = median["price"]
            pricing["currency"] = median.get("currency", "USD")

        # Extract stock info
        stock_total = 0
        seller_count = 0
        for seller in part.get("sellers", []):
            seller_count += 1
            for offer in seller.get("offers", []):
                inv = offer.get("inventoryLevel")
                if isinstance(inv, (int, float)):
                    stock_total += int(inv)

        # Datasheet
        datasheet = part.get("bestDatasheet")
        datasheet_url = datasheet.get("url") if datasheet else None

        # Description
        description = part.get("shortDescription", "")
        if not description:
            descs = part.get("descriptions", [])
            if descs:
                description = descs[0].get("text", "")

        components.append({
            "source": "octopart",
            "mpn": part.get("mpn"),
            "manufacturer": (part.get("manufacturer") or {}).get("name"),
            "description": description,
            "specs": specs,
            "pricing": pricing,
            "datasheet_url": datasheet_url,
            "stock_total": stock_total,
            "seller_count": seller_count,
        })

    return components
