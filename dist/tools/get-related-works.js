import { z } from "zod";
import { dataciteClient } from "../datacite/client.js";
import { getCached, doiCache, searchCache } from "../cache/index.js";
import { formatDoiSummary } from "../utils/formatters.js";
import { notFound, apiError, DataCiteError } from "../utils/errors.js";
import { normalizeDoi } from "../datacite/doi-normalizer.js";
const CITATION_RELATION_TYPES = ["IsReferencedBy", "Cites", "IsCitedBy"];
const REFERENCE_RELATION_TYPES = ["References", "Cites"];
const VERSION_RELATION_TYPES = ["IsVersionOf", "HasVersion", "IsNewVersionOf", "IsPreviousVersionOf"];
const PART_RELATION_TYPES = ["IsPartOf", "HasPart"];
const RelatedWorksSchema = z.object({
    doi: z.string().min(1),
    relation_type: z
        .enum(["citations", "references", "versions", "parts", "part-of", "all"])
        .default("all"),
    page_size: z.number().int().min(1).max(50).default(10),
});
async function fetchSearchResults(query, pageSize) {
    const cacheKey = `related:${query}:${pageSize}`;
    const response = await getCached(searchCache, cacheKey, () => dataciteClient.get("/dois", {
        query,
        "page[size]": pageSize,
        detail: true,
    }));
    return response.data ?? [];
}
export function registerTool(server) {
    server.tool("get_related_works", "Explore the relationship graph for a DOI — citations, references, versions, and parts.", RelatedWorksSchema.shape, async (params) => {
        const input = RelatedWorksSchema.parse(params);
        const doi = normalizeDoi(input.doi);
        try {
            // Fetch the base record for its relatedIdentifiers
            const record = await getCached(doiCache, doi, () => dataciteClient
                .get(`/dois/${encodeURIComponent(doi)}`, { detail: true })
                .then((r) => r.data));
            const relatedIdentifiers = record.attributes.relatedIdentifiers ?? [];
            const rt = input.relation_type;
            let works = [];
            let total = 0;
            if (rt === "citations" || rt === "all") {
                // Fetch works that cite this DOI via DataCite events / relatedIdentifiers
                try {
                    const citationResp = await getCached(searchCache, `citations:${doi}:${input.page_size}`, () => dataciteClient.get(`/dois/${encodeURIComponent(doi)}/citations`, {
                        "page[size]": input.page_size,
                        detail: true,
                    }));
                    const citationWorks = citationResp.data ?? [];
                    works = [...works, ...citationWorks];
                    total += citationResp.meta?.total ?? citationWorks.length;
                }
                catch {
                    // Citations endpoint may not exist; skip gracefully
                }
            }
            if (rt === "references" || rt === "all") {
                try {
                    const refResp = await getCached(searchCache, `references:${doi}:${input.page_size}`, () => dataciteClient.get(`/dois/${encodeURIComponent(doi)}/references`, {
                        "page[size]": input.page_size,
                        detail: true,
                    }));
                    const refWorks = refResp.data ?? [];
                    works = [...works, ...refWorks];
                    total += refResp.meta?.total ?? refWorks.length;
                }
                catch {
                    // Fallback: filter relatedIdentifiers
                    const refDois = relatedIdentifiers
                        .filter((ri) => REFERENCE_RELATION_TYPES.includes(ri.relationType))
                        .slice(0, input.page_size)
                        .map((ri) => ri.relatedIdentifier);
                    for (const relDoi of refDois) {
                        try {
                            const relRecord = await getCached(doiCache, normalizeDoi(relDoi), () => dataciteClient
                                .get(`/dois/${encodeURIComponent(normalizeDoi(relDoi))}`, {
                                detail: true,
                            })
                                .then((r) => r.data));
                            works.push(relRecord);
                        }
                        catch {
                            // skip individual failures
                        }
                    }
                    total += refDois.length;
                }
            }
            if (rt === "versions" || rt === "all") {
                const versionDois = relatedIdentifiers
                    .filter((ri) => VERSION_RELATION_TYPES.includes(ri.relationType))
                    .slice(0, input.page_size)
                    .map((ri) => ri.relatedIdentifier);
                for (const relDoi of versionDois) {
                    try {
                        const relRecord = await getCached(doiCache, normalizeDoi(relDoi), () => dataciteClient
                            .get(`/dois/${encodeURIComponent(normalizeDoi(relDoi))}`, {
                            detail: true,
                        })
                            .then((r) => r.data));
                        works.push(relRecord);
                    }
                    catch {
                        // skip
                    }
                }
                total += versionDois.length;
            }
            if (rt === "parts" || rt === "part-of" || rt === "all") {
                const partDois = relatedIdentifiers
                    .filter((ri) => PART_RELATION_TYPES.includes(ri.relationType))
                    .slice(0, input.page_size)
                    .map((ri) => ri.relatedIdentifier);
                for (const relDoi of partDois) {
                    try {
                        const relRecord = await getCached(doiCache, normalizeDoi(relDoi), () => dataciteClient
                            .get(`/dois/${encodeURIComponent(normalizeDoi(relDoi))}`, {
                            detail: true,
                        })
                            .then((r) => r.data));
                        works.push(relRecord);
                    }
                    catch {
                        // skip
                    }
                }
                total += partDois.length;
            }
            // Deduplicate by DOI
            const seen = new Set();
            const unique = works.filter((w) => {
                const id = w.attributes?.doi ?? w.id;
                if (seen.has(id))
                    return false;
                seen.add(id);
                return true;
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            doi,
                            relation_type: input.relation_type,
                            works: unique.map(formatDoiSummary),
                            total,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            if (err instanceof DataCiteError && err.statusCode === 404) {
                throw notFound(doi);
            }
            const msg = err instanceof Error ? err.message : String(err);
            throw apiError(msg);
        }
    });
}
