# DataCite MCP Server

A Model Context Protocol (MCP) server that wraps the [DataCite REST API](https://support.datacite.org/docs/api), giving Claude and other MCP clients read-only access to DataCite's index of 125M+ research DOIs. No API key is required. The server runs as a local stdio process and communicates with Claude Desktop via the MCP protocol, enabling natural-language queries against the full DataCite catalogue: searching by keyword, person, funder, or repository; retrieving full metadata records; and exploring relationships between research outputs.

## Claude Desktop Configuration

Add the following to your `claude_desktop_config.json` (found at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "datacite": {
      "command": "node",
      "args": ["/Users/[user_name]/Claude/projects/datacite/dist/index.js"]
    }
  }
}
```

## Build Instructions

```bash
cd /Users/[user_name]/Claude/projects/datacite
npm install
npm run build
```

To inspect the server interactively:

```bash
npm run inspector
```

## Available Tools

| Tool | Description |
|------|-------------|
| `search_dois` | Full-text search across DataCite's 125M+ DOI index with filters for resource type, funder, year, repository, and more. Supports cursor-based pagination. |
| `get_doi` | Retrieve complete metadata for a single DOI. Accepts any common DOI format (bare, URL, `doi:` prefix). Optionally includes the raw DataCite Schema XML. |
| `format_citation` | Format a DOI as a formatted citation string. Supports APA, MLA, Chicago, Harvard, IEEE, Vancouver, BibTeX, and CSL JSON. |
| `get_doi_metrics` | Retrieve view, download, and citation counts for a DOI. Optionally include time-series arrays. |
| `get_related_works` | Explore the relationship graph for a DOI — citations, references, versions, and parts. |
| `search_by_person` | Find all DOIs associated with a researcher by ORCID iD or name. |
| `list_repositories` | Browse DataCite member repositories (clients) with optional search and filtering. |
| `get_doi_schema_xml` | Fetch the raw DataCite Metadata Schema XML for a DOI (base64-decoded). |

## Available Prompts

Prompts are pre-built workflows invocable from Claude Desktop's prompt menu (⌘K → "Use a prompt").

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `find-top-works-by-topic` | `resource_type` (required), `topic` (required) | Find the top 10 most relevant DataCite records for a resource type and subject area. Returns a ranked table with repository/year observations and a suggested follow-up. |
| `repository-summary` | `repository_name` (required) | Full metadata quality and activity report for a repository. Pass a common name like `"Zenodo"` or `"Dryad"` — the prompt resolves it to a DataCite client_id automatically. |
| `researcher-profile` | `identifier` (required) | Researcher profile from DataCite records. Pass an ORCID iD (`0000-0001-8135-3489`) for exact matching, or a name (`"Jane Smith"`) for fuzzy search with disambiguation. |

## Available Resources

| Resource URI | Description |
|-------------|-------------|
| `datacite://schema/resource-types` | The complete DataCite `resourceTypeGeneral` controlled vocabulary. |
| `datacite://providers` | All DataCite member providers (organisations). |
| `datacite://clients` | All DataCite repository clients. |
| `datacite://doi/{doi}` | Full metadata record for a given DOI as JSON. |
| `datacite://doi/{doi}/citations` | Works that cite the given DOI. |
| `datacite://doi/{doi}/references` | Works cited by the given DOI. |
| `datacite://provider/{id}` | Metadata for a specific DataCite provider. |
| `datacite://client/{id}` | Metadata for a specific DataCite repository client. |

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed. All variables are optional — defaults work out of the box.

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_USER_AGENT_URL` | `https://github.com/alexwade/datacite-mcp` | URL included in the HTTP User-Agent header |
| `MCP_USER_AGENT_EMAIL` | *(empty)* | Contact email for DataCite's polite pool |
| `DATACITE_RATE_LIMIT_RPS` | `10` | Max API requests per second |
| `CACHE_DOI_TTL_SECONDS` | `3600` | DOI cache TTL (1 hour) |
| `CACHE_SEARCH_TTL_SECONDS` | `300` | Search cache TTL (5 minutes) |
| `CACHE_STATIC_TTL_SECONDS` | `86400` | Static data cache TTL (24 hours) |
