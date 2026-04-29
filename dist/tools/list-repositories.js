import { z } from "zod";
import { dataciteClient } from "../datacite/client.js";
import { getCached, staticCache } from "../cache/index.js";
import { apiError } from "../utils/errors.js";
import { formatClientRecord } from "../utils/formatters.js";
import { fetchClientDoiCount } from "../datacite/stats.js";
/**
 * DataCite clientType enum values as documented in the DataCite REST API reference.
 * https://support.datacite.org/reference/
 */
const CLIENT_TYPE_ENUM = [
    "repository",
    "periodical",
    "service",
    "igsnCatalog",
    "raidAgency",
];
const ListRepositoriesSchema = z.object({
    /**
     * Full-text search query. DataCite uses Elasticsearch to match across
     * name, alternateName, and description fields. Supports exact phrases
     * ("data archive") and boolean operators (climate AND ocean).
     */
    query: z.string().optional(),
    /**
     * Filter by repository type. Must be one of the documented DataCite values.
     * Unknown values will produce an empty result set from the API.
     */
    clientType: z
        .enum(CLIENT_TYPE_ENUM)
        .optional()
        .describe("repository | periodical | service | igsnCatalog | raidAgency"),
    /**
     * Filter to repositories belonging to a specific DataCite provider/member.
     * Use the provider's short ID (e.g. "cern", "dryad").
     */
    providerId: z.string().optional(),
    /**
     * When true, adds doiCount to each result by making one secondary call per
     * client to GET /dois?client-id={id}&page[size]=0. Calls are fired
     * concurrently. On failure, doiCount is set to null.
     * Note: viewCount/downloadCount/citationCount are not available from the
     * DataCite /clients endpoint and will not appear even when includeStats:true.
     */
    includeStats: z.boolean().default(false),
    page_size: z.number().int().min(1).max(500).default(25),
});
export function registerTool(server) {
    server.tool("list_repositories", [
        "Browse DataCite-registered repositories and data centers.",
        "Supports full-text search (Elasticsearch, matches name/alternateName/description)",
        "and filtering by clientType or providerId.",
        "Returns id, name, symbol, alternateName, clientType, isActive, re3data, prefixes,",
        "language, year, created/updated timestamps, and more.",
        "Pass includeStats:true to add doiCount (fetched via secondary /dois calls, one per result).",
        "Note: viewCount/downloadCount/citationCount are not available from the DataCite API",
        "and will not appear even when includeStats:true.",
    ].join(" "), ListRepositoriesSchema.shape, async (params) => {
        const input = ListRepositoriesSchema.parse(params);
        const apiParams = {
            "page[size]": input.page_size,
            include: "prefixes",
        };
        if (input.query)
            apiParams["query"] = input.query;
        if (input.clientType)
            apiParams["client-type"] = input.clientType;
        if (input.providerId)
            apiParams["provider-id"] = input.providerId;
        const cacheKey = `list-repos:${JSON.stringify(Object.entries(apiParams).sort(([a], [b]) => a.localeCompare(b)))}`;
        try {
            const response = await getCached(staticCache, cacheKey, () => dataciteClient.get("/clients", apiParams));
            const clients = response.data ?? [];
            // When includeStats is requested, fire one /dois?client-id=X&page[size]=0
            // call per client concurrently. fetchClientDoiCount never throws — it
            // returns null and logs a warning on failure.
            let doiCounts;
            if (input.includeStats && clients.length > 0) {
                doiCounts = await Promise.all(clients.map((r) => fetchClientDoiCount(r.id)));
            }
            const repositories = clients.map((r, i) => {
                const stats = doiCounts !== undefined
                    ? { doiCount: doiCounts[i] }
                    : undefined;
                return formatClientRecord(r, stats);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            repositories,
                            total: response.meta?.total ?? repositories.length,
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
