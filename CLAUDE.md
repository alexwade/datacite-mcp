# DataCite Project — Claude Reference

This directory contains two independent projects that share a folder:

1. **`datacite-mcp`** — A TypeScript MCP server exposing the DataCite REST API to Claude Desktop (the primary codebase).
2. **Resolution logs pipeline** — Python scripts + AWS Fargate for ingesting monthly DOI resolution logs into Athena.
3. **`generate_sitemaps.py`** — Standalone Python script to generate XML sitemaps for all DataCite DOIs.

---

## MCP Server (primary)

**Package:** `datacite-mcp` v0.4.0  
**Runtime:** Node.js ESM, TypeScript, stdio transport  
**Entry point:** `src/index.ts` → `dist/index.js`

### Build & run

```bash
npm run build        # tsc → dist/
npm run dev          # tsc --watch
npm start            # node dist/index.js
npm run inspector    # MCP inspector UI
npm test             # node --test tests/prompts.test.mjs
```

After any source change: `npm run build`, then restart Claude Desktop.

### Claude Desktop config

`~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "datacite": {
      "command": "node",
      "args": ["/Users/alexwade/Claude/projects/datacite/dist/index.js"]
    }
  }
}
```

### Architecture

```
src/
  index.ts          stdio transport entry point
  server.ts         McpServer, registers tools/resources/prompts
  config.ts         env var config (dotenv)
  datacite/
    client.ts       DataCite REST API client (Bottleneck rate limiter, LRU cache)
    types.ts        TypeScript types for API responses
    doi-normalizer.ts  DOI → https://doi.org/ normalization
    stats.ts        fetchClientDoiCount() helper
  tools/            9 registered tools (see below)
  resources/        static + template-based MCP resources
  prompts/          4 prompts (researcher-profile, repository-summary, find-top-works-by-topic, template-loader)
  utils/            formatters.ts (formatDoiSummary, formatDoiFull, formatClientRecord)
```

### Registered tools

| Tool | File |
|------|------|
| `search_dois` | `search-dois.ts` |
| `get_doi` | `get-doi.ts` |
| `format_citation` | `format-citation.ts` |
| `get_doi_metrics` | `get-doi-metrics.ts` |
| `get_related_works` | `get-related-works.ts` |
| `search_by_person` | `search-by-person.ts` |
| `list_repositories` | `list-repositories.ts` |
| `get_repository` | `get-repository.ts` |
| `get_doi_schema_xml` | `get-doi-schema-xml.ts` |

### Response formats

- **Summary** (`formatDoiSummary`) — used in search results: doi, title, creators (first 3), year, resource_type, publisher, abstract snippet, view/download/citation counts.
- **Full** (`formatDoiFull`) — used in `get_doi`: all fields including subjects, funding, related identifiers, geo locations, etc. The base64 `xml` field is always stripped unless `include_xml: true`.
- **Client** (`formatClientRecord`) — repositories; optional `doiCount` via secondary `/dois?client-id=` call.

### Configuration (env vars / `.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_USER_AGENT_URL` | `https://github.com/datacite-mcp` | User-Agent sent to DataCite API |
| `MCP_USER_AGENT_EMAIL` | *(empty)* | Contact email in User-Agent |
| `DATACITE_RATE_LIMIT_RPS` | `10` | Requests/sec cap (Bottleneck) |
| `CACHE_DOI_TTL_SECONDS` | `3600` | DOI record cache TTL |
| `CACHE_SEARCH_TTL_SECONDS` | `300` | Search result cache TTL |
| `CACHE_STATIC_TTL_SECONDS` | `86400` | Repository/provider cache TTL |

### Known bugs & limitations

- **`search_by_person` resource_type filter** uses `resource-type-id` instead of the `types.resourceTypeGeneral:{}` ES field path that `search_dois` uses. Known inconsistency, should be fixed.
- **`list_repositories` with `includeStats: true` + large `page_size`** fires one HTTP call per result — up to 50 s at 10 req/s for a full page of 500.
- **No write operations** — `register_doi` / `update_doi` deferred to Phase 2. Server is read-only.
- **No HTTP transport** — stdio only. Remote access requires Phase 3 work.
- **Static cache is 24 h** — restart server to force refresh of repository metadata.

---

## Resolution Logs Pipeline

Monthly DOI resolution logs (~500–700M events/month) → Parquet → Athena.

```
raw-resolution-logs.datacite.org  (source S3)
  → copy_logs.py          cross-account copy in 25 MB chunks
  → s3://datacite-logs/YYYYMM/
  → chunk_and_process.py  splits .gz into N chunks, launches Fargate tasks
  → lambda/log_processor.py  streams gzip → Parquet via _S3StreamingBuffer
  → s3://datacite-logs-processed/datacite-logs/year=YYYY/month=M/region=R/
  → Athena: datacite.resolution_logs
```

### Key AWS resources

| Resource | Value |
|----------|-------|
| Source bucket | `raw-resolution-logs.datacite.org` |
| Staging bucket | `datacite-logs` (us-east-2) |
| Output bucket | `datacite-logs-processed` (us-east-2) |
| ECS Cluster | `datacite-logs` |
| Task definition | `datacite-log-processor` (current: `:4`) |
| Subnet | `subnet-0e817dccd6519b354` |
| Athena table | `datacite.resolution_logs` |

### Pipeline files

| File | Purpose |
|------|---------|
| `copy_logs.py` | Cross-account S3 copy with retry/backoff |
| `chunk_and_process.py` | Splits `.gz` files, launches Fargate tasks |
| `lambda/log_processor.py` | Core: gzip → Parquet writer |
| `lambda/runner.py` | Fargate entry point, reads env vars |
| `lambda/Dockerfile` | `python:3.12-slim` + pyarrow, `linux/amd64` |

---

## Sitemap Generator

`generate_sitemaps.py` — standalone Python script, no dependencies beyond `requests`.

Paginates all findable DataCite DOIs via cursor pagination and writes gzip-compressed XML sitemaps to `sitemaps/`.

```bash
python3 generate_sitemaps.py               # all ~130M DOIs
python3 generate_sitemaps.py --max-dois 5000  # test run
```

GitHub repo: https://github.com/alexwade/DataCite-sitemaps

---

## DataCite API notes

- Base URL: `https://api.datacite.org`
- Cursor pagination: `page[cursor]=1` on first call, then follow `links.next` (full URL, no params needed).
- Resource types endpoint: `GET /resource-types?page[size]=100` (default page size cuts off at 25 of 34 types).
- Version DOI filter (Solr): `query=version_of_count:[1 TO *]` — excludes concept/standalone DOIs.
- Concept DOI filter: `query=version_of_count:[0 TO 0]`.
- `relation-type-id` query param does **not** filter results — it is effectively ignored by the API.
- GraphQL endpoint: `https://api.datacite.org/graphql` — supports `hasVersions: Int` filter on `datasets`.
