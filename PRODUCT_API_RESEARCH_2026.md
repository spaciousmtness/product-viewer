# Product Database API Research - 2026

Research conducted: February 28, 2026

## Executive Summary

**Bottom Line:** Of the four APIs researched, only **Best Buy Products API** is production-ready for consumer electronics with comprehensive physical specifications. Icecat requires paid credentials, Google Knowledge Graph is deprecated, and Open Products Facts is underpopulated/experimental.

---

## 1. Best Buy Products API ✅ RECOMMENDED

**Status:** Active and fully functional in 2026

### Access & Authentication

- **Signup URL:** https://developer.bestbuy.com/ → "GET API KEY"
- **Process:** Email registration → activation email → immediate API key access
- **Cost:** Free tier available
- **Documentation:** https://bestbuyapis.github.io/api-documentation/

### Rate Limits (Free Tier)

- **Daily:** 50,000 calls per day
- **Per-second:** 5 queries per second (5 QPS)
- **Penalty:** 403 error + email notification when exceeded
- **Caching restriction:** Max 72 hours temporary caching only

### Available Product Fields

#### Physical Specifications ✅
- `height`, `width`, `depth` (in inches)
- `weight` (in pounds)
- `shippingWeight`

#### Core Product Data
- `sku`, `name`, `manufacturer`, `modelNumber`, `upc`
- `color`, `condition`, `format`
- `description`, `shortDescription`, `longDescription`

#### Pricing & Availability
- `salePrice`, `regularPrice`, `dollarSavings`, `onSale`
- `inStorePickup`, `onlineAvailability`, `inStoreAvailability`

#### Additional
- `customerReviewAverage`, `customerReviewCount`
- `accessories.sku`, `productVariations.sku`
- Multiple image URLs (thumbnail, large, 360-degree)

**Note:** Material composition not available as dedicated field (may appear in descriptions)

### Example API Call

```bash
curl "https://api.bestbuy.com/v1/products(sku=6535357)?show=name,sku,height,width,depth,weight,manufacturer,modelNumber&format=json&apiKey=YOUR_API_KEY"
```

### Example Response

```json
{
  "sku": 8880044,
  "productId": 1484301,
  "name": "Batman Begins (Blu-ray Disc)",
  "manufacturer": "Warner Home Video",
  "height": 7.15,
  "width": 9.84,
  "depth": 0.5,
  "weight": 0.3
}
```

### Strengths
- 725,000+ products across 100+ brands
- Comprehensive physical dimensions and weight data
- High rate limits (50k/day)
- RESTful JSON/XML responses
- Well-documented API
- Search by name, SKU, UPC, or multiple filters

### Limitations
- Limited to Best Buy's product catalog
- No material composition data
- 72-hour caching restriction limits offline use
- U.S.-focused inventory

