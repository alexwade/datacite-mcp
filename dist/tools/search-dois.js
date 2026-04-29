import { z } from "zod";
import { dataciteClient } from "../datacite/client.js";
import { getCached, searchCache } from "../cache/index.js";
import { formatDoiSummary } from "../utils/formatters.js";
import { apiError } from "../utils/errors.js";
const SearchSchema = z.object({
    query: z.string().optional(),
    resource_type: z
        .enum([
        "Audiovisual",
        "Book",
        "BookChapter",
        "Collection",
        "ComputationalNotebook",
        "ConferencePaper",
        "ConferenceProceeding",
        "DataPaper",
        "Dataset",
        "Dissertation",
        "Event",
        "Image",
        "Instrument",
        "InteractiveResource",
        "Journal",
        "JournalArticle",
        "Model",
        "OutputManagementPlan",
        "PeerReview",
        "PhysicalObject",
        "Preprint",
        "Report",
        "Service",
        "Software",
        "Sound",
        "Standard",
        "StudyRegistration",
        "Text",
        "Workflow",
        "Other",
    ])
        .optional(),
    funder_ror_id: z.string().optional(),
    affiliation_ror_id: z.string().optional(),
    client_id: z.string().optional(),
    provider_id: z.string().optional(),
    prefix: z.string().optional(),
    published_year: z.number().int().optional(),
    sort: z
        .enum([
        "relevance",
        "created",
        "-created",
        "updated",
        "-updated",
        "published",
        "-published",
        "citation-count",
        "-citation-count",
        "view-count",
        "-view-count",
    ])
        .optional(),
    page_size: z.number().int().min(1).max(100).default(10),
    page_cursor: z.string().optional(),
});
/**
 * Normalize a ROR identifier to its canonical full URI form.
 * Accepts: bare ID ("01cwqze88"), "ror.org/01cwqze88",
 *          "http://ror.org/01cwqze88", "https://ror.org/01cwqze88".
 */
function normalizeRorId(raw) {
    const s = raw.trim();
    if (s.startsWith("https://ror.org/"))
        return s;
    if (s.startsWith("http://ror.org/"))
        return `https://ror.org/${s.slice("http://ror.org/".length)}`;
    if (s.startsWith("ror.org/"))
        return `https://${s}`;
    return `https://ror.org/${s}`;
}
export function registerTool(server) {
    server.tool("search_dois", "Search DataCite's index of 125M+ research DOIs. Supports full-text queries and filters by resource type, funder, year, repository, and more.", SearchSchema.shape, async (params) => {
        const input = SearchSchema.parse(params);
        const apiParams = {
            "page[size]": input.page_size,
            detail: true,
        };
        // Build Elasticsearch query clauses. Field-path filters are appended here
        // rather than as dedicated API params because:
        //  - types.resourceTypeGeneral:{value} is verified to work; resource-type-id
        //    requires lowercase-hyphenated values (computationalnotebook → broken).
        //  - funderIdentifier / affiliationIdentifier require full https://ror.org/ URIs;
        //    the dedicated funder-id / affiliation-id params have the same requirement
        //    but the query-path form is verified correct against the live index.
        const queryClauses = [];
        if (input.query)
            queryClauses.push(`(${input.query})`);
        if (input.resource_type)
            queryClauses.push(`types.resourceTypeGeneral:${input.resource_type}`);
        if (input.funder_ror_id)
            queryClauses.push(`fundingReferences.funderIdentifier:"${normalizeRorId(input.funder_ror_id)}"`);
        if (input.affiliation_ror_id)
            queryClauses.push(`creators.affiliation.affiliationIdentifier:"${normalizeRorId(input.affiliation_ror_id)}"`);
        if (input.published_year)
            queryClauses.push(`publicationYear:${input.published_year}`);
        if (queryClauses.length)
            apiParams["query"] = queryClauses.join(" AND ");
        if (input.client_id)
            apiParams["client-id"] = input.client_id;
        if (input.provider_id)
            apiParams["provider-id"] = input.provider_id;
        if (input.prefix)
            apiParams["prefix"] = input.prefix;
        if (input.sort && input.sort !== "relevance")
            apiParams["sort"] = input.sort;
        if (input.page_cursor)
            apiParams["page[cursor]"] = input.page_cursor;
        const cacheKey = JSON.stringify(Object.entries(apiParams).sort(([a], [b]) => a.localeCompare(b)));
        try {
            const response = await getCached(searchCache, cacheKey, () => dataciteClient.get("/dois", apiParams));
            // Extract next cursor from links.next URL
            let next_cursor = null;
            if (response.links?.next) {
                try {
                    const nextUrl = new URL(response.links.next);
                    next_cursor = nextUrl.searchParams.get("page[cursor]");
                }
                catch {
                    // ignore parse errors
                }
            }
            const results = (response.data ?? []).map(formatDoiSummary);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            results,
                            total_results: response.meta?.total ?? results.length,
                            next_cursor,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw apiError(msg);
        }
    });
}
