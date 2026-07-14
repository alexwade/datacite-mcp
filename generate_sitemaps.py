import requests, gzip, os
from xml.sax.saxutils import escape
from datetime import datetime, timezone

API          = "https://api.datacite.org/dois"
COMMONS      = "https://commons.datacite.org"
SITEMAP_BASE = "https://commons.datacite.org/sitemaps"  # where child sitemaps are hosted
PAGE_SIZE        = 1000      # DOIs per API call
URLS_PER_SITEMAP = 50_000    # protocol hard limit
OUT_DIR = "sitemaps"
os.makedirs(OUT_DIR, exist_ok=True)


def doi_urls(query="*", max_dois=None):
    """Yield (loc, lastmod) for findable DataCite DOIs via cursor pagination.

    The public API returns findable DOIs by default. links.next carries the
    next cursor as a full URL, so after the first call we just follow it.
    """
    params = {"page[size]": PAGE_SIZE, "page[cursor]": 1, "query": query}
    url, seen = API, 0
    while url:
        r = requests.get(url, params=params if url == API else None, timeout=60)
        r.raise_for_status()
        payload = r.json()
        for rec in payload.get("data", []):
            attrs   = rec.get("attributes", {})
            doi     = rec["id"]
            lastmod = (attrs.get("updated") or "")[:10]
            yield f"{COMMONS}/doi.org/{doi}", lastmod
            seen += 1
            if max_dois and seen >= max_dois:
                return
        url, params = payload.get("links", {}).get("next"), None


def write_child(batch, idx):
    fname = f"sitemap-{idx:05d}.xml.gz"
    with gzip.open(os.path.join(OUT_DIR, fname), "wt", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for loc, lastmod in batch:
            f.write("  <url>\n")
            f.write(f"    <loc>{escape(loc)}</loc>\n")
            if lastmod:
                f.write(f"    <lastmod>{lastmod}</lastmod>\n")
            f.write("  </url>\n")
        f.write("</urlset>\n")
    return fname


def write_sitemaps(url_iter):
    children, batch, idx = [], [], 0
    for loc, lastmod in url_iter:
        batch.append((loc, lastmod))
        if len(batch) >= URLS_PER_SITEMAP:
            children.append(write_child(batch, idx)); idx += 1; batch = []
    if batch:
        children.append(write_child(batch, idx))
    return children


def write_index(child_files):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    path = os.path.join(OUT_DIR, "sitemap.xml")
    with open(path, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for fname in child_files:
            f.write("  <sitemap>\n")
            f.write(f"    <loc>{SITEMAP_BASE}/{fname}</loc>\n")
            f.write(f"    <lastmod>{today}</lastmod>\n")
            f.write("  </sitemap>\n")
        f.write("</sitemapindex>\n")
    return path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate DataCite sitemaps")
    parser.add_argument("--query", default="*", help="Solr query to filter DOIs (default: *)")
    parser.add_argument("--max-dois", type=int, default=None, help="Cap total DOIs (useful for testing)")
    args = parser.parse_args()

    print(f"Fetching DOIs (query={args.query!r}) ...")
    children = write_sitemaps(doi_urls(query=args.query, max_dois=args.max_dois))
    index = write_index(children)
    print(f"Wrote {len(children)} child sitemap(s) → {index}")