### Sources
- [Best Buy Developer API Documentation](https://bestbuyapis.github.io/api-documentation/)
- [Best Buy API Terms and Conditions](https://developer.bestbuy.com/legal)
- [Best Buy API Public Directory](https://publicapis.io/best-buy-api)

---

## 2. Icecat Open Catalog ⚠️ LIMITED FREE ACCESS

**Status:** Active but free tier heavily restricted

### Access & Authentication

- **Signup URL:** https://icecat.biz/registration
- **Registration Types:** Channel Partner (retailers/distributors) OR Brand Partner (manufacturers)
- **Free Tier:** "Open Icecat" - 500k products (vs 3M in paid "Full Icecat")
- **API Credentials:** Not automatically provided on registration - must request separately

### Authentication Method

```javascript
// Node.js example
const icecat = require('icecat');
const icecatClient = new icecat('username', 'password');
```

```bash
# curl with basic auth
curl -u username:password "https://live.icecat.biz/api/?UserName=username&Language=en&GTIN=1234567890"
```

### Query Methods

1. **By GTIN:** Search by EAN, UPC, GTIN-13, or JAN barcode
2. **By Product ID:** Direct Icecat product ID lookup
3. **By SKU:** Brand + SKU combination
4. **By XML:** Parse from XML data

### Available Product Fields

#### Physical Specifications ✅
- Dimensions (height, width, depth)
- Weight
- GTIN/barcode

#### Product Data
- Product name/title
- Long and short descriptions
- Manufacturer/supplier name
- Product category
- Release date (YYYY-MM-DD format)
- Technical specifications (detailed feature groups)
- Product images (high/low/thumb URLs)

### Example API Request

```bash
# JSON format
curl -u username:password \
  "https://live.icecat.biz/api?lang=en&shopname=USERNAME&ProductCode=SKU123&Brand=BrandName&content="
```

### Example Response Format

```json
{
  "total": 100,
  "per_page": 20,
  "current_page": 1,
  "last_page": 5,
  "items": [
    {
      "id": "12345",
      "name": "Product Name",
      "title": "Full Product Title",
      "prod_id": "67890",
      "supplier": "Manufacturer Name",
      "category": "Electronics > Cameras",
      "high_pic": "https://...",
      "thumb_pic": "https://..."
    }
  ]
}
```

### Rate Limits

**Not publicly documented** - likely varies by account tier

### Strengths
- 26.4M+ data sheets across 28,849 brands
- Multilingual support (40+ languages)
- Detailed technical specifications
- Logistics data (GTIN, weight, dimensions)
- XML, JSON, CSV, and HTML formats
- Global product coverage

### Limitations
- Free tier only 500k products (vs 3M paid)
- Complex registration (must specify business type)
- API credentials not automatic - requires manual request
- Rate limits undocumented
- Authentication required for all requests
- Primarily barcode/SKU lookup - limited text search

### Sources
- [Icecat Free Registration](https://icecat.biz/registration)
- [Manual for Icecat JSON Product Requests](https://iceclog.com/manual-for-icecat-json-product-requests/)
- [GitHub - Icecat API Library](https://github.com/GreenCore/icecat)
- [Icecat API Documentation](https://api.icecat.biz/)

---

## 3. Google Knowledge Graph API ❌ DEPRECATED

**Status:** Deprecated - migrating to Cloud Enterprise Knowledge Graph

### Current Status

Google explicitly states:
> "To support our customers with additional enterprise requirements and high QPS use cases, we are migrating this API to Cloud Enterprise Knowledge Graph."

**New users should use:** Google Cloud Enterprise Knowledge Graph instead

### What It Provided (Historical)

- Entity search (Person, Place, Book, Movie, Organization, MusicGroup)
- **NOT product specifications**
- **NOT physical dimensions, materials, or weight**
- Read-only API
- JSON-LD formatted responses
- Standard schema.org types

### Example API Call (No longer recommended)

```bash
curl "https://kgsearch.googleapis.com/v1/entities:search?query=taylor+swift&key=API_KEY&limit=1&indent=True"
```

### Limitations

- **Explicitly not suitable for production use**
- **Does not return product data or physical specifications**
- No rate limit documentation
- Returns individual entities only, not interconnected graphs
- Being sunset in favor of Enterprise Knowledge Graph

### Replacement: Cloud Enterprise Knowledge Graph

- **Two editions:** Basic and Advanced
- **Advanced edition:** For production/enterprise use cases
- **Basic edition:** For community/non-production apps
- Entity resolution for organizations, products, locations, books, movies
- New Cloud Knowledge Graph MID format (starts with `c-`)
- Legacy Google Knowledge Graph MID format (starts with `/m`)

### Verdict

**Not viable for product database needs.** Even when active, it didn't provide physical specifications. The new Cloud Enterprise Knowledge Graph may support products, but documentation doesn't specify dimension/weight data availability.

### Sources
- [Google Knowledge Graph Search API](https://developers.google.com/knowledge-graph)
- [Enterprise Knowledge Graph Overview](https://docs.cloud.google.com/enterprise-knowledge-graph/docs/overview)
- [Cloud Knowledge Graph Search API](https://docs.cloud.google.com/enterprise-knowledge-graph/docs/search-api)

---

## 4. Open Products Facts ⚠️ EXPERIMENTAL / UNDERPOPULATED

**Status:** Active but minimal data, not actively maintained

### Overview

**Open Products Facts** is a sibling project to Open Food Facts, intended to cover all products that don't belong to Open Food Facts, Open Beauty Facts, or Open Pet Food Facts.

**Mission:** "Allow more circular consumption choices and extend the life of everyday objects"

**Reality:** The API exists but is **not actively maintained** and **not officially documented**. The database is sparsely populated compared to Open Food Facts (4M+ products).

### Access & Authentication

- **Base URL:** https://world.openproductsfacts.org/
- **API Endpoint:** `https://world.openproductsfacts.org/api/v3/product/[barcode].json`
- **Authentication:** None required for read access
- **Cost:** Free

### Rate Limits (Inherited from Open Food Facts)

- **Product queries:** 100 requests/minute
- **Search queries:** 10 requests/minute
- **Facet queries:** 2 requests/minute

### Example API Call

```bash
curl "https://world.openproductsfacts.org/api/v3/product/8719743402041.json"
```

### Example Response

```json
{
  "code": "8719743402041",
  "errors": [],
  "product": {
    "_id": "8719743402041",
    "brands": "",
    "categories": "",
    "countries": "France",
    "product_name": "",
    "image_url": "...",
    "created_t": 1688383019,
    "creator": "smoothie-app",
    "complete": 0,
    "completeness": 0.0625
  },
  "status": "success"
}
```

### Available Fields (When Populated)

- Product name
- Brand
- Categories
- Countries
- Images
- Barcode
- Creation metadata
- **Physical specs:** Not consistently available

### Strengths
- Completely free and open
- No authentication required
- Community-contributed (anyone can add products)
- Sister projects for beauty and pet products
- RESTful JSON API

### Limitations
- **Extremely sparse data** - most products have minimal fields populated
- **Not actively maintained** per official documentation
- **Primarily barcode lookup** - no robust text search
- **Inconsistent data quality** - crowdsourced with minimal validation
- **Not suitable for consumer electronics** - better for packaged goods
- **Many products return minimal data** (completeness ~6%)

### Verdict

**Not viable for production use.** The database is underpopulated and data quality is inconsistent. It works for some food/beauty products with barcodes, but consumer electronics coverage is essentially non-existent.

### Sources
- [Open Products Facts Data & API](https://world.openproductsfacts.org/data)
- [Open Food Facts API Documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Open Food Facts Wikipedia](https://en.wikipedia.org/wiki/Open_Food_Facts)

---

## Recommendation Matrix

| API | Status | Free Tier | Physical Specs | Search by Name | Consumer Electronics | Production-Ready |
|-----|--------|-----------|----------------|----------------|---------------------|------------------|
| **Best Buy** | ✅ Active | 50k/day, 5 QPS | ✅ Yes | ✅ Yes | ✅ Excellent | ✅ Yes |
| **Icecat** | ⚠️ Limited | 500k products | ✅ Yes | ❌ SKU/barcode only | ✅ Good | ⚠️ Requires paid tier |
| **Google KG** | ❌ Deprecated | N/A | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Open Products** | ⚠️ Experimental | 100/min | ⚠️ Inconsistent | ❌ Barcode only | ❌ Poor | ❌ No |

---

## Final Recommendation

**Use Best Buy Products API** for the product-viewer MVP:

1. **Immediate access** - Email signup, instant API key
2. **Generous free tier** - 50,000 calls/day is sufficient for development + light production
3. **Complete physical data** - Height, width, depth, weight all available
4. **Name-based search** - Can search by product name, not just SKU/barcode
5. **Production-ready** - Well-documented, stable, supported
6. **Large catalog** - 725k+ products across 100+ brands

**Future expansion options:**
- Add Icecat for non-Best Buy products (requires paid subscription for full catalog)
- Scrape manufacturer websites as fallback for products not in Best Buy
- Consider alternative retail APIs (Amazon Product Advertising API, Walmart Open API)

---

## Next Steps

1. **Sign up for Best Buy API key:** https://developer.bestbuy.com/
2. **Test product search endpoint:** `/products(search=YOUR_PRODUCT_NAME)`
3. **Verify dimension data availability** for your target product categories
4. **Implement rate limiting** in backend (5 QPS max)
5. **Add caching layer** (Redis/SQLite) since Best Buy limits caching to 72 hours
6. **Build fallback strategy** for products not found in Best Buy catalog
